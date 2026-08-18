import { PrismaClient } from "@prisma/client";
import {
  computeTransferConversion,
  getEnrollmentLearningSnapshot,
  resolveEnrollmentUnitPrice,
} from "../lib/server/enrollment-learning";

const prisma = new PrismaClient();

type Failure = {
  scenario: string;
  detail: string;
};

function assertEqual(failures: Failure[], scenario: string, actual: unknown, expected: unknown) {
  if (actual !== expected) {
    failures.push({ scenario, detail: `expected ${expected}, got ${actual}` });
  }
}

async function main() {
  const failures: Failure[] = [];

  const enrollments = await prisma.enrollment.findMany({
    where: {
      student: { studentCode: { startsWith: "STRESS-HV" } },
      status: "ACTIVE",
    },
    include: {
      student: true,
      class: { include: { course: true, nextClass: true } },
      sessionCredits: true,
      charges: { include: { allocations: true } },
    },
    orderBy: [{ student: { studentCode: "asc" } }],
  });

  if (enrollments.length === 0) {
    throw new Error("Chua co du lieu STRESS-HV. Hay chay: npm run seed:tuition-stress");
  }

  for (const enrollment of enrollments) {
    const snapshot = await getEnrollmentLearningSnapshot(prisma, enrollment);
    const attendedMainSessions = await prisma.studentAttendance.count({
      where: {
        studentId: enrollment.studentId,
        status: "PRESENT",
        session: {
          classId: enrollment.classId,
          status: "COMPLETED",
          sessionDate: { gte: enrollment.enrollDate },
        },
      },
    });
    const purchased = enrollment.purchasedMainSessionCount ?? enrollment.class.totalSessions ?? 0;
    const unitPrice = resolveEnrollmentUnitPrice(enrollment);
    const remaining = Math.max(0, purchased - attendedMainSessions);

    assertEqual(failures, `${enrollment.student.studentCode} completed sessions`, snapshot.completedMainSessions, attendedMainSessions);
    assertEqual(failures, `${enrollment.student.studentCode} remaining sessions`, snapshot.remainingMainSessions, remaining);
    assertEqual(failures, `${enrollment.student.studentCode} remaining value`, snapshot.remainingValue, remaining * unitPrice);

    if (enrollment.paidCatchupSessionCount > 0) {
      const paidCatchupCredits = enrollment.sessionCredits.filter((credit) => credit.origin === "PAID_CATCHUP");
      assertEqual(
        failures,
        `${enrollment.student.studentCode} paid catchup credits`,
        paidCatchupCredits.length,
        enrollment.paidCatchupSessionCount,
      );
    }

    const absenceCredits = enrollment.sessionCredits.filter((credit) => credit.origin === "ABSENCE");
    const absentMainSessions = await prisma.studentAttendance.count({
      where: {
        studentId: enrollment.studentId,
        status: "ABSENT",
        session: { classId: enrollment.classId },
      },
    });
    if (enrollment.billingModel === "COURSE" && absentMainSessions > 0 && absenceCredits.length === 0) {
      failures.push({
        scenario: `${enrollment.student.studentCode} absence credits`,
        detail: `course enrollment has ${absentMainSessions} absences but no ABSENCE session credit`,
      });
    }
  }

  const transferSamples = [
    { remaining: 10, oldPrice: 200_000, newPrice: 200_000, sessions: 10, cash: 0 },
    { remaining: 10, oldPrice: 200_000, newPrice: 250_000, sessions: 8, cash: 0 },
    { remaining: 7, oldPrice: 200_000, newPrice: 300_000, sessions: 4, cash: 200_000 },
    { remaining: 3, oldPrice: 150_000, newPrice: 200_000, sessions: 2, cash: 50_000 },
  ];

  for (const sample of transferSamples) {
    const result = computeTransferConversion(sample.remaining, sample.oldPrice, sample.newPrice);
    assertEqual(failures, `transfer ${sample.remaining}x${sample.oldPrice}->${sample.newPrice} sessions`, result.convertedSessionCount, sample.sessions);
    assertEqual(failures, `transfer ${sample.remaining}x${sample.oldPrice}->${sample.newPrice} cash`, result.remainingCashAmount, sample.cash);
  }

  const summary = {
    checkedEnrollments: enrollments.length,
    activeCourseEnrollments: enrollments.filter((item) => item.billingModel === "COURSE").length,
    activePeriodEnrollments: enrollments.filter((item) => item.billingModel === "PERIOD").length,
    activeInstallmentEnrollments: enrollments.filter((item) => item.billingModel === "INSTALLMENT").length,
    failures,
  };

  console.log(JSON.stringify({ ok: failures.length === 0, summary }, null, 2));

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
