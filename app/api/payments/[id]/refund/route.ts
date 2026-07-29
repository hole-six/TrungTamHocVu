import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { hasPermission } from "@/lib/server/permissions";

// Hoàn tiền — spec §14 liệt kê "Hoàn tiền/hủy payment" là điểm không được tự động
// quyết định, nên bắt buộc gác quyền payment.refund (không mặc định cho mọi user
// đăng nhập). Khi hoàn tiền, gỡ theo thứ tự: (1) CreditBalance CHƯA DÙNG tạo từ
// chính payment này, (2) PaymentAllocation mới nhất trước (LIFO) — các Charge liên
// quan trở lại trạng thái còn nợ tương ứng. Nếu số tiền cần hoàn vượt quá phần còn
// "chưa dùng" (tức một phần credit đã bị tiêu vào charge của kỳ đã chốt), từ chối
// và yêu cầu xử lý tay — spec §14 không cho tự động mở lại kỳ đã chốt.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!(await hasPermission(user, "tuition", "refund"))) {
    return NextResponse.json({ error: "Bạn không có quyền hoàn tiền" }, { status: 403 });
  }

  const payment = await prisma.payment.findUnique({
    where: { id: params.id },
    include: { allocations: true, refunds: true, creditBalances: true, student: true },
  });
  if (!payment) return NextResponse.json({ error: "Không tìm thấy phiếu thu" }, { status: 404 });
  if (payment.status === "VOIDED") return NextResponse.json({ error: "Phiếu thu đã bị hủy" }, { status: 409 });
  if (user.branchId && payment.student.branchId !== user.branchId) {
    return NextResponse.json({ error: "Phiếu thu không thuộc chi nhánh của bạn" }, { status: 403 });
  }

  const body = await req.json();
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Số tiền hoàn không hợp lệ" }, { status: 400 });

  const alreadyRefunded = payment.refunds.reduce((s, r) => s + r.amount, 0);
  const refundableTotal = payment.amount - alreadyRefunded;
  if (amount > refundableTotal) {
    return NextResponse.json({ error: `Chỉ có thể hoàn tối đa ${refundableTotal.toLocaleString("vi-VN")}đ` }, { status: 400 });
  }

  const unusedCredits = payment.creditBalances.filter((c) => !c.usedAt);
  const stillAllocated = payment.allocations.reduce((s, a) => s + a.amount, 0);
  const unusedCreditTotal = unusedCredits.reduce((s, c) => s + c.amount, 0);
  const reversibleTotal = stillAllocated + unusedCreditTotal;

  if (amount > reversibleTotal) {
    return NextResponse.json(
      {
        error: `Một phần tiền của phiếu thu này (${(refundableTotal - reversibleTotal).toLocaleString("vi-VN")}đ) đã được dùng để trừ công nợ ở kỳ đã chốt sổ — không thể tự động hoàn. Cần mở lại kỳ đó trước hoặc xử lý thủ công.`,
      },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    let remaining = amount;

    for (const credit of unusedCredits) {
      if (remaining <= 0) break;
      if (credit.amount <= remaining) {
        await tx.creditBalance.delete({ where: { id: credit.id } });
        remaining -= credit.amount;
      } else {
        await tx.creditBalance.update({ where: { id: credit.id }, data: { amount: credit.amount - remaining } });
        remaining = 0;
      }
    }

    const allocations = [...payment.allocations].sort((a, b) => b.id.localeCompare(a.id));
    for (const alloc of allocations) {
      if (remaining <= 0) break;
      if (alloc.amount <= remaining) {
        await tx.paymentAllocation.delete({ where: { id: alloc.id } });
        remaining -= alloc.amount;
      } else {
        await tx.paymentAllocation.update({ where: { id: alloc.id }, data: { amount: alloc.amount - remaining } });
        remaining = 0;
      }
    }

    const refund = await tx.refund.create({
      data: { paymentId: payment.id, amount, reason: body.reason || null, approvedById: user.id },
    });

    const cashTxn = await tx.cashTransaction.create({
      data: {
        branchId: payment.student.branchId,
        categoryId: body.categoryId || null,
        type: "CHI",
        txnDate: body.refundedAt ? new Date(body.refundedAt) : new Date(),
        description: body.description || `Hoàn học phí ${payment.student.fullName} (${payment.student.studentCode})`,
        detail: `Hoàn từ phiếu thu ${payment.paymentNo}`,
        amount,
        handledById: user.id,
        status: "CONFIRMED",
        notes: body.reason || null,
      },
    });

    await tx.refundCashPosting.create({
      data: {
        refundId: refund.id,
        cashTransactionId: cashTxn.id,
        amount,
        postingKind: "REFUND",
        notes: `Auto-post hoàn tiền từ phiếu thu ${payment.paymentNo}`,
      },
    });

    const newTotalRefunded = alreadyRefunded + amount;
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: newTotalRefunded >= payment.amount ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        branchId: user.branchId,
        action: "refund",
        entityType: "Payment",
        entityId: payment.id,
        reason: body.reason || null,
        after: JSON.stringify({ amount }),
      },
    });
  });

  return NextResponse.json({ ok: true });
}
