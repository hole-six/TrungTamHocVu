import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { estimateEndDate } from "@/lib/server/class-rules";
import { computeStockBalance } from "@/lib/server/inventory-rules";

type DbClient = Prisma.TransactionClient | typeof prisma;

function sameDateTime(left: Date | null | undefined, right: Date | null | undefined) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.getTime() === right.getTime();
}

function firstDayOfMonthUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function lastDayOfMonthUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function periodNameOf(date: Date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

function sanitizeDisplayCode(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "");
}

export async function syncClassDerivedFields(
  classId: string,
  tx: DbClient = prisma
) {
  const cls = await tx.class.findUnique({
    where: { id: classId },
    include: { course: true },
  });
  if (!cls) return null;

  const sessionsPerWeek = cls.sessionsPerWeek ?? cls.course?.sessionsPerWeek ?? null;
  const tuitionPerSession = cls.tuitionPerSession ?? cls.course?.tuitionPerSession ?? null;
  const expectedEndDate =
    cls.expectedEndDate ?? estimateEndDate(cls.startDate, cls.totalSessions, sessionsPerWeek);

  const patch: Prisma.ClassUpdateInput = {};
  if (cls.sessionsPerWeek !== sessionsPerWeek) patch.sessionsPerWeek = sessionsPerWeek;
  if (cls.tuitionPerSession !== tuitionPerSession) patch.tuitionPerSession = tuitionPerSession;
  if (!sameDateTime(cls.expectedEndDate, expectedEndDate)) patch.expectedEndDate = expectedEndDate;

  if (Object.keys(patch).length === 0) return cls;
  return tx.class.update({ where: { id: classId }, data: patch });
}

export async function syncCourseClasses(
  courseId: string,
  previousCourse: { tuitionPerSession: number; sessionsPerWeek: number } | null,
  tx: DbClient = prisma
) {
  const course = await tx.course.findUnique({ where: { id: courseId } });
  if (!course) return [];

  const classes = await tx.class.findMany({ where: { courseId } });
  const updates: Promise<unknown>[] = [];

  for (const cls of classes) {
    const patch: Prisma.ClassUpdateInput = {};

    if (
      cls.tuitionPerSession == null ||
      (previousCourse && cls.tuitionPerSession === previousCourse.tuitionPerSession)
    ) {
      patch.tuitionPerSession = course.tuitionPerSession;
    }

    let targetSessionsPerWeek = cls.sessionsPerWeek;
    if (
      cls.sessionsPerWeek == null ||
      (previousCourse && cls.sessionsPerWeek === previousCourse.sessionsPerWeek)
    ) {
      targetSessionsPerWeek = course.sessionsPerWeek;
      patch.sessionsPerWeek = course.sessionsPerWeek;
    }

    const oldDerived = estimateEndDate(cls.startDate, cls.totalSessions, cls.sessionsPerWeek);
    const shouldRefreshExpectedEndDate = !cls.expectedEndDate || sameDateTime(cls.expectedEndDate, oldDerived);
    if (shouldRefreshExpectedEndDate) {
      patch.expectedEndDate = estimateEndDate(cls.startDate, cls.totalSessions, targetSessionsPerWeek);
    }

    if (Object.keys(patch).length > 0) {
      updates.push(tx.class.update({ where: { id: cls.id }, data: patch }));
    }
  }

  return Promise.all(updates);
}

export async function syncStudentDerivedFields(
  studentId: string,
  tx: DbClient = prisma
) {
  const student = await tx.student.findUnique({
    where: { id: studentId },
    include: {
      lead: true,
      enrollments: {
        include: { class: true },
        orderBy: [{ enrollDate: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!student) return null;

  const activeEnrollment =
    student.enrollments.find((item) => item.status === "ACTIVE") ??
    student.enrollments.find((item) => item.status === "PENDING") ??
    student.enrollments.find((item) => item.status === "PAUSED") ??
    student.enrollments[0] ??
    null;

  const earliestEnrollDate = student.enrollments[0]?.enrollDate ?? student.enrollDate ?? null;
  const nextStatus = student.leaveDate ? "LEFT" : "ACTIVE";
  const nextDisplayId = activeEnrollment?.class?.classCode
    ? `${activeEnrollment.class.classCode}-${sanitizeDisplayCode(student.studentCode)}`
    : student.studentDisplayId || sanitizeDisplayCode(student.studentCode);

  const patch: Prisma.StudentUpdateInput = {};
  if (student.status !== nextStatus) patch.status = nextStatus;
  if (!sameDateTime(student.enrollDate, earliestEnrollDate)) patch.enrollDate = earliestEnrollDate;
  if (student.studentDisplayId !== nextDisplayId) patch.studentDisplayId = nextDisplayId;

  const updatedStudent =
    Object.keys(patch).length > 0
      ? await tx.student.update({ where: { id: studentId }, data: patch })
      : student;

  if (updatedStudent.leadId) {
    await syncLeadDerivedFields(updatedStudent.leadId, tx);
  }

  return updatedStudent;
}

export async function syncLeadDerivedFields(
  leadId: string,
  tx: DbClient = prisma
) {
  const lead = await tx.lead.findUnique({
    where: { id: leadId },
    include: {
      student: {
        include: {
          enrollments: { orderBy: [{ enrollDate: "asc" }, { createdAt: "asc" }] },
        },
      },
    },
  });
  if (!lead) return null;

  const studentEnrollDate =
    lead.student?.enrollments[0]?.enrollDate ?? lead.student?.enrollDate ?? lead.actualEnrollDate ?? null;
  const nextStatus = lead.student ? "ENROLLED" : lead.status;

  const patch: Prisma.LeadUpdateInput = {};
  if (lead.status !== nextStatus) patch.status = nextStatus;
  if (!sameDateTime(lead.actualEnrollDate, studentEnrollDate)) patch.actualEnrollDate = studentEnrollDate;

  if (Object.keys(patch).length === 0) return lead;
  return tx.lead.update({ where: { id: leadId }, data: patch });
}

export async function ensureTimesheetPeriodForEntry(
  employeeId: string,
  workDate: Date,
  tx: DbClient = prisma
) {
  const employee = await tx.employee.findUnique({
    where: { id: employeeId },
    select: { branchId: true },
  });
  if (!employee) return null;

  const periodName = periodNameOf(workDate);
  const period =
    (await tx.timesheetPeriod.findUnique({
      where: { branchId_periodName: { branchId: employee.branchId, periodName } },
    })) ??
    (await tx.timesheetPeriod.create({
      data: {
        branchId: employee.branchId,
        periodName,
        startDate: firstDayOfMonthUtc(workDate),
        endDate: lastDayOfMonthUtc(workDate),
      },
    }));

  return period.id;
}

export async function syncTimesheetEntryPeriod(
  entryId: string,
  tx: DbClient = prisma
) {
  const entry = await tx.timesheetEntry.findUnique({
    where: { id: entryId },
    select: { id: true, employeeId: true, workDate: true, periodId: true },
  });
  if (!entry) return null;

  const periodId = await ensureTimesheetPeriodForEntry(entry.employeeId, entry.workDate, tx);
  if (!periodId || entry.periodId === periodId) return entry;

  return tx.timesheetEntry.update({
    where: { id: entry.id },
    data: { periodId },
  });
}

export async function syncBookQuantityOnHand(
  bookId: string,
  tx: DbClient = prisma
) {
  const balance = await computeStockBalance(bookId);
  await tx.book.update({
    where: { id: bookId },
    data: { quantityOnHand: balance.onHand },
  });
  return balance;
}
