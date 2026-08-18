import type { Prisma } from "@prisma/client";

type EnrollmentWithClass = {
  id: string;
  studentId: string;
  classId: string;
  enrollDate: Date;
  purchasedMainSessionCount: number | null;
  manualExtraSessionCount?: number | null;
  tuitionUnitPriceSnapshot: number | null;
  paidCatchupSessionCount: number;
  paidCatchupUnitPrice: number | null;
  transferredValueAmount: number;
  class: {
    totalSessions: number | null;
    tuitionPerSession: number | null;
    nextClassId?: string | null;
    course?: { tuitionPerSession: number } | null;
  };
};

type ClassSessionLite = {
  id: string;
  classId: string;
  sessionDate: Date;
  status: string;
};

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function resolveEnrollmentUnitPrice(enrollment: EnrollmentWithClass) {
  return enrollment.tuitionUnitPriceSnapshot ?? enrollment.class.tuitionPerSession ?? enrollment.class.course?.tuitionPerSession ?? 0;
}

export function resolvePurchasedMainSessions(enrollment: EnrollmentWithClass) {
  return enrollment.purchasedMainSessionCount ?? enrollment.class.totalSessions ?? 0;
}

export function resolveManualExtraSessions(enrollment: EnrollmentWithClass) {
  return Math.max(0, enrollment.manualExtraSessionCount ?? 0);
}

export function computeEnrollmentTuitionPlan(enrollment: EnrollmentWithClass) {
  const purchasedMainSessions = resolvePurchasedMainSessions(enrollment);
  const unitPrice = resolveEnrollmentUnitPrice(enrollment);
  const paidCatchupUnitPrice = enrollment.paidCatchupUnitPrice ?? unitPrice;
  const mainTuitionAmount = purchasedMainSessions * unitPrice;
  const paidCatchupAmount = enrollment.paidCatchupSessionCount * paidCatchupUnitPrice;

  return {
    purchasedMainSessions,
    unitPrice,
    paidCatchupUnitPrice,
    mainTuitionAmount,
    paidCatchupAmount,
    grossTuitionAmount: mainTuitionAmount + paidCatchupAmount,
  };
}

export function computeLearningSnapshot(
  enrollment: EnrollmentWithClass,
  completedMainSessions: number,
  futureMainSessions: ClassSessionLite[],
) {
  const plan = computeEnrollmentTuitionPlan(enrollment);
  const manualExtraSessions = resolveManualExtraSessions(enrollment);
  const entitledMainSessions = plan.purchasedMainSessions + manualExtraSessions;
  const remainingMainSessions = Math.max(0, entitledMainSessions - completedMainSessions);
  const paidRemainingSessions = Math.max(0, plan.purchasedMainSessions - completedMainSessions);
  const manualExtraRemainingSessions = Math.max(0, remainingMainSessions - paidRemainingSessions);
  const remainingValue = paidRemainingSessions * plan.unitPrice;
  const expectedStudentEndDate =
    remainingMainSessions > 0 && futureMainSessions.length >= remainingMainSessions
      ? futureMainSessions[remainingMainSessions - 1].sessionDate
      : null;
  const continuationStatus =
    remainingMainSessions <= 0
      ? "COMPLETED"
      : expectedStudentEndDate
        ? "ON_TRACK"
        : "NEED_TRANSFER";

  return {
    ...plan,
    completedMainSessions,
    manualExtraSessions,
    entitledMainSessions,
    remainingMainSessions,
    paidRemainingSessions,
    manualExtraRemainingSessions,
    remainingValue,
    expectedStudentEndDate,
    continuationStatus,
    futureMainSessionCount: futureMainSessions.length,
    shortageAfterCurrentClass: Math.max(0, remainingMainSessions - futureMainSessions.length),
  };
}

export async function getEnrollmentLearningSnapshot(
  prismaClient: Prisma.TransactionClient,
  enrollment: EnrollmentWithClass,
) {
  const learningStart = startOfUtcDay(enrollment.enrollDate);
  const now = new Date();
  const [completedMainSessions, futureMainSessions] = await Promise.all([
    prismaClient.studentAttendance.count({
      where: {
        studentId: enrollment.studentId,
        status: "PRESENT",
        session: {
          classId: enrollment.classId,
          status: "COMPLETED",
          sessionDate: { gte: learningStart },
        },
      },
    }),
    prismaClient.classSession.findMany({
      where: {
        classId: enrollment.classId,
        status: { notIn: ["CANCELLED", "RESCHEDULED", "COMPLETED"] },
        sessionDate: { gte: now },
      },
      orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
      select: { id: true, classId: true, sessionDate: true, status: true },
    }),
  ]);

  return computeLearningSnapshot(enrollment, completedMainSessions, futureMainSessions);
}

export function computeTransferConversion(
  remainingMainSessions: number,
  oldUnitPrice: number,
  newUnitPrice: number,
) {
  const remainingValue = Math.max(0, remainingMainSessions) * Math.max(0, oldUnitPrice);
  if (newUnitPrice <= 0) {
    return { remainingValue, convertedSessionCount: 0, remainingCashAmount: remainingValue };
  }
  const convertedSessionCount = Math.floor(remainingValue / newUnitPrice);
  return {
    remainingValue,
    convertedSessionCount,
    remainingCashAmount: remainingValue - convertedSessionCount * newUnitPrice,
  };
}
