import type { Prisma } from "@prisma/client";
import { chargeOwnDueAmount } from "@/lib/server/tuition-rules";

// TÌNH TRẠNG THU TIỀN CỦA PHIẾU XUẤT GIÁO TRÌNH.
//
// Sách có 2 đường thu tiền:
//   1. Thu tiền mặt ngay lúc đưa sách → BookIssue.paymentStatus = PAID ngay từ đầu.
//   2. Thu theo KỲ HỌC PHÍ → tiền sách cộng vào charge (materialsAmount), phụ huynh trả
//      chung với học phí.
// Đường (2) trước đây tạo phiếu xuất với paymentStatus = UNPAID rồi KHÔNG AI cập nhật lại:
// phụ huynh đóng học phí xong, sổ xuất giáo trình vẫn báo "chưa thanh toán" mãi mãi, và
// những chỗ đếm "tiền sách chưa thu" (trang học viên, báo cáo) cộng nhầm khoản đã thu rồi.
//
// Quy tắc: sách gắn vào phiếu học phí được coi là ĐÃ THU khi phiếu đó đã trả đủ phần nợ
// của chính nó (chargeOwnDueAmount — không tính nợ kỳ trước mang sang). Trả một phần thì
// vẫn là chưa thu: tiền vào phiếu không chỉ đích danh cuốn sách nào, nên chỉ khi phiếu
// sạch nợ mới chắc chắn tiền sách đã nằm trong đó.
export async function syncBookIssuePaymentStatus(tx: Prisma.TransactionClient, chargeId: string): Promise<void> {
  const charge = await tx.charge.findUnique({
    where: { id: chargeId },
    select: {
      id: true,
      tuitionAmount: true,
      materialsAmount: true,
      allocations: {
        where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } },
        select: { amount: true },
      },
      bookIssues: { select: { id: true, paymentStatus: true } },
    },
  });
  if (!charge || charge.bookIssues.length === 0) return;

  const paid = charge.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  const ownDue = chargeOwnDueAmount(charge);
  const nextStatus = ownDue > 0 && paid >= ownDue ? "PAID" : "UNPAID";

  const toUpdate = charge.bookIssues.filter((issue) => issue.paymentStatus !== nextStatus).map((issue) => issue.id);
  if (toUpdate.length === 0) return;
  await tx.bookIssue.updateMany({ where: { id: { in: toUpdate } }, data: { paymentStatus: nextStatus } });
}

/** Đồng bộ cho mọi phiếu học phí mà một phiếu thu đã phân bổ vào (thu tiền, hoàn tiền, hủy phiếu). */
export async function syncBookIssuesOfPayment(tx: Prisma.TransactionClient, paymentId: string): Promise<void> {
  const allocations = await tx.paymentAllocation.findMany({ where: { paymentId }, select: { chargeId: true } });
  for (const chargeId of new Set(allocations.map((item) => item.chargeId))) {
    await syncBookIssuePaymentStatus(tx, chargeId);
  }
}
