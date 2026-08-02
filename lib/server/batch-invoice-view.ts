import { prisma } from "@/lib/prisma";

export async function getBatchInvoiceViewData(periodId: string) {
  const period = await prisma.billingPeriod.findUnique({
    where: { id: periodId },
    include: {
      branch: { include: { paymentProfile: true } },
      charges: {
        include: {
          student: true,
          class: { include: { branch: true } },
          billingPeriod: true,
          allocations: {
            where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } },
          },
          invoice: true,
        },
        orderBy: [{ class: { className: "asc" } }, { student: { fullName: "asc" } }],
      },
    },
  });

  if (!period) return null;

  const chargesWithRemaining = period.charges.filter((charge) => {
    const paidAmount = charge.allocations.reduce((sum, item) => sum + item.amount, 0);
    return Math.max(charge.totalAmount - paidAmount, 0) > 0;
  });

  const activeEnrollments = await prisma.enrollment.findMany({
    where: {
      status: "ACTIVE",
      OR: chargesWithRemaining.map((charge) => ({
        studentId: charge.studentId,
        classId: charge.classId,
      })),
    },
    select: {
      id: true,
      studentId: true,
      classId: true,
      billingModel: true,
    },
  });
  const enrollmentMap = new Map(activeEnrollments.map((item) => [`${item.studentId}:${item.classId}`, item]));

  const missingInvoiceCharges = chargesWithRemaining.filter((c) => !c.invoice);
  const createdInvoices =
    missingInvoiceCharges.length > 0
      ? await Promise.all(
          missingInvoiceCharges.map((c) =>
            prisma.invoice.create({
              data: { chargeId: c.id, invoiceNo: `INV${period.periodName.replace("-", "")}${c.id.slice(0, 6).toUpperCase()}` },
            }),
          ),
        )
      : [];
  const createdInvoiceByChargeId = new Map(createdInvoices.map((inv) => [inv.chargeId, inv]));

  const charges = chargesWithRemaining.map((c) => {
    const invoice = c.invoice ?? createdInvoiceByChargeId.get(c.id) ?? null;
    const enrollment = enrollmentMap.get(`${c.studentId}:${c.classId}`) ?? null;
    return {
      id: c.id,
      enrollmentId: enrollment?.id ?? null,
      sessionCount: c.sessionCount,
      absentCount: c.absentCount,
      deductedCount: c.deductedCount,
      unitPrice: c.unitPrice,
      tuitionAmount: c.tuitionAmount,
      materialsAmount: c.materialsAmount,
      openingBalance: c.openingBalance,
      totalAmount: c.totalAmount,
      billingModel: c.billingModel,
      currentEnrollmentBillingModel: enrollment?.billingModel ?? c.billingModel,
      student: { id: c.student.id, fullName: c.student.fullName, studentCode: c.student.studentCode },
      class: { className: c.class.className, branch: { name: c.class.branch.name } },
      billingPeriod: { periodName: c.billingPeriod.periodName },
      allocations: c.allocations.map((a) => ({ amount: a.amount })),
      invoice: invoice ? { invoiceNo: invoice.invoiceNo, issuedAt: invoice.issuedAt } : null,
      classEndedThisPeriod:
        c.billingModel === "COURSE" &&
        c.class.expectedEndDate != null &&
        c.class.expectedEndDate >= period.startDate &&
        c.class.expectedEndDate <= period.endDate,
    };
  });

  return {
    periodId: period.id,
    periodName: period.periodName,
    branchId: period.branchId,
    paymentProfile: period.branch.paymentProfile,
    charges,
  };
}
