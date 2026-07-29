import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Công nợ được tính động cho TỪNG học viên (không theo lớp) — đúng theo cách Excel
// gốc nhóm "Cong don" bằng SUMIFS theo Ten HV (tên học viên), không theo MaLop.
// Một học viên có thể học nhiều lớp cùng lúc nhưng chỉ có MỘT sổ công nợ chung.

// Công nợ còn lại của TẤT CẢ charge thuộc các kỳ có startDate < beforeDate (không
// bao gồm kỳ hiện tại) — dùng làm "HP dau ky" khi sinh charge cho kỳ mới, cộng với
// credit chưa dùng (khách trả dư kỳ trước).
export async function computeOpeningBalance(
  studentId: string,
  beforeDate: Date,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) {
  const [chargeTotal, allocatedTotal, unusedCredits] = await Promise.all([
    tx.charge.aggregate({
      where: { studentId, billingPeriod: { startDate: { lt: beforeDate } } },
      _sum: { totalAmount: true },
    }),
    tx.paymentAllocation.aggregate({
      where: { charge: { studentId, billingPeriod: { startDate: { lt: beforeDate } } } },
      _sum: { amount: true },
    }),
    tx.creditBalance.findMany({ where: { studentId, usedAt: null } }),
  ]);

  const debt = (chargeTotal._sum.totalAmount ?? 0) - (allocatedTotal._sum.amount ?? 0);
  const creditAmount = unusedCredits.reduce((sum, c) => sum + c.amount, 0);

  return { openingBalance: debt - creditAmount, unusedCreditIds: unusedCredits.map((c) => c.id) };
}

// Tổng công nợ hiện tại của học viên (mọi kỳ, mọi lớp) — dùng cho dashboard/trang
// chi tiết học viên, thay cho việc dò cột "HP tồn" cộng dồn thủ công.
export async function computeOutstandingBalance(studentId: string) {
  const [chargeTotal, allocatedTotal] = await Promise.all([
    prisma.charge.aggregate({ where: { studentId }, _sum: { totalAmount: true } }),
    prisma.paymentAllocation.aggregate({ where: { charge: { studentId } }, _sum: { amount: true } }),
  ]);
  return (chargeTotal._sum.totalAmount ?? 0) - (allocatedTotal._sum.amount ?? 0);
}
