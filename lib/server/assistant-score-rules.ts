// Đánh giá điểm giảng viên & trợ giảng hàng tháng — nguồn "TỔNG HỢP ĐÁNH GIÁ ĐIỂM TRỢ
// GIẢNG THÁNG X", mở rộng áp dụng cho cả Giảng viên (quyết định của Giám đốc). Số ca
// làm tính động từ SessionAssignment (không lưu trùng) theo đúng nguyên tắc chung của
// hệ thống; điểm trừ/cộng lấy từ AssistantScoreEvent.
//
// Chỉ số A và %Thưởng được TÁCH RIÊNG THEO TỪNG CƠ SỞ (không gộp toàn hệ thống) —
// làm tốt ở cơ sở này không bù được lỗi ở cơ sở khác, quản lý mỗi cơ sở chịu trách
// nhiệm rõ ràng hơn (quyết định của Giám đốc).
//
// %Thưởng KHÔNG suy ra tự động từ tỉ lệ A — dữ liệu mẫu cho thấy nhiều dòng cùng A
// nhưng khác %Thưởng (và ngược lại), tức còn tiêu chí khác ngoài tỉ lệ này mà không
// xác nhận được từ sheet gốc. Hiển thị A để nhân sự tham khảo, mức thưởng thực tế
// nhập tay theo từng cơ sở qua AssistantMonthlyBonus.

import { prisma } from "@/lib/prisma";
import { monthRange } from "@/lib/server/tuition-rules";

export type BranchTally = {
  branchId: string;
  branchName: string;
  shifts: number;
  substituteShifts: number;
  countedShifts: number;
  deducted: number;
  added: number;
  ratio: number | null;
  bonus: { bonusPercent: number } | null;
};

export function computeScoreRatio(totalDeducted: number, totalAdded: number, countedShifts: number): number | null {
  if (countedShifts <= 0) return null;
  return ((totalDeducted - totalAdded) / countedShifts) * 100;
}

export async function computeAssistantScorecard(employeeId: string, month: string) {
  const { start, end } = monthRange(month);

  const [assignments, scoreEvents, bonuses] = await Promise.all([
    prisma.sessionAssignment.findMany({
      where: {
        employeeId,
        role: { in: ["TEACHER", "ASSISTANT", "ASSISTANT2"] },
        session: { sessionDate: { gte: start, lte: end } },
      },
      include: { session: { include: { class: { include: { branch: true } } } } },
    }),
    prisma.assistantScoreEvent.findMany({
      where: { employeeId, eventDate: { gte: start, lte: end } },
      include: { branch: true },
      orderBy: { eventDate: "asc" },
    }),
    prisma.assistantMonthlyBonus.findMany({ where: { employeeId, month } }),
  ]);

  const bonusByBranch = new Map(bonuses.map((b) => [b.branchId, b]));

  type RawTally = { branchId: string; branchName: string; shifts: number; substituteShifts: number; deducted: number; added: number };
  const branchTally: Record<string, RawTally> = {};
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

  const byBranch: BranchTally[] = Object.values(branchTally).map((t) => {
    const countedShifts = t.shifts - t.substituteShifts;
    return {
      ...t,
      countedShifts,
      ratio: computeScoreRatio(t.deducted, t.added, countedShifts),
      bonus: bonusByBranch.get(t.branchId) ?? null,
    };
  });

  const totalShifts = byBranch.reduce((s, r) => s + r.shifts, 0);
  const totalSubstituteShifts = byBranch.reduce((s, r) => s + r.substituteShifts, 0);
  const countedShifts = totalShifts - totalSubstituteShifts;
  const totalDeducted = byBranch.reduce((s, r) => s + r.deducted, 0);
  const totalAdded = byBranch.reduce((s, r) => s + r.added, 0);
  // Chỉ số A gộp toàn hệ thống — CHỈ để Giám đốc tham khảo, không dùng để tính thưởng
  // (thưởng tính riêng theo từng cơ sở ở byBranch[].ratio/bonus).
  const overallRatio = computeScoreRatio(totalDeducted, totalAdded, countedShifts);

  return {
    byBranch,
    totalShifts,
    totalSubstituteShifts,
    countedShifts,
    totalDeducted,
    totalAdded,
    ratio: overallRatio,
    scoreEvents,
  };
}

// ---------------------------------------------------------------------------------
// BẢNG ĐIỂM THÁNG CỦA CẢ CƠ SỞ — cho trang chấm điểm tích cực. computeAssistantScorecard
// ở trên tính cho 1 người (dùng trong màn lương); hàm này tính 1 lượt cho mọi nhân sự
// có ca dạy hoặc có điểm trong tháng, để không phải gọi vòng lặp N truy vấn.
export type ScoreboardRow = {
  employeeId: string;
  fullName: string;
  employeeCode: string;
  position: string | null;
  shifts: number;
  substituteShifts: number;
  countedShifts: number;
  deducted: number;
  added: number;
  net: number;
  ratio: number | null;
  bonusPercent: number | null;
  events: {
    id: string;
    eventDate: string;
    type: string;
    points: number;
    reason: string | null;
    branchId: string;
    branchName: string;
    /** true = điểm sinh tự động từ việc không nộp bài tập buổi học (không sửa tay ở đây). */
    fromRequirement: boolean;
  }[];
};

export async function computeMonthlyScoreboard(params: { branchId: string | null; month: string }) {
  const { branchId, month } = params;
  const { start, end } = monthRange(month);
  const employeeWhere = branchId ? { branchId, workStatus: "ACTIVE" } : { workStatus: "ACTIVE" };

  const [assignments, events, bonuses, employees] = await Promise.all([
    prisma.sessionAssignment.findMany({
      where: {
        role: { in: ["TEACHER", "ASSISTANT", "ASSISTANT2"] },
        session: { sessionDate: { gte: start, lte: end } },
        employee: employeeWhere,
      },
      select: { employeeId: true, isSubstituteShift: true },
    }),
    prisma.assistantScoreEvent.findMany({
      where: { eventDate: { gte: start, lte: end }, employee: employeeWhere },
      include: { branch: { select: { name: true } }, requirementCheck: { select: { id: true } } },
      orderBy: { eventDate: "desc" },
    }),
    prisma.assistantMonthlyBonus.findMany({ where: { month, employee: employeeWhere } }),
    prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true, fullName: true, employeeCode: true, position: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const rows = new Map<string, ScoreboardRow>();
  const ensure = (employeeId: string) => {
    let row = rows.get(employeeId);
    if (!row) {
      const employee = employees.find((item) => item.id === employeeId);
      row = {
        employeeId,
        fullName: employee?.fullName ?? "Nhân sự đã xóa",
        employeeCode: employee?.employeeCode ?? "—",
        position: employee?.position ?? null,
        shifts: 0,
        substituteShifts: 0,
        countedShifts: 0,
        deducted: 0,
        added: 0,
        net: 0,
        ratio: null,
        bonusPercent: null,
        events: [],
      };
      rows.set(employeeId, row);
    }
    return row;
  };

  for (const assignment of assignments) {
    const row = ensure(assignment.employeeId);
    row.shifts += 1;
    if (assignment.isSubstituteShift) row.substituteShifts += 1;
  }
  for (const event of events) {
    const row = ensure(event.employeeId);
    if (event.type === "DEDUCT") row.deducted += event.points;
    else row.added += event.points;
    row.events.push({
      id: event.id,
      eventDate: event.eventDate.toISOString(),
      type: event.type,
      points: event.points,
      reason: event.reason,
      branchId: event.branchId,
      branchName: event.branch.name,
      fromRequirement: Boolean(event.requirementCheck),
    });
  }
  for (const bonus of bonuses) {
    const row = rows.get(bonus.employeeId);
    if (row) row.bonusPercent = bonus.bonusPercent;
  }

  const list = [...rows.values()].map((row) => {
    const countedShifts = row.shifts - row.substituteShifts;
    return {
      ...row,
      countedShifts,
      net: Math.round((row.added - row.deducted) * 100) / 100,
      ratio: computeScoreRatio(row.deducted, row.added, countedShifts),
    };
  });
  list.sort((a, b) => b.deducted - a.deducted || a.fullName.localeCompare(b.fullName, "vi"));

  return {
    month,
    rows: list,
    allEmployees: employees.map((item) => ({ id: item.id, fullName: item.fullName, employeeCode: item.employeeCode, position: item.position })),
    totals: {
      shifts: list.reduce((sum, row) => sum + row.shifts, 0),
      countedShifts: list.reduce((sum, row) => sum + row.countedShifts, 0),
      deducted: Math.round(list.reduce((sum, row) => sum + row.deducted, 0) * 100) / 100,
      added: Math.round(list.reduce((sum, row) => sum + row.added, 0) * 100) / 100,
      peopleDeducted: list.filter((row) => row.deducted > 0).length,
    },
  };
}
