import { PrismaClient } from "@prisma/client";
import {
  computeTransferConversion,
  getEnrollmentLearningSnapshot,
  resolveEnrollmentUnitPrice,
} from "../lib/server/enrollment-learning";
import { computeEffectiveUnitPrice, overlapsWindow } from "../lib/server/tuition-rules";

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
    // completedMainSessions đếm theo LỊCH ĐÃ QUA (mọi ClassSession COMPLETED kể từ
    // enrollDate), KHÔNG lọc theo attendance="PRESENT" — vắng có buổi bổ trợ bù riêng
    // chứ không làm chậm tiến độ (xem comment trong getEnrollmentLearningSnapshot).
    // Check này phải mô phỏng đúng cùng công thức, nếu không sẽ báo sai với mọi học
    // viên có buổi vắng.
    const learningStart = new Date(Date.UTC(enrollment.enrollDate.getUTCFullYear(), enrollment.enrollDate.getUTCMonth(), enrollment.enrollDate.getUTCDate()));
    const completedMainSessions = await prisma.classSession.count({
      where: {
        classId: enrollment.classId,
        status: "COMPLETED",
        sessionDate: { gte: learningStart },
      },
    });
    const purchased = enrollment.purchasedMainSessionCount ?? enrollment.class.totalSessions ?? 0;
    // snapshot.remainingValue dùng đơn giá ĐÃ TRỪ %học bổng/điều chỉnh đang hiệu lực
    // NGAY LÚC NÀY (không phải lúc ghi danh) — phải mô phỏng đúng, nếu không mọi học
    // viên đang có học bổng sẽ báo sai remaining value dù snapshot tính đúng.
    const now = new Date();
    const [scholarships, adjustments] = await Promise.all([
      prisma.scholarship.findMany({ where: { enrollmentId: enrollment.id }, select: { percentage: true, effectiveFrom: true, effectiveTo: true } }),
      prisma.adjustment.findMany({
        where: { studentId: enrollment.studentId, OR: [{ enrollmentId: null }, { enrollmentId: enrollment.id }] },
        select: { percentage: true, effectiveFrom: true, effectiveTo: true },
      }),
    ]);
    const scholarshipPct = scholarships.filter((item) => overlapsWindow(item.effectiveFrom, item.effectiveTo, now, now)).reduce((sum, item) => sum + item.percentage, 0);
    const adjustmentPct = adjustments.filter((item) => overlapsWindow(item.effectiveFrom, item.effectiveTo, now, now)).reduce((sum, item) => sum + item.percentage, 0);
    const unitPrice = computeEffectiveUnitPrice(resolveEnrollmentUnitPrice(enrollment), scholarshipPct, adjustmentPct);
    const manualExtra = Math.max(0, enrollment.manualExtraSessionCount ?? 0);
    const entitled = purchased + manualExtra;
    const remainingMain = Math.max(0, entitled - completedMainSessions);
    const paidRemaining = Math.max(0, purchased - completedMainSessions);

    assertEqual(failures, `${enrollment.student.studentCode} completed sessions`, snapshot.completedMainSessions, completedMainSessions);
    assertEqual(failures, `${enrollment.student.studentCode} remaining sessions`, snapshot.remainingMainSessions, remainingMain);
    assertEqual(failures, `${enrollment.student.studentCode} remaining value`, snapshot.remainingValue, paidRemaining * unitPrice);

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
