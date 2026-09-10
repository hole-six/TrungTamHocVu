import type { Prisma } from "@prisma/client";
import { chargeOwnDueAmount } from "@/lib/server/tuition-rules";
import { topUpWalletFromPayment } from "@/lib/server/enrollment-wallet";

// TIỀN ĐÓNG TRƯỚC / THU DƯ — khoản tiền đã thu thật của học viên nhưng chưa gắn được
// vào phiếu học phí nào.
//
// Vì sao phải có: trong file quản lý thật của trung tâm (sheet TheoDoiHP), "đóng dư"
// KHÔNG phải ca hiếm — 260/5.815 dòng mang số dư âm ở cột "HP tồn tháng trước", và cột
// "Tình trạng TT" có hẳn giá trị "TT dư". Phụ huynh đóng chẵn (2 triệu cho phiếu 1,7
// triệu), đóng trước cả kỳ nghỉ hè, đóng gộp 2-3 tháng là chuyện hàng ngày. Trước đây
// API thu tiền CHẶN THẲNG hai ca này ("Học viên hiện không còn công nợ để thu" và
// "Số tiền thực thu đang vượt công nợ còn lại"), nên nhân viên không có cách nào ghi
// nhận đúng số tiền đã cầm — trái với quy tắc gốc: SỐ TIỀN THU VÀO LÀ ĐÍCH ĐẾN CUỐI CÙNG.
//
// Cách làm: tiền dư nằm nguyên trên phiếu thu ở dạng CHƯA PHÂN BỔ (không đẻ ra khoản
// nợ ảo, không phải CreditBalance — credit dành riêng cho chiết khấu/bù trừ). Tới khi
// kỳ sau sinh phiếu học phí mới, settleChargesFromAdvancePayments tự gắn tiền đó vào
// phiếu mới theo thứ tự cũ trước. Nhờ vậy mọi bất biến về tiền vẫn đúng nguyên:
// phân bổ không bao giờ vượt số tiền phiếu thu, và không phiếu học phí nào bị thu vượt.

const LIVE_PAYMENT = { status: { notIn: ["VOIDED", "REFUNDED"] } };

// Số tiền đã thu nhưng chưa gắn vào phiếu học phí nào của học viên này.
export async function computeAdvanceBalance(
  tx: Prisma.TransactionClient,
  studentId: string,
): Promise<number> {
  const payments = await tx.payment.findMany({
    where: { studentId, ...LIVE_PAYMENT },
    select: { amount: true, allocations: { select: { amount: true } } },
  });
  return payments.reduce(
    (sum, payment) => sum + payment.amount - payment.allocations.reduce((s, a) => s + a.amount, 0),
    0,
  );
}

// Gắn tiền đã thu (còn dư trên phiếu thu) vào các phiếu học phí chưa thu đủ.
// Thứ tự: phiếu thu cũ trước (tiền vào trước dùng trước), phiếu học phí cũ trước.
// Gọi được nhiều lần — chạy lại không phân bổ trùng vì mỗi vòng đều tính lại phần còn
// thiếu thật của từng phiếu.
export async function settleChargesFromAdvancePayments(
  tx: Prisma.TransactionClient,
  studentId: string,
): Promise<{ allocated: number; chargeIds: string[] }> {
  const [payments, charges] = await Promise.all([
    tx.payment.findMany({
      where: { studentId, ...LIVE_PAYMENT },
      select: { id: true, amount: true, allocations: { select: { amount: true } } },
      orderBy: [{ paidDate: "asc" }, { createdAt: "asc" }],
    }),
    tx.charge.findMany({
      where: { studentId },
      select: {
        id: true,
        tuitionAmount: true,
        materialsAmount: true,
        unitPrice: true,
        billingModel: true,
        enrollmentId: true,
        allocations: { where: { payment: LIVE_PAYMENT }, select: { amount: true } },
      },
      orderBy: [{ billingPeriod: { startDate: "asc" } }, { createdAt: "asc" }],
    }),
  ]);

  const leftoverByPayment = payments
    .map((payment) => ({
      id: payment.id,
      left: payment.amount - payment.allocations.reduce((s, a) => s + a.amount, 0),
    }))
    .filter((item) => item.left > 0);
  if (leftoverByPayment.length === 0) return { allocated: 0, chargeIds: [] };

  let allocated = 0;
  const touchedCharges: string[] = [];

  for (const charge of charges) {
    let due = chargeOwnDueAmount(charge) - charge.allocations.reduce((s, a) => s + a.amount, 0);
    if (due <= 0) continue;

    for (const source of leftoverByPayment) {
      if (due <= 0) break;
      if (source.left <= 0) continue;

      const amount = Math.min(due, source.left);
      await tx.paymentAllocation.create({
        data: { paymentId: source.id, chargeId: charge.id, amount },
      });
      source.left -= amount;
      due -= amount;
      allocated += amount;
      if (!touchedCharges.includes(charge.id)) touchedCharges.push(charge.id);

      // Ví buổi học phải được nạp đúng lúc tiền được gắn vào phiếu PERIOD — nếu chỉ nạp
      // ở API thu tiền thì phần đóng trước sẽ không bao giờ thành buổi học được.
      if (charge.billingModel === "PERIOD" && charge.enrollmentId) {
        await topUpWalletFromPayment(tx, {
          enrollmentId: charge.enrollmentId,
          paymentId: source.id,
          amountVnd: amount,
          unitPrice: charge.unitPrice,
          note: "Dùng tiền đã đóng trước",
        });
      }
    }
  }

  return { allocated, chargeIds: touchedCharges };
}
