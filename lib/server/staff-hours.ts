import { prisma } from "@/lib/prisma";
import { monthRange } from "@/lib/server/tuition-rules";
import { computeHoursFromTimeRange } from "@/lib/server/payroll-rules";
import { assignmentRoleType } from "@/lib/assignment-roles";
import { dateKey, getVietnamToday } from "@/lib/server/class-rules";

// GIỜ DỰ KIẾN vs GIỜ THỰC TẾ của từng nhân sự, theo TUẦN và theo THÁNG.
//
// Dùng để: (1) đối soát công — vì sao tuần này làm ít/nhiều hơn dự kiến; (2) tối ưu người
// fulltime — ai đang trống lịch, chưa đủ định mức giờ hợp đồng thì xếp thêm lớp thay vì
// thuê ngoài.
//
// GIỜ DỰ KIẾN = giờ của các buổi ĐÃ PHÂN CÔNG cho người đó theo thời khóa biểu, tính theo
// khung giờ buổi học (17:30–19:00 = 1,5h), GỒM CẢ buổi sau đó trung tâm cho nghỉ — giữ lại
// mới giải thích được vì sao thực tế hụt giờ. Không tính:
//   - buổi đã dời lịch (buổi bù đã thay chỗ, giờ tính vào ngày bù);
//   - phân công đã có người dạy thay (người đó không đứng lớp buổi ấy).
// GIỜ THỰC TẾ = giờ của các buổi ĐÃ DẠY (COMPLETED) + giờ hành chính đã chấm công.
//
// Chênh lệch luôn giải thích được bằng: giờ trung tâm cho nghỉ, giờ các buổi chưa tới ngày
// dạy, giờ dạy thay (phát sinh thêm), và giờ buổi đã qua mà chưa điểm danh.

export type HoursBucket = {
  plannedHours: number;
  plannedSessions: number;
  actualHours: number;
  actualSessions: number;
  cancelledHours: number;
  cancelledSessions: number;
  upcomingHours: number;
  upcomingSessions: number;
  substituteHours: number;
  substituteSessions: number;
  adminHours: number;
  adminDays: number;
};

export type StaffWeek = HoursBucket & {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  note: string | null;
};

export type StaffHoursRow = HoursBucket & {
  employeeId: string;
  fullName: string;
  employeeCode: string;
  position: string | null;
  payMode: string;
  branchName: string | null;
  contractHoursPerMonth: number | null;
  note: string | null;
  weeks: StaffWeek[];
};

const round2 = (value: number) => Math.round(value * 100) / 100;

function emptyBucket(): HoursBucket {
  return {
    plannedHours: 0,
    plannedSessions: 0,
    actualHours: 0,
    actualSessions: 0,
    cancelledHours: 0,
    cancelledSessions: 0,
    upcomingHours: 0,
    upcomingSessions: 0,
    substituteHours: 0,
    substituteSessions: 0,
    adminHours: 0,
    adminDays: 0,
  };
}

function roundBucket<T extends HoursBucket>(bucket: T): T {
  return {
    ...bucket,
    plannedHours: round2(bucket.plannedHours),
    actualHours: round2(bucket.actualHours),
    cancelledHours: round2(bucket.cancelledHours),
    upcomingHours: round2(bucket.upcomingHours),
    substituteHours: round2(bucket.substituteHours),
    adminHours: round2(bucket.adminHours),
    adminDays: round2(bucket.adminDays),
  };
}

/** Thứ Hai của tuần chứa ngày này (tuần bắt đầu từ thứ Hai). */
export function weekStartOf(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const shift = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - shift);
  return start;
}

function vn(date: Date) {
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
}

/** Các tuần (thứ Hai → Chủ nhật) có giao với tháng này. */
export function weeksOfMonth(month: string) {
  const { start, end } = monthRange(month);
  const weeks: { key: string; label: string; start: Date; end: Date }[] = [];
  for (let cursor = weekStartOf(start); cursor <= end; cursor = new Date(cursor.getTime() + 7 * 86_400_000)) {
    const weekEnd = new Date(cursor.getTime() + 6 * 86_400_000);
    weeks.push({ key: dateKey(cursor), label: `${vn(cursor)} – ${vn(weekEnd)}`, start: new Date(cursor), end: weekEnd });
  }
  return weeks;
}

export async function computeStaffHours(params: { month: string; branchId: string | null }) {
  const { month, branchId } = params;
  const { start, end } = monthRange(month);
  const today = getVietnamToday();
  const employeeWhere = { workStatus: "ACTIVE", ...(branchId ? { branchId } : {}) };

  const [employees, assignments, timesheets, notes] = await Promise.all([
    prisma.employee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        position: true,
        payMode: true,
        contractHoursPerMonth: true,
        branch: { select: { name: true } },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.sessionAssignment.findMany({
      where: {
        employee: employeeWhere,
        substitutedBy: { is: null },
        session: { sessionDate: { gte: start, lte: end }, status: { not: "RESCHEDULED" } },
      },
      select: {
        employeeId: true,
        role: true,
        isSubstituteShift: true,
        substituteForId: true,
        session: { select: { sessionDate: true, startTime: true, endTime: true, status: true } },
      },
    }),
    prisma.timesheetEntry.findMany({
      where: { employee: employeeWhere, workDate: { gte: start, lte: end } },
      select: { employeeId: true, workDate: true, hours: true, days: true },
    }),
    prisma.staffHoursNote.findMany({ where: { employee: employeeWhere } }),
  ]);

  const weeks = weeksOfMonth(month);
  const noteByKey = new Map(notes.map((item) => [`${item.employeeId}|${item.periodKey}`, item.note]));

  const rows = new Map<string, StaffHoursRow>();
  for (const employee of employees) {
    rows.set(employee.id, {
      ...emptyBucket(),
      employeeId: employee.id,
      fullName: employee.fullName,
      employeeCode: employee.employeeCode,
      position: employee.position,
      payMode: employee.payMode,
      branchName: employee.branch?.name ?? null,
      contractHoursPerMonth: employee.contractHoursPerMonth,
      note: noteByKey.get(`${employee.id}|${month}`) ?? null,
      weeks: weeks.map((week) => ({
        ...emptyBucket(),
        key: week.key,
        label: week.label,
        startDate: dateKey(week.start),
        endDate: dateKey(week.end),
        note: noteByKey.get(`${employee.id}|${week.key}`) ?? null,
      })),
    });
  }

  for (const assignment of assignments) {
    const row = rows.get(assignment.employeeId);
    if (!row) continue;
    if (!assignmentRoleType(assignment.role)) continue;
    const session = assignment.session;
    const hours = session.startTime && session.endTime ? computeHoursFromTimeRange(session.startTime, session.endTime) : 0;
    const week = row.weeks.find((item) => item.key === dateKey(weekStartOf(session.sessionDate)));
    const isSubstitute = assignment.isSubstituteShift || assignment.substituteForId != null;

    const apply = (bucket: HoursBucket) => {
      bucket.plannedHours += hours;
      bucket.plannedSessions += 1;
      if (session.status === "CANCELLED") {
        bucket.cancelledHours += hours;
        bucket.cancelledSessions += 1;
      } else if (session.status === "COMPLETED") {
        bucket.actualHours += hours;
        bucket.actualSessions += 1;
      } else if (session.sessionDate >= today) {
        bucket.upcomingHours += hours;
        bucket.upcomingSessions += 1;
      }
      if (isSubstitute) {
        bucket.substituteHours += hours;
        bucket.substituteSessions += 1;
      }
    };
    apply(row);
    if (week) apply(week);
  }

  for (const entry of timesheets) {
    const row = rows.get(entry.employeeId);
    if (!row) continue;
    const week = row.weeks.find((item) => item.key === dateKey(weekStartOf(entry.workDate)));
    const apply = (bucket: HoursBucket) => {
      bucket.adminHours += entry.hours ?? 0;
      bucket.adminDays += entry.days ?? 0;
    };
    apply(row);
    if (week) apply(week);
  }

  return {
    month,
    weeks: weeks.map((week) => ({
      key: week.key,
      label: week.label,
      startDate: dateKey(week.start),
      endDate: dateKey(week.end),
    })),
    rows: [...rows.values()]
      .map((row) => ({ ...roundBucket(row), weeks: row.weeks.map(roundBucket) }))
      .sort((a, b) => b.plannedHours - a.plannedHours || a.fullName.localeCompare(b.fullName, "vi")),
  };
}

/** Câu giải thích tự động cho chênh lệch dự kiến − thực tế (người dùng vẫn ghi chú thêm được). */
export function explainHoursGap(bucket: HoursBucket): string {
  const parts: string[] = [];
  if (bucket.cancelledHours > 0) parts.push(`trung tâm cho nghỉ ${round2(bucket.cancelledHours)}h`);
  if (bucket.upcomingHours > 0) parts.push(`chưa tới ngày dạy ${round2(bucket.upcomingHours)}h`);
  if (bucket.substituteHours > 0) parts.push(`dạy thay ${round2(bucket.substituteHours)}h`);
  const unexplained = round2(bucket.plannedHours - bucket.actualHours - bucket.cancelledHours - bucket.upcomingHours);
  if (unexplained > 0) parts.push(`buổi đã qua chưa điểm danh ${unexplained}h`);
  return parts.join(" · ");
}
