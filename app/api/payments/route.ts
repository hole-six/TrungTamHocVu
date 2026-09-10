import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { hasPermission } from "@/lib/server/permissions";
import { computeOutstandingBalance } from "@/lib/server/balance";
import { chargeOwnDueAmount } from "@/lib/server/tuition-rules";
import { canAccessBranch } from "@/lib/branch-filter";
import { topUpWalletFromPayment } from "@/lib/server/enrollment-wallet";
import { computeAdvanceBalance } from "@/lib/server/advance-payment";

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
  const discountNote =
    discountAmount > 0
      ? `Đã giảm ${discountAmount.toLocaleString("vi-VN")}đ do chiết khấu tiền mặt ${discountPercent}%${discountReason ? ` · Lý do: ${discountReason}` : ""}`
      : null;
  const paymentNotes = [String(body.notes ?? "").trim() || null, discountNote].filter(Boolean).join(" | ");

  const result = await prisma.$transaction(async (tx) => {
    const currentOutstanding = await computeOutstandingBalance(studentId, tx);

    // ĐÓNG TRƯỚC / THU DƯ ĐƯỢC PHÉP. Trước đây chỗ này chặn thẳng hai ca "chưa có công
    // nợ" và "thu vượt công nợ", khiến nhân viên không ghi nhận được đúng số tiền đã
    // cầm của phụ huynh — trong khi ở file quản lý thật của trung tâm, "TT dư" là một
    // tình trạng bình thường (260 dòng mang số dư âm ở cột "HP tồn tháng trước").
    // Nay phần vượt công nợ nằm lại trên phiếu thu ở dạng chưa phân bổ và sẽ tự trừ
    // vào phiếu học phí kỳ sau — xem lib/server/advance-payment.ts.
    //
    // Riêng CHIẾT KHẤU thì vẫn phải chặn: chiết khấu là giảm giá trên khoản đang nợ,
    // không phải tiền mặt thật, nên không thể giảm nhiều hơn phần nợ mà tiền mặt chưa
    // trả hết. Nếu không chặn, phần chiết khấu thừa sẽ thành credit ảo không có gốc.
    const maxDiscountAmount = Math.max(0, currentOutstanding - amount);
    if (discountAmount > maxDiscountAmount) {
      throw new Error(
        `Chiết khấu ${discountAmount.toLocaleString("vi-VN")}đ vượt phần công nợ còn lại sau tiền mặt ` +
          `(${maxDiscountAmount.toLocaleString("vi-VN")}đ). Giảm % chiết khấu hoặc giảm số tiền thu.`,
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

    // Mỗi đồng tiền mặt phân bổ thực chất giảm được nhiều hơn 1 đồng công nợ khi có
    // chiết khấu — dùng đúng tỉ lệ này để quy ra số buổi nạp vào ví.
    const walletValueMultiplier = amount > 0 ? (amount + discountAmount) / amount : 1;
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

      // Ví buổi học: tiền vừa phân bổ cho 1 charge PERIOD thì nạp thẳng vào ví của
      // đúng enrollment đó — quy đổi 1 lần theo đơn giá của charge này (đã áp học
      // bổng/điều chỉnh tại thời điểm sinh charge).
      if (charge.billingModel === "PERIOD" && charge.enrollmentId) {
        // Chiết khấu tiền mặt là GIẢM GIÁ, không phải trả thiếu: công nợ được giảm cả
        // phần chiết khấu (totalDebtReduction = tiền mặt + chiết khấu). Nếu nạp ví chỉ
        // theo tiền mặt thì học viên đã thanh toán xong N buổi nhưng chỉ được quyền học
        // N-1 buổi — mất đúng phần đã giảm giá, và ví âm sớm hơn thực tế.
        // Quy đổi theo đúng giá trị đã giảm nợ của khoản phân bổ này.
        await topUpWalletFromPayment(tx, {
          enrollmentId: charge.enrollmentId,
          paymentId: payment.id,
          amountVnd: Math.round(allocAmount * walletValueMultiplier),
          unitPrice: charge.unitPrice,
          note: discountAmount > 0
            ? `Gồm phần chiết khấu tiền mặt ${discountPercent}% (đã giảm ${discountAmount.toLocaleString("vi-VN")}đ)`
            : undefined,
        });
      }
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
      advanceBalance: await computeAdvanceBalance(tx, studentId),
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
      advanceBalance: result.advanceBalance,
      cashTransactionId: result.cashTransactionId,
      discountAmount: result.discountAmount,
      discountNote: result.discountNote,
    },
    { status: 201 },
  );
}
