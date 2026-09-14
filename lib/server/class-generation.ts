import { prisma } from "@/lib/prisma";
import { generateSessionDates } from "@/lib/server/class-rules";
import { buildAssignmentPay } from "@/lib/server/class-default-assignments";
import { findStaffConflicts, describeStaffConflicts } from "@/lib/server/staff-schedule";
import { isEmployeeWorkingOn, toSessionRole } from "@/lib/assignment-roles";
import { getHolidayDateSet } from "@/lib/server/holidays";

export async function createSessionsInRange(classId: string, fromDate: Date, toDate: Date) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      scheduleRules: { where: { isActive: true } },
      defaultAssignments: {
        where: { isActive: true },
        include: { employee: true },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!cls) throw new Error("Không tìm thấy lớp");
  if (cls.scheduleRules.length === 0) return { created: 0, skipped: 0 };

  const effectiveFromDate = new Date(Math.max(fromDate.getTime(), cls.startDate?.getTime() ?? fromDate.getTime()));
  if (Number.isNaN(effectiveFromDate.getTime()) || Number.isNaN(toDate.getTime()) || effectiveFromDate > toDate) {
    return { created: 0, skipped: 0 };
  }

  const holidayDates = await getHolidayDateSet(cls.branchId);
  const candidates = generateSessionDates(cls.scheduleRules, effectiveFromDate, toDate, holidayDates);

  const [existing] = await Promise.all([
    prisma.classSession.findMany({
      where: { classId, sessionDate: { gte: effectiveFromDate, lte: toDate } },
      select: { sessionDate: true, startTime: true, endTime: true },
    }),
  ]);
  const sessionKey = (session: { sessionDate: Date; startTime: string | null; endTime: string | null }) =>
    `${session.sessionDate.toISOString().slice(0, 10)}|${session.startTime ?? ""}|${session.endTime ?? ""}`;
  const existingSessions = new Set(existing.map(sessionKey));
  let toCreate = candidates.filter((candidate) => !existingSessions.has(sessionKey(candidate)));

  // totalSessions là cam kết học phí/lộ trình gốc, không còn là trần cứng của lịch lớp.
  // Vận hành thực tế có thể kéo lớp 50 buổi thành 60 buổi để dạy cho đủ mà không tự
  // tăng học phí; tiền đã được khóa theo từng enrollment.

  let staffSkipped = 0;
  if (toCreate.length > 0) {
    // Nhân sự mặc định → phân công của từng buổi mới. Vai trò ghi xuống buổi PHẢI là
    // TEACHER/ASSISTANT/ASSISTANT2 (không chép "TEACHER_1") — xem lib/assignment-roles.ts.
    // Sinh lịch chạy tự động nên không chặn được: người đã nghỉ việc hoặc trùng lịch lớp
    // khác ở đúng khung giờ đó thì để trống vị trí ở buổi đó (hiện "Chưa có nhân sự"),
    // không xếp một người đứng 2 lớp cùng lúc.
    const plannedAssignments: Array<Array<{ employeeId: string; role: string; hours: number; hourlyRate: number; amount: number }>> = [];
    for (const candidate of toCreate) {
      const rows = [];
      for (const assignment of cls.defaultAssignments) {
        const role = toSessionRole(assignment.role);
        if (!role) continue;
        if (!isEmployeeWorkingOn(assignment.employee, candidate.sessionDate)) {
          staffSkipped += 1;
          continue;
        }
        const conflicts = await findStaffConflicts(prisma, assignment.employeeId, [candidate]);
        if (conflicts.length) {
          staffSkipped += 1;
          console.warn(`[class-generation] ${describeStaffConflicts(assignment.employee.fullName, conflicts, 1)} Bỏ trống ở buổi ${candidate.sessionDate.toISOString().slice(0, 10)} lớp ${cls.classCode}.`);
          continue;
        }
        rows.push({ employeeId: assignment.employeeId, role, ...buildAssignmentPay(role, assignment.employee, candidate) });
      }
      plannedAssignments.push(rows);
    }

    await prisma.$transaction(
      toCreate.map((candidate, index) => {
        const assignments = plannedAssignments[index];
        return prisma.classSession.create({
          data: {
            classId,
            sessionDate: candidate.sessionDate,
            startTime: candidate.startTime,
            endTime: candidate.endTime,
            room: candidate.room,
            status: "PLANNED",
            assignments: assignments.length ? { create: assignments } : undefined,
          },
        });
      }),
    );

    // Lớp bị trễ (nghỉ lễ, gián đoạn...) nên buổi mới sinh có thể rơi sau
    // expectedEndDate cũ — giãn ngày kết thúc dự kiến ra theo thực tế thay vì để nó
    // đứng yên ở ước lượng cũ không còn đúng nữa.
    const latestNewDate = toCreate[toCreate.length - 1]?.sessionDate;
    if (latestNewDate && (!cls.expectedEndDate || latestNewDate.getTime() > cls.expectedEndDate.getTime())) {
      await prisma.class.update({ where: { id: classId }, data: { expectedEndDate: latestNewDate } });
    }
  }

  return { created: toCreate.length, skipped: candidates.length - toCreate.length, staffSkipped };
}

const MAX_SPAN_MS = 1000 * 60 * 60 * 24 * 120;

export async function computeAutoSessionWindow(
  classId: string,
  windowDays = 30,
): Promise<{ fromDate: Date; toDate: Date } | null> {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) return null;

  const [maxSession, generatedCount] = await Promise.all([
    prisma.classSession.aggregate({
      where: { classId, status: { notIn: ["CANCELLED", "RESCHEDULED"] } },
      _max: { sessionDate: true },
    }),
    prisma.classSession.count({ where: { classId, status: { notIn: ["CANCELLED", "RESCHEDULED"] } } }),
  ]);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let fromDate: Date;
  if (maxSession._max.sessionDate) {
    fromDate = new Date(maxSession._max.sessionDate);
    fromDate.setUTCDate(fromDate.getUTCDate() + 1);
  } else if (cls.startDate) {
    fromDate = new Date(cls.startDate);
  } else {
    return null;
  }

  const targetToDate = new Date(today);
  targetToDate.setUTCDate(targetToDate.getUTCDate() + windowDays);

  if (fromDate.getTime() > targetToDate.getTime()) return null;

  let toDate = targetToDate;
  if (toDate.getTime() - fromDate.getTime() > MAX_SPAN_MS) {
    toDate = new Date(fromDate.getTime() + MAX_SPAN_MS);
  }

  // Chỉ chặn theo expectedEndDate khi lớp ĐÃ sinh đủ totalSessions — lớp bị trễ
  // (nghỉ lễ, gián đoạn...) mà chưa dạy đủ buổi cam kết thì vẫn phải tiếp tục sinh
  // buổi kể cả đã qua ngày dự kiến kết thúc; createSessionsInRange tự giãn
  // expectedEndDate theo buổi mới nhất, và tự cắt khi đã đủ totalSessions.
  const stillShortOfPlan = cls.totalSessions != null && generatedCount < cls.totalSessions;
  if (cls.expectedEndDate && !stillShortOfPlan && toDate.getTime() > cls.expectedEndDate.getTime()) {
    if (fromDate.getTime() > cls.expectedEndDate.getTime()) return null;
    toDate = cls.expectedEndDate;
  }

  return { fromDate, toDate };
}

export async function computeEnrollmentSessionProgress(classId: string, enrollDate: Date) {
  // enrollDate mang cả giờ-phút-giây lúc ghi danh, còn sessionDate luôn chuẩn hóa về
  // UTC-midnight (xem generateSessionDates) — so trực tiếp làm buổi học CÙNG NGÀY ghi
  // danh (nhưng ghi danh sau 00:00) bị loại nhầm khỏi tiến độ/công nợ rút học.
  const enrollDateStartOfDay = new Date(Date.UTC(enrollDate.getUTCFullYear(), enrollDate.getUTCMonth(), enrollDate.getUTCDate()));
  const [cls, consumed] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, select: { totalSessions: true, expectedEndDate: true } }),
    prisma.classSession.count({
      where: { classId, status: "COMPLETED", sessionDate: { gte: enrollDateStartOfDay } },
    }),
  ]);

  const planned = cls?.totalSessions ?? null;
  const remaining = planned !== null ? Math.max(0, planned - consumed) : null;
  const classEnded = cls?.expectedEndDate ? cls.expectedEndDate.getTime() < Date.now() : false;

  return { consumed, planned, remaining, classEnded };
}
