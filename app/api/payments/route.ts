import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { hasPermission } from "@/lib/server/permissions";
import { computeOutstandingBalance } from "@/lib/server/balance";
import { chargeOwnDueAmount } from "@/lib/server/tuition-rules";
import { canAccessBranch } from "@/lib/branch-filter";

const CASH_METHOD = "Tiền mặt";
const MAX_CASH_DISCOUNT_PERCENT = 10;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!(await hasPermission(user, "tuition", "receive_payment"))) {
    return NextResponse.json({ error: "Bạn không có quyền thu tiền học phí" }, { status: 403 });
  }

  const body = await req.json();
  const studentId = String(body.studentId ?? "").trim();
  const amount = Number(body.amount);
  const method = String(body.method ?? "").trim();
  const discountPercent =
    body.discountPercent !== undefined && body.discountPercent !== "" ? Number(body.discountPercent) : 0;
  const discountReason = String(body.discountReason ?? "").trim();

  if (!studentId) return NextResponse.json({ error: "Thiếu học viên" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Số tiền không hợp lệ" }, { status: 400 });
  }
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > MAX_CASH_DISCOUNT_PERCENT) {
    return NextResponse.json(
      { error: `Chiết khấu tiền mặt phải nằm trong khoảng 0-${MAX_CASH_DISCOUNT_PERCENT}%` },
      { status: 400 },
    );
  }
  if (discountPercent > 0 && method !== CASH_METHOD) {
    return NextResponse.json({ error: "Chiết khấu chỉ áp dụng cho thanh toán tiền mặt" }, { status: 400 });
  }
  if (discountPercent > 0 && !discountReason) {
    return NextResponse.json({ error: "Cần nhập lý do chiết khấu tiền mặt" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });
  if (!(await canAccessBranch(student.branchId))) {
    return NextResponse.json({ error: "Học viên không thuộc chi nhánh của bạn" }, { status: 403 });
  }

  const paymentNo = `PM${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
  const discountAmount = Math.round((amount * discountPercent) / 100);
  const totalDebtReduction = amount + discountAmount;
  const discountNote =
    discountAmount > 0
      ? `Đã giảm ${discountAmount.toLocaleString("vi-VN")}đ do chiết khấu tiền mặt ${discountPercent}%${discountReason ? ` · Lý do: ${discountReason}` : ""}`
      : null;
  const paymentNotes = [String(body.notes ?? "").trim() || null, discountNote].filter(Boolean).join(" | ");

  const result = await prisma.$transaction(async (tx) => {
    const currentOutstanding = await computeOutstandingBalance(studentId, tx);

    if (currentOutstanding <= 0) {
      throw new Error("Học viên hiện không còn công nợ để thu.");
    }
    if (amount > currentOutstanding) {
      throw new Error(
        `Số tiền thực thu ${amount.toLocaleString("vi-VN")}đ đang vượt công nợ còn lại ${currentOutstanding.toLocaleString("vi-VN")}đ.`,
      );
    }
    if (totalDebtReduction > currentOutstanding) {
      throw new Error(
        `Tổng số tiền giảm công nợ sau chiết khấu là ${totalDebtReduction.toLocaleString("vi-VN")}đ, đang vượt công nợ còn lại ${currentOutstanding.toLocaleString("vi-VN")}đ.`,
      );
    }

    const payment = await tx.payment.create({
      data: {
        studentId,
        paymentNo,
        paidDate: body.paidDate ? new Date(body.paidDate) : new Date(),
        amount,
        method: method || null,
        receivedById: user.id,
        notes: paymentNotes || null,
        status: "ALLOCATED",
      },
    });

    const openCharges = await tx.charge.findMany({
      where: { studentId },
      include: {
        allocations: { where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } } },
      },
      orderBy: [{ billingPeriod: { startDate: "asc" } }, { createdAt: "asc" }],
    });

    let remaining = amount;
    for (const charge of openCharges) {
      if (remaining <= 0) break;
      const alreadyPaid = charge.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
      // chargeOwnDueAmount (KHÔNG dùng totalAmount) — totalAmount cộng cả openingBalance
      // (bản chụp lại nợ charge kỳ TRƯỚC), nếu dùng trực tiếp sẽ đếm trùng đúng khoản nợ
      // đó 2 lần: 1 lần ở chính charge kỳ trước, 1 lần nữa ở đây.
      const due = chargeOwnDueAmount(charge) - alreadyPaid;
      if (due <= 0) continue;

      const allocAmount = Math.min(due, remaining);
      await tx.paymentAllocation.create({
        data: { paymentId: payment.id, chargeId: charge.id, amount: allocAmount },
      });
      remaining -= allocAmount;
    }

    if (discountAmount > 0) {
      await tx.creditBalance.create({
        data: {
          studentId,
          paymentId: payment.id,
          amount: discountAmount,
          reason: `Chiết khấu tiền mặt ${discountPercent}% từ phiếu thu ${paymentNo}${discountReason ? ` · ${discountReason}` : ""}`,
        },
      });
    }

    const cashTxn = await tx.cashTransaction.create({
      data: {
        branchId: student.branchId,
        categoryId: body.categoryId || null,
        type: "THU",
        txnDate: body.paidDate ? new Date(body.paidDate) : new Date(),
        description: body.description || `Thu học phí ${student.fullName} (${student.studentCode})`,
        detail: `Phiếu thu ${paymentNo}`,
        amount,
        handledById: user.id,
        status: "CONFIRMED",
        notes: paymentNotes || null,
      },
    });

    await tx.paymentCashPosting.create({
      data: {
        paymentId: payment.id,
        cashTransactionId: cashTxn.id,
        amount,
        postingKind: "RECEIPT",
        notes: `Auto-post từ phiếu thu ${paymentNo}`,
      },
    });

    return {
      payment,
      unallocated: remaining,
      cashTransactionId: cashTxn.id,
      discountAmount,
      discountNote,
    };
  }).catch((error: unknown) => {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Không thể ghi nhận thanh toán." };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(
    {
      item: result.payment,
      unallocated: result.unallocated,
      cashTransactionId: result.cashTransactionId,
      discountAmount: result.discountAmount,
      discountNote: result.discountNote,
    },
    { status: 201 },
  );
}
