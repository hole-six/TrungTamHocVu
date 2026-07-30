// Đánh giá điểm trợ giảng hàng tháng — nguồn "TỔNG HỢP ĐÁNH GIÁ ĐIỂM TRỢ GIẢNG THÁNG X".
// Số ca làm tính động từ SessionAssignment (không lưu trùng) theo đúng nguyên tắc chung
// của hệ thống; điểm trừ/cộng lấy từ AssistantScoreEvent. %Thưởng KHÔNG suy ra tự động từ
// tỉ lệ A — dữ liệu mẫu cho thấy nhiều dòng cùng A nhưng khác %Thưởng (và ngược lại), tức
// còn tiêu chí khác ngoài tỉ lệ này mà không xác nhận được từ sheet gốc. Hiển thị A để
// nhân sự tham khảo, mức thưởng thực tế nhập tay qua AssistantMonthlyBonus.

import { prisma } from "@/lib/prisma";
import { monthRange } from "@/lib/server/tuition-rules";

export type BranchTally = {
  branchId: string;
  branchName: string;
  shifts: number;
  substituteShifts: number;
  deducted: number;
  added: number;
};

export function computeScoreRatio(totalDeducted: number, totalAdded: number, countedShifts: number): number | null {
  if (countedShifts <= 0) return null;
  return ((totalDeducted - totalAdded) / countedShifts) * 100;
}

export async function computeAssistantScorecard(employeeId: string, month: string) {
  const { start, end } = monthRange(month);

  const [assignments, scoreEvents, bonus] = await Promise.all([
    prisma.sessionAssignment.findMany({
      where: {
        employeeId,
        role: { in: ["ASSISTANT", "ASSISTANT2"] },
        session: { sessionDate: { gte: start, lte: end } },
      },
      include: { session: { include: { class: { include: { branch: true } } } } },
    }),
    prisma.assistantScoreEvent.findMany({
      where: { employeeId, eventDate: { gte: start, lte: end } },
      include: { branch: true },
      orderBy: { eventDate: "asc" },
    }),
    prisma.assistantMonthlyBonus.findUnique({ where: { employeeId_month: { employeeId, month } } }),
  ]);

  const branchTally: Record<string, BranchTally> = {};
  function ensure(branchId: string, branchName: string) {
    if (!branchTally[branchId]) branchTally[branchId] = { branchId, branchName, shifts: 0, substituteShifts: 0, deducted: 0, added: 0 };
    return branchTally[branchId];
  }

  for (const a of assignments) {
    const branch = a.session.class.branch;
    const t = ensure(branch.id, branch.name);
    t.shifts++;
    if (a.isSubstituteShift) t.substituteShifts++;
  }
  for (const e of scoreEvents) {
    const t = ensure(e.branchId, e.branch.name);
    if (e.type === "DEDUCT") t.deducted += e.points;
    else t.added += e.points;
  }

  const byBranch = Object.values(branchTally);
  const totalShifts = byBranch.reduce((s, r) => s + r.shifts, 0);
  const totalSubstituteShifts = byBranch.reduce((s, r) => s + r.substituteShifts, 0);
  const countedShifts = totalShifts - totalSubstituteShifts;
  const totalDeducted = byBranch.reduce((s, r) => s + r.deducted, 0);
  const totalAdded = byBranch.reduce((s, r) => s + r.added, 0);
  const ratio = computeScoreRatio(totalDeducted, totalAdded, countedShifts);

  return { byBranch, totalShifts, totalSubstituteShifts, countedShifts, totalDeducted, totalAdded, ratio, scoreEvents, bonus };
}
