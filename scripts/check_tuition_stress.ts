import { PrismaClient } from "@prisma/client";
import { getBatchInvoiceViewData } from "../lib/server/batch-invoice-view";
import { previewChargeGenerationExceptions } from "../lib/server/billing-generation";

const prisma = new PrismaClient();

const MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10"] as const;

async function main() {
  const branch = await prisma.branch.findUnique({ where: { code: "CS1" } });
  if (!branch) {
    throw new Error("Không tìm thấy cơ sở CS1.");
  }

  const periods = await prisma.billingPeriod.findMany({
    where: { branchId: branch.id, periodName: { in: [...MONTHS] } },
    orderBy: { periodName: "asc" },
  });

  const periodSummaries = [];
  for (const period of periods) {
    const batch = await getBatchInvoiceViewData(period.id);
    const exceptions = await previewChargeGenerationExceptions(period.id);
    const charges =
      batch?.charges.map((charge) => {
        const paid = charge.allocations.reduce((sum, item) => sum + item.amount, 0);
        return {
          id: charge.id,
          studentCode: charge.student.studentCode,
          className: charge.class.className,
          billingModel: charge.billingModel,
          currentEnrollmentBillingModel: charge.currentEnrollmentBillingModel,
          mismatch: charge.currentEnrollmentBillingModel !== charge.billingModel,
          totalAmount: charge.totalAmount,
          paidAmount: paid,
          remainingAmount: Math.max(charge.totalAmount - paid, 0),
          openingBalance: charge.openingBalance,
          materialsAmount: charge.materialsAmount,
          sessionCount: charge.sessionCount,
          absentCount: charge.absentCount,
          deductedCount: charge.deductedCount,
          classEndedThisPeriod: charge.classEndedThisPeriod,
        };
      }) ?? [];

    periodSummaries.push({
      periodName: period.periodName,
      status: period.status,
      chargeCount: charges.length,
      monthlyCount: charges.filter((item) => item.billingModel === "PERIOD").length,
      courseCount: charges.filter((item) => item.billingModel === "COURSE").length,
      installmentCount: charges.filter((item) => item.billingModel === "INSTALLMENT").length,
      unpaidCount: charges.filter((item) => item.remainingAmount > 0).length,
      partialCount: charges.filter((item) => item.paidAmount > 0 && item.remainingAmount > 0).length,
      openingBalanceCount: charges.filter((item) => item.openingBalance !== 0).length,
      materialsCount: charges.filter((item) => item.materialsAmount > 0).length,
      mismatchCount: charges.filter((item) => item.mismatch).length,
      exceptionCount: "exceptionCount" in exceptions ? exceptions.exceptionCount : -1,
      sampleCharges: charges.slice(0, 6),
    });
  }

  const [studentCount, classCount, remedialClassCount, sessionCreditSummary, installmentSummary, bookRequirementSummary] = await Promise.all([
    prisma.student.count({ where: { studentCode: { startsWith: "STRESS-HV" } } }),
    prisma.class.count({ where: { classCode: { startsWith: "ST-" } } }),
    prisma.class.count({ where: { classCode: { startsWith: "ST-REM" }, isRemedial: true } }),
    prisma.sessionCredit.groupBy({
      by: ["status"],
      where: { student: { studentCode: { startsWith: "STRESS-HV" } } },
      _count: { _all: true },
    }),
    prisma.enrollmentInstallment.groupBy({
      by: ["status"],
      where: { enrollment: { student: { studentCode: { startsWith: "STRESS-HV" } } } },
      _count: { _all: true },
    }),
    prisma.studentBookRequirement.groupBy({
      by: ["status"],
      where: { student: { studentCode: { startsWith: "STRESS-HV" } } },
      _count: { _all: true },
    }),
  ]);

  const creditsByStatus = Object.fromEntries(sessionCreditSummary.map((row) => [row.status, row._count._all]));
  const installmentsByStatus = Object.fromEntries(installmentSummary.map((row) => [row.status, row._count._all]));
  const requirementsByStatus = Object.fromEntries(bookRequirementSummary.map((row) => [row.status, row._count._all]));

  const notableStudents = await prisma.student.findMany({
    where: { studentCode: { startsWith: "STRESS-HV" } },
    take: 8,
    orderBy: { studentCode: "asc" },
    include: {
      enrollments: { include: { class: true } },
      charges: { include: { billingPeriod: true, allocations: true }, orderBy: [{ billingPeriod: { periodName: "asc" } }] },
      sessionCredits: true,
      bookRequirements: true,
    },
  });

  const studentSnapshots = notableStudents.map((student) => ({
    studentCode: student.studentCode,
    enrollments: student.enrollments.map((enrollment) => ({
      classCode: enrollment.class.classCode,
      className: enrollment.class.className,
      billingModel: enrollment.billingModel,
    })),
    charges: student.charges.map((charge) => ({
      periodName: charge.billingPeriod.periodName,
      billingModel: charge.billingModel,
      totalAmount: charge.totalAmount,
      paidAmount: charge.allocations.reduce((sum, item) => sum + item.amount, 0),
      openingBalance: charge.openingBalance,
      materialsAmount: charge.materialsAmount,
    })),
    sessionCredits: student.sessionCredits.length,
    confirmedBooks: student.bookRequirements.filter((item) => item.status === "CONFIRMED").length,
  }));

  console.log(
    JSON.stringify(
      {
        ok: true,
        branch: branch.code,
        coverage: {
          studentCount,
          classCount,
          remedialClassCount,
          periods: periodSummaries.length,
        },
        creditsByStatus,
        installmentsByStatus,
        requirementsByStatus,
        periodSummaries,
        studentSnapshots,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
