import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { hasPermission } from "@/lib/server/permissions";

// Ghi nhận thanh toán và phân bổ FIFO vào các Charge còn nợ CŨ NHẤT trước — thay
// cho việc trừ dần "Cong don" thủ công theo thứ tự dòng trong TheoDoiHP gốc. Thu
// dư (sau khi đã trả hết nợ hiện có) được ghi vào CreditBalance để tự động trừ vào
// khoản phải thu kỳ sau (xem lib/server/balance.ts computeOpeningBalance).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!(await hasPermission(user, "tuition", "receive_payment"))) {
    return NextResponse.json({ error: "Bạn không có quyền thu tiền học phí" }, { status: 403 });
  }

  const body = await req.json();
  const studentId = String(body.studentId ?? "").trim();
  const amount = Number(body.amount);
  if (!studentId) return NextResponse.json({ error: "Thiếu học viên" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Số tiền không hợp lệ" }, { status: 400 });

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });
  if (user.branchId && student.branchId !== user.branchId) {
    return NextResponse.json({ error: "Học viên không thuộc chi nhánh của bạn" }, { status: 403 });
  }

  const paymentNo = `PM${crypto.randomUUID().slice(0, 10).toUpperCase()}`;

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        studentId,
        paymentNo,
        paidDate: body.paidDate ? new Date(body.paidDate) : new Date(),
        amount,
        method: body.method || null,
        receivedById: user.id,
        notes: body.notes || null,
        status: "ALLOCATED",
      },
    });

    const openCharges = await tx.charge.findMany({
      where: { studentId },
      include: { allocations: true },
      orderBy: [{ billingPeriod: { startDate: "asc" } }, { createdAt: "asc" }],
    });

    let remaining = amount;
    for (const charge of openCharges) {
      if (remaining <= 0) break;
      const alreadyPaid = charge.allocations.reduce((s, a) => s + a.amount, 0);
      const due = charge.totalAmount - alreadyPaid;
      if (due <= 0) continue;
      const allocAmount = Math.min(due, remaining);
      await tx.paymentAllocation.create({ data: { paymentId: payment.id, chargeId: charge.id, amount: allocAmount } });
      remaining -= allocAmount;
    }

    if (remaining > 0) {
      await tx.creditBalance.create({
        data: { studentId, paymentId: payment.id, amount: remaining, reason: `Thu dư từ phiếu thu ${paymentNo}` },
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
        notes: body.notes || null,
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

    return { payment, unallocated: remaining, cashTransactionId: cashTxn.id };
  });

  return NextResponse.json(
    { item: result.payment, unallocated: result.unallocated, cashTransactionId: result.cashTransactionId },
    { status: 201 }
  );
}
