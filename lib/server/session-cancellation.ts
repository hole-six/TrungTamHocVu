import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeSessionNumbers } from "@/lib/session-numbering";
import { dateKey, generateSessionDates, getVietnamToday } from "@/lib/server/class-rules";
import { getHolidayDateSet } from "@/lib/server/holidays";
import { createSessionsInRange } from "@/lib/server/class-generation";
import { computeHoursFromTimeRange } from "@/lib/server/payroll-rules";
import { assignmentRoleType } from "@/lib/assignment-roles";

// TRUNG TÂM CHO NGHỈ — một buổi lẻ hoặc cả ngày nghỉ của trung tâm (lễ, bão...).
//
// Hệ quả cần giữ đúng (xem lib/session-numbering.ts): buổi nghỉ không có số trong lộ trình, các
// buổi sau DỒN LÊN học tài liệu của buổi nghỉ, nên khóa học cần thêm đúng bấy nhiêu buổi ở
// cuối. Ngược lại, bỏ cho nghỉ (xóa ngày nghỉ) thì các buổi vừa nối thêm ở cuối phải bỏ đi.
//
// Không cho nghỉ LÙI một buổi đã qua mà sau nó đã có buổi dạy thật: làm vậy các buổi đã dạy
// bị đổi số → đổi tài liệu, lịch sử học tập hiện sai bài.

type Db = PrismaClient | Prisma.TransactionClient;

const SESSION_SELECT = { id: true, sessionDate: true, startTime: true, status: true, replacesSessionId: true } as const;

/** Buổi đã dạy nằm SAU buổi này trong lộ trình (không cho nghỉ lùi). */
export async function countTaughtSessionsAfter(db: Db, session: { id: string; classId: string; sessionDate: Date; startTime: string | null }) {
  return db.classSession.count({
    where: {
      classId: session.classId,
      id: { not: session.id },
      status: "COMPLETED",
      OR: [
        { sessionDate: { gt: session.sessionDate } },
        { sessionDate: session.sessionDate, startTime: { gt: session.startTime ?? "" } },
      ],
    },
  });
}

/** Trả lại buổi bổ trợ đã đặt học bù vào buổi không còn diễn ra. */
async function releasePrebookedCredits(tx: Prisma.TransactionClient, sessionId: string) {
  await tx.sessionCredit.updateMany({
    where: { consumedSessionId: sessionId, status: "CONSUMED" },
    data: { status: "AVAILABLE", consumedSessionId: null, consumedAt: null },
  });
}

/**
 * Sau khi cho nghỉ: nếu lịch của lớp ĐÃ sinh tới buổi cuối khóa thì nối thêm đúng số buổi còn
 * thiếu theo lịch cố định (bỏ ngày nghỉ). Lớp chưa sinh hết lịch thì để đợt sinh lịch tự động
 * lo như thường — không sinh trước cả khóa chỉ vì một buổi nghỉ.
 */
export async function extendScheduleAfterCancellation(classId: string, cancelledCount: number) {
  if (cancelledCount <= 0) return { created: 0 };
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { totalSessions: true, branchId: true, status: true, isRemedial: true, scheduleRules: { where: { isActive: true } }, sessions: { select: SESSION_SELECT } },
  });
  if (!cls || !cls.totalSessions || cls.isRemedial || cls.status !== "ACTIVE" || cls.scheduleRules.length === 0) return { created: 0 };
  const { count } = computeSessionNumbers(cls.sessions);
  const missing = cls.totalSessions - count;
  // Trước khi nghỉ đã đủ (count + số buổi vừa nghỉ >= tổng) thì mới là "lớp đã sinh tới cuối".
  if (missing <= 0 || count + cancelledCount < cls.totalSessions) return { created: 0 };

  const last = cls.sessions.reduce<Date | null>((max, s) => (!max || s.sessionDate > max ? s.sessionDate : max), null);
  if (!last) return { created: 0 };
  const holidays = await getHolidayDateSet(cls.branchId);
  const from = new Date(last.getTime() + 86_400_000);
  const slots = generateSessionDates(cls.scheduleRules, from, new Date(from.getTime() + 366 * 86_400_000), holidays).slice(0, missing);
  if (slots.length === 0) return { created: 0 };
  const result = await createSessionsInRange(classId, slots[0].sessionDate, slots[slots.length - 1].sessionDate);
  return { created: result.created };
}

/**
 * Sau khi bỏ cho nghỉ: lịch có thể dư buổi ở cuối (buổi đã nối thêm lúc cho nghỉ). Bỏ các buổi
 * CUỐI CÙNG chưa diễn ra, chưa có dữ liệu gì (điểm danh, nhật ký, dời lịch, học bù, ví) cho tới
 * khi đúng tổng số buổi của khóa.
 */
export async function trimExcessUpcomingSessions(classId: string) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { totalSessions: true, sessions: { select: SESSION_SELECT } },
  });
  if (!cls?.totalSessions) return { removed: 0 };
  let excess = computeSessionNumbers(cls.sessions).count - cls.totalSessions;
  if (excess <= 0) return { removed: 0 };

  const candidates = await prisma.classSession.findMany({
    where: {
      classId,
      status: "PLANNED",
      sessionDate: { gte: getVietnamToday() },
      replacesSessionId: null,
      replacedBySession: { is: null },
      attendances: { none: {} },
      journal: { is: null },
      walletTxns: { none: {} },
      creditsRedeemedHere: { none: {} },
      creditsFromAbsence: { none: {} },
      assignments: { none: { OR: [{ checkInAt: { not: null } }, { substituteForId: { not: null } }] } },
    },
    orderBy: [{ sessionDate: "desc" }, { startTime: "desc" }],
    select: { id: true },
  });
  let removed = 0;
  for (const candidate of candidates) {
    if (excess <= 0) break;
    await prisma.classSession.delete({ where: { id: candidate.id } });
    excess -= 1;
    removed += 1;
  }
  return { removed };
}

// ---------------------------------------------------------------------------------
// NGÀY NGHỈ CỦA TRUNG TÂM
// ---------------------------------------------------------------------------------

export type ClosureItem = {
  sessionId: string;
  classId: string;
  classCode: string;
  className: string;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  action: "CANCEL" | "SKIP";
  reason: string | null;
  /** Số giờ của ca (theo khung giờ buổi học) — để đối soát công/giờ dạy khi cho nghỉ. */
  hours: number;
  teachers: string[];
  assistants: string[];
};

/** Giờ nghỉ cộng dồn của từng GV/TG trong đợt cho nghỉ này. */
export type ClosureStaffHours = {
  employeeId: string;
  fullName: string;
  role: "TEACHER" | "ASSISTANT";
  sessions: number;
  hours: number;
};

function toDates(keys: string[]) {
  return [...new Set(keys.filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)))].sort().map((k) => new Date(`${k}T00:00:00.000Z`));
}

/** Xem trước: các buổi học rơi vào những ngày nghỉ đã chọn sẽ bị cho nghỉ hay bỏ qua (kèm lý do). */
export async function planHolidayClosure(db: Db, params: { branchId: string; dateKeys: string[] }) {
  const dates = toDates(params.dateKeys);
  if (dates.length === 0)
    return { dates: [] as string[], items: [] as ClosureItem[], cancelCount: 0, classCount: 0, totalHours: 0, staffHours: [] as ClosureStaffHours[] };
  const sessions = await db.classSession.findMany({
    where: { sessionDate: { in: dates }, status: { notIn: ["CANCELLED", "RESCHEDULED"] }, class: { branchId: params.branchId } },
    include: {
      class: { select: { id: true, classCode: true, className: true } },
      // Ai đứng lớp buổi này — để bảng xem trước ghi rõ GV/TG nào nghỉ mấy giờ. Người đã có
      // người dạy thay thì không tính (họ vốn không dạy buổi đó).
      assignments: {
        where: { substitutedBy: { is: null } },
        include: { employee: { select: { id: true, fullName: true } } },
        orderBy: [{ role: "asc" }, { employeeId: "asc" }],
      },
    },
    orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
  });
  const items: ClosureItem[] = [];
  const staffHours = new Map<string, ClosureStaffHours>();
  for (const session of sessions) {
    const hours =
      session.startTime && session.endTime ? computeHoursFromTimeRange(session.startTime, session.endTime) : 0;
    const teachers = session.assignments.filter((a) => assignmentRoleType(a.role) === "TEACHER");
    const assistants = session.assignments.filter((a) => assignmentRoleType(a.role) === "ASSISTANT");
    const base = {
      sessionId: session.id,
      classId: session.class.id,
      classCode: session.class.classCode,
      className: session.class.className,
      sessionDate: session.sessionDate.toISOString(),
      startTime: session.startTime,
      endTime: session.endTime,
      hours,
      teachers: teachers.map((a) => a.employee.fullName),
      assistants: assistants.map((a) => a.employee.fullName),
    };
    if (session.status === "COMPLETED") {
      items.push({ ...base, action: "SKIP", reason: "Buổi đã dạy (đã điểm danh) — giữ nguyên." });
      continue;
    }
    if ((await countTaughtSessionsAfter(db, session)) > 0) {
      items.push({ ...base, action: "SKIP", reason: "Sau buổi này lớp đã có buổi dạy — không cho nghỉ lùi được." });
      continue;
    }
    items.push({ ...base, action: "CANCEL", reason: null });
    for (const assignment of session.assignments) {
      const role = assignmentRoleType(assignment.role);
      if (!role) continue;
      const current = staffHours.get(assignment.employeeId) ?? {
        employeeId: assignment.employeeId,
        fullName: assignment.employee.fullName,
        role,
        sessions: 0,
        hours: 0,
      };
      current.sessions += 1;
      current.hours = Math.round((current.hours + hours) * 100) / 100;
      staffHours.set(assignment.employeeId, current);
    }
  }
  const cancel = items.filter((i) => i.action === "CANCEL");
  return {
    dates: dates.map(dateKey),
    items,
    cancelCount: cancel.length,
    classCount: new Set(cancel.map((i) => i.classId)).size,
    totalHours: Math.round(cancel.reduce((sum, item) => sum + item.hours, 0) * 100) / 100,
    staffHours: [...staffHours.values()].sort((a, b) => b.hours - a.hours || a.fullName.localeCompare(b.fullName, "vi")),
  };
}

/** Khai ngày nghỉ + cho nghỉ mọi buổi học rơi vào những ngày đó, rồi nối thêm buổi ở cuối khóa. */
export async function applyHolidayClosure(params: { branchId: string; dateKeys: string[]; name: string }) {
  const name = params.name.trim();
  const result = await prisma.$transaction(async (tx) => {
    const plan = await planHolidayClosure(tx, params);
    const holidayByDate = new Map<string, string>();
    for (const key of plan.dates) {
      const date = new Date(`${key}T00:00:00.000Z`);
      const holiday = await tx.holiday.upsert({
        where: { branchId_date: { branchId: params.branchId, date } },
        create: { branchId: params.branchId, date, name },
        update: { name },
      });
      holidayByDate.set(key, holiday.id);
    }
    const cancelledPerClass = new Map<string, number>();
    for (const item of plan.items) {
      if (item.action !== "CANCEL") continue;
      await releasePrebookedCredits(tx, item.sessionId);
      await tx.classSession.update({
        where: { id: item.sessionId },
        data: {
          status: "CANCELLED",
          completedAt: null,
          notes: `Trung tâm nghỉ: ${name}`,
          cancelledByHolidayId: holidayByDate.get(item.sessionDate.slice(0, 10)) ?? null,
        },
      });
      cancelledPerClass.set(item.classId, (cancelledPerClass.get(item.classId) ?? 0) + 1);
    }
    return { plan, cancelledPerClass };
  });

  let extended = 0;
  for (const [classId, cancelled] of result.cancelledPerClass) {
    extended += (await extendScheduleAfterCancellation(classId, cancelled)).created;
  }
  return { ...result.plan, extended };
}

/** Xóa 1 ngày nghỉ: khôi phục các buổi đã cho nghỉ vì ngày đó rồi bỏ buổi nối thêm ở cuối khóa. */
export async function removeHolidayAndRestore(holidayId: string) {
  const sessions = await prisma.classSession.findMany({
    where: { cancelledByHolidayId: holidayId, status: "CANCELLED" },
    select: { id: true, classId: true },
  });
  await prisma.$transaction(async (tx) => {
    for (const session of sessions) {
      await tx.classSession.update({
        where: { id: session.id },
        data: { status: "PLANNED", notes: null, cancelledByHolidayId: null },
      });
    }
    await tx.holiday.delete({ where: { id: holidayId } });
  });
  let removed = 0;
  for (const classId of new Set(sessions.map((s) => s.classId))) {
    removed += (await trimExcessUpcomingSessions(classId)).removed;
  }
  return { restored: sessions.length, removed };
}
