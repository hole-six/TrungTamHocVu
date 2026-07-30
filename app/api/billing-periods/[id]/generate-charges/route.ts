import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeEffectiveUnitPrice, computeTuitionAmount, computeTotalAmount, canEditCharges } from "@/lib/server/tuition-rules";
import { computeOpeningBalance } from "@/lib/server/balance";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

// Sinh Charge (khoản phải thu) cho mọi ghi danh đang ACTIVE trong kỳ — tương ứng
// trigger "Phát sinh học phí" ở Master Spec §6. Số buổi/số buổi nghỉ lấy từ
// ClassSession + StudentAttendance THẬT (không phải gõ tay như TheoDoiHP gốc).
// Buổi trừ (deductedCount) mặc định 0, nhân sự có thể sửa tay sau khi sinh vì đây
// là trường hợp ngoại lệ spec §14 yêu cầu không tự động quyết định.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("tuition", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sinh học phí" }, { status: 403 });
  }

  const period = await prisma.billingPeriod.findUnique({ where: { id: params.id } });
  if (!period) return NextResponse.json({ error: "Không tìm thấy kỳ thu" }, { status: 404 });
  if (!canEditCharges(period.status)) {
    return NextResponse.json({ error: `Kỳ đang ở trạng thái "${period.status}", không thể sinh học phí.` }, { status: 409 });
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

  return NextResponse.json({ created, updated, totalEnrollments: enrollments.length });
}
