// Tạo kỳ thu học phí + sinh Charge — tách riêng khỏi tuition-rules.ts (file đó được
// components/tuition/TuitionWorkspace.tsx — 1 client component — import trực tiếp;
// thêm import prisma vào đó sẽ kéo Prisma Client vào bundle trình duyệt). File này
// chỉ được gọi từ route handler và scheduler (server-only).
import { prisma } from "@/lib/prisma";
import { computeEffectiveUnitPrice, computeTuitionAmount, computeTotalAmount, canEditCharges, monthRange } from "@/lib/server/tuition-rules";
import { computeOpeningBalance } from "@/lib/server/balance";

export async function ensureBillingPeriod(branchId: string, periodName: string) {
  const existing = await prisma.billingPeriod.findUnique({
    where: { branchId_periodName: { branchId, periodName } },
  });
  if (existing) return existing;

  const { start, end } = monthRange(periodName);
  return prisma.billingPeriod.create({
    data: { branchId, periodName, startDate: start, endDate: end },
  });
}

// Sinh Charge (khoản phải thu) cho mọi ghi danh đang ACTIVE trong kỳ — tương ứng
// trigger "Phát sinh học phí" ở Master Spec §6. Logic giống hệt route
// billing-periods/[id]/generate-charges (đã kiểm chứng idempotent nhiều lần) —
// tách ra để route thủ công và scheduler tự động dùng chung 1 chỗ tính duy nhất.
export async function generateChargesForPeriod(periodId: string) {
  const period = await prisma.billingPeriod.findUnique({ where: { id: periodId } });
  if (!period) return { error: "Không tìm thấy kỳ thu" as const };
  if (!canEditCharges(period.status)) {
    return { error: `Kỳ đang ở trạng thái "${period.status}", không thể sinh học phí.` as const };
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { status: "ACTIVE", class: { branchId: period.branchId } },
    include: { class: { include: { course: true } } },
  });

  let created = 0;
  let updated = 0;

  for (const enrollment of enrollments) {
    const { studentId, classId } = enrollment;
    const cls = enrollment.class;
    const basePrice = cls.tuitionPerSession ?? cls.course?.tuitionPerSession ?? 0;

    const sessionCount = await prisma.classSession.count({
      where: { classId, status: "COMPLETED", sessionDate: { gte: period.startDate, lte: period.endDate } },
    });
    const absentCount = await prisma.studentAttendance.count({
      where: {
        studentId,
        status: "ABSENT",
        session: { classId, sessionDate: { gte: period.startDate, lte: period.endDate } },
      },
    });

    const [scholarships, adjustments, materials, existingCharge] = await Promise.all([
      prisma.scholarship.findMany({
        where: { studentId, effectiveFrom: { lte: period.endDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }] },
      }),
      prisma.adjustment.findMany({
        where: { studentId, effectiveFrom: { lte: period.endDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }] },
      }),
      prisma.bookIssue.aggregate({
        where: { studentId, classId, issueDate: { gte: period.startDate, lte: period.endDate } },
        _sum: { amount: true },
      }),
      prisma.charge.findUnique({ where: { studentId_classId_billingPeriodId: { studentId, classId, billingPeriodId: period.id } } }),
    ]);

    const scholarshipPct = scholarships.reduce((s, x) => s + x.percentage, 0);
    const adjustmentPct = adjustments.reduce((s, x) => s + x.percentage, 0);
    const unitPrice = computeEffectiveUnitPrice(basePrice, scholarshipPct, adjustmentPct);
    const deductedCount = existingCharge?.deductedCount ?? 0;
    const tuitionAmount = computeTuitionAmount(sessionCount, absentCount, deductedCount, unitPrice);
    const materialsAmount = materials._sum.amount ?? 0;

    await prisma.$transaction(async (tx) => {
      const { openingBalance, unusedCreditIds } = await computeOpeningBalance(studentId, period.startDate, tx);
      const totalAmount = computeTotalAmount(tuitionAmount, materialsAmount, openingBalance);

      if (unusedCreditIds.length > 0) {
        await tx.creditBalance.updateMany({ where: { id: { in: unusedCreditIds } }, data: { usedAt: new Date() } });
      }

      let chargeId = existingCharge?.id ?? null;

      if (existingCharge) {
        await tx.charge.update({
          where: { id: existingCharge.id },
          data: { sessionCount, absentCount, unitPrice, tuitionAmount, materialsAmount, openingBalance, totalAmount },
        });
        chargeId = existingCharge.id;
        updated++;
      } else {
        const createdCharge = await tx.charge.create({
          data: {
            studentId,
            classId,
            billingPeriodId: period.id,
            sessionCount,
            absentCount,
            deductedCount,
            unitPrice,
            tuitionAmount,
            materialsAmount,
            openingBalance,
            totalAmount,
          },
        });
        chargeId = createdCharge.id;
        created++;
      }

      if (chargeId) {
        await tx.bookIssue.updateMany({
          where: {
            studentId,
            classId,
            issueDate: { gte: period.startDate, lte: period.endDate },
          },
          data: { chargeId },
        });
      }
    });
  }

  if (period.status === "DRAFT") {
    await prisma.billingPeriod.update({ where: { id: period.id }, data: { status: "GENERATED" } });
  }

  return { created, updated, totalEnrollments: enrollments.length };
}
