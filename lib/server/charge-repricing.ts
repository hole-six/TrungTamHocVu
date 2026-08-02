import { prisma } from "@/lib/prisma";
import { canEditCharges, computeEffectiveUnitPrice, computeTotalAmount, computeTuitionAmount } from "@/lib/server/tuition-rules";

function overlapsWindow(
  effectiveFrom: Date,
  effectiveTo: Date | null,
  windowStart: Date,
  windowEnd: Date,
) {
  return effectiveFrom <= windowEnd && (!effectiveTo || effectiveTo >= windowStart);
}

export async function refreshEditableChargesForStudent(studentId: string) {
  const now = new Date();
  const charges = await prisma.charge.findMany({
    where: { studentId },
    include: {
      billingPeriod: true,
      class: { include: { course: true } },
    },
  });

  if (charges.length === 0) return { updated: 0 };

  const classIds = Array.from(new Set(charges.map((charge) => charge.classId)));
  const [scholarships, adjustments] = await Promise.all([
    prisma.scholarship.findMany({
      where: {
        studentId,
        enrollment: {
          classId: { in: classIds },
        },
      },
      include: {
        enrollment: {
          select: { classId: true },
        },
      },
    }),
    prisma.adjustment.findMany({
      where: { studentId },
    }),
  ]);

  let updated = 0;

  for (const charge of charges) {
    if (!canEditCharges(charge.billingPeriod.status)) continue;
    if (charge.billingModel === "INSTALLMENT") continue;

    const basePrice = charge.class.tuitionPerSession ?? charge.class.course?.tuitionPerSession ?? 0;
    const windowStart = charge.billingModel === "COURSE" ? now : charge.billingPeriod.startDate;
    const windowEnd = charge.billingModel === "COURSE" ? now : charge.billingPeriod.endDate;

    const scholarshipPct = scholarships
      .filter((item) => item.enrollment?.classId === charge.classId)
      .filter((item) => overlapsWindow(item.effectiveFrom, item.effectiveTo, windowStart, windowEnd))
      .reduce((sum, item) => sum + item.percentage, 0);

    const adjustmentPct = adjustments
      .filter((item) => overlapsWindow(item.effectiveFrom, item.effectiveTo, windowStart, windowEnd))
      .reduce((sum, item) => sum + item.percentage, 0);

    const unitPrice = computeEffectiveUnitPrice(basePrice, scholarshipPct, adjustmentPct);
    const tuitionAmount =
      charge.billingModel === "COURSE"
        ? charge.sessionCount * unitPrice
        : computeTuitionAmount(charge.sessionCount, charge.absentCount, charge.deductedCount, unitPrice);
    const totalAmount = computeTotalAmount(tuitionAmount, charge.materialsAmount, charge.openingBalance);

    if (
      unitPrice !== charge.unitPrice ||
      tuitionAmount !== charge.tuitionAmount ||
      totalAmount !== charge.totalAmount
    ) {
      await prisma.charge.update({
        where: { id: charge.id },
        data: {
          unitPrice,
          tuitionAmount,
          totalAmount,
        },
      });
      updated++;
    }
  }

  return { updated };
}
