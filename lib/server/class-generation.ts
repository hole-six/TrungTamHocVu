import { prisma } from "@/lib/prisma";
import { generateSessionDates } from "@/lib/server/class-rules";
import { computeSessionBaseHours } from "@/lib/server/payroll-rules";
import { getHolidayDateSet } from "@/lib/server/holidays";

export async function createSessionsInRange(classId: string, fromDate: Date, toDate: Date) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      scheduleRules: true,
      defaultAssignments: {
        where: { isActive: true },
        include: { employee: true },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!cls) throw new Error("Không tìm thấy lớp");
  if (cls.scheduleRules.length === 0) return { created: 0, skipped: 0 };

  const holidayDates = await getHolidayDateSet(cls.branchId);
  const candidates = generateSessionDates(cls.scheduleRules, fromDate, toDate, holidayDates);

  const [existing, totalExistingCount] = await Promise.all([
    prisma.classSession.findMany({
      where: { classId, sessionDate: { gte: fromDate, lte: toDate } },
      select: { sessionDate: true },
    }),
    prisma.classSession.count({ where: { classId, status: { not: "CANCELLED" } } }),
  ]);
  const existingDates = new Set(existing.map((session) => session.sessionDate.toISOString().slice(0, 10)));
  let toCreate = candidates.filter((candidate) => !existingDates.has(candidate.sessionDate.toISOString().slice(0, 10)));

  // Lớp có totalSessions cố định thì không sinh vượt quá cam kết — cắt bớt phần dư
  // nếu cửa sổ ngày (rolling window) dài hơn cần thiết. Lớp không đặt totalSessions
  // (vd khóa bổ trợ) thì sinh tự do theo lịch, không giới hạn.
  if (cls.totalSessions != null) {
    const remainingSlots = Math.max(0, cls.totalSessions - totalExistingCount);
    toCreate = toCreate.slice(0, remainingSlots);
  }

  if (toCreate.length > 0) {
    await prisma.$transaction(
      toCreate.map((candidate) => {
        const assignments = cls.defaultAssignments.map((assignment) => {
          const hours = computeSessionBaseHours(assignment.employee.payMode, candidate.startTime, candidate.endTime);
          const hourlyRate =
            assignment.role === "TEACHER" ? assignment.employee.teachingHourlyRate ?? 0 : assignment.employee.assistantHourlyRate ?? 0;
          return {
            employeeId: assignment.employeeId,
            role: assignment.role,
            hours,
            hourlyRate,
            amount: Math.round(hours * hourlyRate),
          };
        });

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

  return { created: toCreate.length, skipped: candidates.length - toCreate.length };
}

const MAX_SPAN_MS = 1000 * 60 * 60 * 24 * 120;

export async function computeAutoSessionWindow(
  classId: string,
  windowDays = 30,
): Promise<{ fromDate: Date; toDate: Date } | null> {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) return null;

  const [maxSession, generatedCount] = await Promise.all([
    prisma.classSession.aggregate({ where: { classId }, _max: { sessionDate: true } }),
    prisma.classSession.count({ where: { classId, status: { not: "CANCELLED" } } }),
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
  const [cls, consumed] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, select: { totalSessions: true, expectedEndDate: true } }),
    prisma.classSession.count({
      where: { classId, status: "COMPLETED", sessionDate: { gte: enrollDate } },
    }),
  ]);

  const planned = cls?.totalSessions ?? null;
  const remaining = planned !== null ? planned - consumed : null;
  const classEnded = cls?.expectedEndDate ? cls.expectedEndDate.getTime() < Date.now() : false;

  return { consumed, planned, remaining, classEnded };
}
