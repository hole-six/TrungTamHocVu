// ĐÁNH GIÁ THƯỞNG/PHẠT THÁNG cho trợ giảng & giáo viên — theo "QUY CHẾ THƯỞNG PHẠT CHO TRỢ
// GIẢNG (áp dụng từ tháng 4/2025)".
//
// GỘP TOÀN BỘ CƠ SỞ: tổng số ca, số lần bị nhắc, điểm cộng/trừ của một người được cộng ở MỌI
// cơ sở rồi mới xét thưởng phạt — yêu cầu của chủ trung tâm (trước đây hệ thống tách riêng
// từng cơ sở). Bảng theo cơ sở vẫn giữ để xem người đó làm ở đâu, nhưng không dùng để tính.
//
// Cách tính (chi tiết ở lib/assistant-rating.ts):
//   - Tổng số ca = ca ĐÃ DẠY trong tháng, TÍNH CẢ ca dạy lớp bổ trợ (vẫn là đứng lớp dạy
//     thật). Chỉ KHÔNG tính ca dạy thay, vì ca đó đã có điểm cộng riêng "dạy thay hộ +1/ca".
//   - Số lần bị nhắc = số lần bị trừ điểm/nhắc tên trong các báo cáo (mỗi lần 1, không phải
//     số điểm trừ).
//   - A = số lần nhắc ÷ tổng số ca × 100 → mức đề xuất +20% / +10% / 0% / −5%, trần +5% nếu
//     5 < số ca < 15, và −10% nếu 1 nội dung bị nhắc ở cả 3 báo cáo.
//   - Điểm cộng tự động: dạy thay hộ +1/ca; 22–26 ca +1, 27–37 ca +2, trên 37 ca +3.
// Mức cuối cùng do người phụ trách CHỐT (EmployeeMonthlyRating) — hệ thống chỉ đề xuất.

import { prisma } from "@/lib/prisma";
import { monthRange } from "@/lib/server/tuition-rules";
import { shiftTierPoints, suggestBonusPercent, type RatingSuggestion } from "@/lib/assistant-rating";

const SCORE_ROLES = ["TEACHER", "ASSISTANT", "ASSISTANT2"];

export type BranchTally = {
  branchId: string;
  branchName: string;
  shifts: number;
  substituteShifts: number;
  countedShifts: number;
  deducted: number;
  added: number;
};

/** Tỉ lệ A theo quy chế: số LẦN bị nhắc trên tổng số ca (không phải số điểm trừ). */
export function computeScoreRatio(reminderCount: number, countedShifts: number): number | null {
  if (countedShifts <= 0) return null;
  return (reminderCount / countedShifts) * 100;
}

type ShiftRow = {
  employeeId: string;
  isSubstituteShift: boolean;
  substituteForId: string | null;
  session: { class: { branchId: string; branch: { name: string } } };
};

/**
 * Ca được tính vào quy chế: đã dạy thật, không phải ca dạy thay.
 * Ca ở lớp bổ trợ VẪN TÍNH — chủ trung tâm chốt: dạy bổ trợ cũng là đứng lớp dạy.
 */
function isCountedShift(shift: ShiftRow) {
  return !shift.isSubstituteShift && shift.substituteForId === null;
}

export async function computeAssistantScorecard(employeeId: string, month: string) {
  const { start, end } = monthRange(month);

  const [shifts, scoreEvents, rating] = await Promise.all([
    prisma.sessionAssignment.findMany({
      where: {
        employeeId,
        role: { in: SCORE_ROLES },
        substitutedBy: { is: null },
        session: { sessionDate: { gte: start, lte: end }, status: "COMPLETED" },
      },
      select: {
        employeeId: true,
        isSubstituteShift: true,
        substituteForId: true,
        session: { select: { class: { select: { branchId: true, branch: { select: { name: true } } } } } },
      },
    }),
    prisma.assistantScoreEvent.findMany({
      where: { employeeId, eventDate: { gte: start, lte: end } },
      include: { branch: true },
      orderBy: { eventDate: "asc" },
    }),
    prisma.employeeMonthlyRating.findUnique({ where: { employeeId_month: { employeeId, month } } }),
  ]);

  const branchTally = new Map<string, BranchTally>();
  const ensure = (branchId: string, branchName: string) => {
    let tally = branchTally.get(branchId);
    if (!tally) {
      tally = { branchId, branchName, shifts: 0, substituteShifts: 0, countedShifts: 0, deducted: 0, added: 0 };
      branchTally.set(branchId, tally);
    }
    return tally;
  };

  for (const shift of shifts) {
    const branch = shift.session.class.branch;
    const tally = ensure(shift.session.class.branchId, branch.name);
    tally.shifts += 1;
    if (!isCountedShift(shift)) tally.substituteShifts += 1;
    else tally.countedShifts += 1;
  }
  for (const event of scoreEvents) {
    const tally = ensure(event.branchId, event.branch.name);
    if (event.type === "DEDUCT") tally.deducted += event.points;
    else tally.added += event.points;
  }

  const deductEvents = scoreEvents.filter((event) => event.type === "DEDUCT");
  const totalShifts = shifts.length;
  const countedShifts = shifts.filter(isCountedShift).length;
  const coverShifts = totalShifts - countedShifts;
  const reminderCount = deductEvents.length;
  const tripleReported = deductEvents.some((event) => event.tripleReported);
  const suggestion = suggestBonusPercent({ countedShifts, reminderCount, tripleReported });

  return {
    byBranch: [...branchTally.values()],
    totalShifts,
    countedShifts,
    coverShifts,
    reminderCount,
    tripleReported,
    totalDeducted: Math.round(scoreEvents.filter((e) => e.type === "DEDUCT").reduce((sum, e) => sum + e.points, 0) * 100) / 100,
    totalAdded: Math.round(scoreEvents.filter((e) => e.type !== "DEDUCT").reduce((sum, e) => sum + e.points, 0) * 100) / 100,
    autoPoints: { cover: coverShifts, shiftTier: shiftTierPoints(countedShifts) },
    ratio: suggestion.ratio,
    suggestion,
    rating: rating ? { bonusPercent: rating.bonusPercent, notes: rating.notes } : null,
    scoreEvents,
  };
}

// ---------------------------------------------------------------------------------
// BẢNG ĐIỂM THÁNG — 1 lượt truy vấn cho mọi nhân sự (trang chấm điểm tích cực).
// Lọc theo cơ sở chỉ để CHỌN NGƯỜI hiện trong bảng; số ca và điểm của mỗi người vẫn cộng
// ở mọi cơ sở, đúng nguyên tắc gộp toàn hệ thống.

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
  reminderCount: number;
  tripleReported: boolean;
  /** Số lỗi trừ điểm CHƯA ghi nhận khắc phục — việc còn treo với nhân sự đó. */
  unresolvedCount: number;
  ratio: number | null;
  autoPoints: { cover: number; shiftTier: number };
  suggestedPercent: number | null;
  suggestionReasons: string[];
  bonusPercent: number | null;
  events: {
    id: string;
    eventDate: string;
    type: string;
    points: number;
    reason: string | null;
    branchId: string;
    branchName: string;
    tripleReported: boolean;
    /** true = điểm sinh tự động từ việc không nộp bài tập buổi học (không sửa tay ở đây). */
    fromRequirement: boolean;
    // Chi tiết để ĐỐI SOÁT với nhân sự: lỗi xảy ra lúc nào, lớp nào, hạn — thực tế —
    // chậm bao lâu, đã khắc phục lúc nào (xem lib/score-event-detail.ts).
    occurredAt: string | null;
    classId: string | null;
    className: string | null;
    dueAt: string | null;
    completedAt: string | null;
    resolvedAt: string | null;
    resolvedNote: string | null;
  }[];
};

export async function computeMonthlyScoreboard(params: { branchId: string | null; month: string }) {
  const { branchId, month } = params;
  const { start, end } = monthRange(month);
  const employeeWhere = branchId ? { branchId, workStatus: "ACTIVE" } : { workStatus: "ACTIVE" };

  const employees = await prisma.employee.findMany({
    where: employeeWhere,
    select: { id: true, fullName: true, employeeCode: true, position: true },
    orderBy: { fullName: "asc" },
  });
  const employeeIds = employees.map((item) => item.id);

  const [shifts, events, ratings] = await Promise.all([
    prisma.sessionAssignment.findMany({
      where: {
        employeeId: { in: employeeIds },
        role: { in: SCORE_ROLES },
        substitutedBy: { is: null },
        session: { sessionDate: { gte: start, lte: end }, status: "COMPLETED" },
      },
      select: {
        employeeId: true,
        isSubstituteShift: true,
        substituteForId: true,
        session: { select: { class: { select: { branchId: true, branch: { select: { name: true } } } } } },
      },
    }),
    prisma.assistantScoreEvent.findMany({
      where: { eventDate: { gte: start, lte: end }, employeeId: { in: employeeIds } },
      include: {
        branch: { select: { name: true } },
        requirementCheck: { select: { id: true } },
        class: { select: { className: true, classCode: true } },
      },
      orderBy: { eventDate: "desc" },
    }),
    prisma.employeeMonthlyRating.findMany({ where: { month, employeeId: { in: employeeIds } } }),
  ]);

  const rows = new Map<string, ScoreboardRow>();
  for (const employee of employees) {
    rows.set(employee.id, {
      employeeId: employee.id,
      fullName: employee.fullName,
      employeeCode: employee.employeeCode,
      position: employee.position,
      shifts: 0,
      substituteShifts: 0,
      countedShifts: 0,
      deducted: 0,
      added: 0,
      net: 0,
      reminderCount: 0,
      tripleReported: false,
      unresolvedCount: 0,
      ratio: null,
      autoPoints: { cover: 0, shiftTier: 0 },
      suggestedPercent: null,
      suggestionReasons: [],
      bonusPercent: null,
      events: [],
    });
  }

  for (const shift of shifts) {
    const row = rows.get(shift.employeeId);
    if (!row) continue;
    row.shifts += 1;
    if (isCountedShift(shift)) row.countedShifts += 1;
    else row.substituteShifts += 1;
  }
  for (const event of events) {
    const row = rows.get(event.employeeId);
    if (!row) continue;
    if (event.type === "DEDUCT") {
      row.deducted += event.points;
      row.reminderCount += 1;
      if (!event.resolvedAt) row.unresolvedCount += 1;
      if (event.tripleReported) row.tripleReported = true;
    } else {
      row.added += event.points;
    }
    row.events.push({
      id: event.id,
      eventDate: event.eventDate.toISOString(),
      type: event.type,
      points: event.points,
      reason: event.reason,
      branchId: event.branchId,
      branchName: event.branch.name,
      tripleReported: event.tripleReported,
      fromRequirement: Boolean(event.requirementCheck),
      occurredAt: event.occurredAt?.toISOString() ?? null,
      classId: event.classId,
      className: event.class ? `${event.class.className}` : null,
      dueAt: event.dueAt?.toISOString() ?? null,
      completedAt: event.completedAt?.toISOString() ?? null,
      resolvedAt: event.resolvedAt?.toISOString() ?? null,
      resolvedNote: event.resolvedNote,
    });
  }
  for (const rating of ratings) {
    const row = rows.get(rating.employeeId);
    if (row) row.bonusPercent = rating.bonusPercent;
  }

  const list = [...rows.values()].map((row) => {
    const suggestion: RatingSuggestion = suggestBonusPercent({
      countedShifts: row.countedShifts,
      reminderCount: row.reminderCount,
      tripleReported: row.tripleReported,
    });
    return {
      ...row,
      deducted: Math.round(row.deducted * 100) / 100,
      added: Math.round(row.added * 100) / 100,
      net: Math.round((row.added - row.deducted) * 100) / 100,
      ratio: suggestion.ratio,
      autoPoints: { cover: row.substituteShifts, shiftTier: shiftTierPoints(row.countedShifts) },
      suggestedPercent: suggestion.percent,
      suggestionReasons: suggestion.reasons,
    };
  });
  list.sort((a, b) => b.deducted - a.deducted || a.fullName.localeCompare(b.fullName, "vi"));

  return {
    month,
    rows: list,
    allEmployees: employees.map((item) => ({ id: item.id, fullName: item.fullName, employeeCode: item.employeeCode, position: item.position })),
    totals: {
      unresolved: list.reduce((sum, row) => sum + row.unresolvedCount, 0),
      shifts: list.reduce((sum, row) => sum + row.shifts, 0),
      countedShifts: list.reduce((sum, row) => sum + row.countedShifts, 0),
      deducted: Math.round(list.reduce((sum, row) => sum + row.deducted, 0) * 100) / 100,
      added: Math.round(list.reduce((sum, row) => sum + row.added, 0) * 100) / 100,
      peopleDeducted: list.filter((row) => row.deducted > 0).length,
    },
  };
}
