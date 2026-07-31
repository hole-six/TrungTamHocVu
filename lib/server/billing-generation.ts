// Tạo kỳ thu học phí + sinh Charge — tách riêng khỏi tuition-rules.ts (file đó được
// components/tuition/TuitionWorkspace.tsx — 1 client component — import trực tiếp;
// thêm import prisma vào đó sẽ kéo Prisma Client vào bundle trình duyệt). File này
// chỉ được gọi từ route handler và scheduler (server-only).
import { prisma } from "@/lib/prisma";
import { computeEffectiveUnitPrice, computeTuitionAmount, computeTotalAmount, canEditCharges, monthRange } from "@/lib/server/tuition-rules";
import { computeOpeningBalance } from "@/lib/server/balance";

function periodNameFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

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

  // Enrollment nào đã thu học phí TRỌN KHÓA (billingModel="COURSE", xem
  // generateCourseCharge bên dưới) thì sweep hàng tháng KHÔNG được sinh thêm charge
  // theo kỳ nữa — thu 1 lần là xong, không thu lại. Việc này biến sweep từ "thu lại
  // mỗi tháng" thành "đảm bảo ai cũng đã được thu 1 lần", tương thích ngược với các
  // enrollment cũ chưa chuyển sang mô hình mới (vẫn thu theo PERIOD như trước).
  const courseCharged = await prisma.charge.findMany({
    where: { billingModel: "COURSE", class: { branchId: period.branchId } },
    select: { studentId: true, classId: true },
  });
  const courseChargedKeys = new Set(courseCharged.map((c) => `${c.studentId}:${c.classId}`));

  let created = 0;
  let updated = 0;
  let skippedCourseBilled = 0;

  for (const enrollment of enrollments) {
    const { studentId, classId } = enrollment;
    if (courseChargedKeys.has(`${studentId}:${classId}`)) {
      skippedCourseBilled++;
      continue;
    }
    const cls = enrollment.class;
    const basePrice = cls.tuitionPerSession ?? cls.course?.tuitionPerSession ?? 0;

    // Mốc bắt đầu tính buổi phải lấy MUỘN HƠN giữa đầu kỳ thu và enrollDate của
    // CHÍNH enrollment này — học viên vào lớp giữa kỳ (lớp đã học vài buổi trước
    // khi họ ghi danh) thì không được tính/trừ tiền các buổi trước ngày họ vào.
    const sessionRangeStart = enrollment.enrollDate > period.startDate ? enrollment.enrollDate : period.startDate;

    const sessionCount = await prisma.classSession.count({
      where: { classId, status: "COMPLETED", sessionDate: { gte: sessionRangeStart, lte: period.endDate } },
    });
    const absentCount = await prisma.studentAttendance.count({
      where: {
        studentId,
        status: "ABSENT",
        session: { classId, sessionDate: { gte: sessionRangeStart, lte: period.endDate } },
      },
    });

    const [scholarships, adjustments, materials, existingCharge] = await Promise.all([
      prisma.scholarship.findMany({
        where: { enrollmentId: enrollment.id, effectiveFrom: { lte: period.endDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }] },
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

  return { created, updated, skippedCourseBilled, totalEnrollments: enrollments.length };
}

// Thu học phí TRỌN KHÓA 1 LẦN duy nhất ngay khi ghi danh (billingModel="COURSE") —
// khác hẳn generateChargesForPeriod ở trên (thu lại mỗi tháng theo buổi đã học).
// sessionCount = TỔNG buổi cả khóa (Class.totalSessions), KHÔNG trừ buổi vắng — vắng
// buổi nào vẫn tính tiền buổi đó, thay vào đó sinh 1 SessionCredit "buổi dư" để đăng
// ký học bù (xem app/api/sessions/[id]/attendance/route.ts) chứ không giảm học phí.
export async function generateCourseCharge(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { class: { include: { course: true } } },
  });
  if (!enrollment) return { error: "Không tìm thấy ghi danh" as const };

  const cls = enrollment.class;
  const totalSessions = cls.totalSessions;
  if (!totalSessions || totalSessions <= 0) {
    return { error: `Lớp "${cls.className}" chưa cấu hình tổng số buổi (totalSessions), không thể tính học phí trọn khóa.` as const };
  }

  const existing = await prisma.charge.findFirst({
    where: { studentId: enrollment.studentId, classId: enrollment.classId, billingModel: "COURSE" },
  });
  if (existing) return { error: "Học viên đã có học phí trọn khóa cho lớp này rồi." as const };

  const basePrice = cls.tuitionPerSession ?? cls.course?.tuitionPerSession ?? 0;
  const period = await ensureBillingPeriod(cls.branchId, periodNameFromDate(enrollment.enrollDate));

  const [scholarships, adjustments] = await Promise.all([
    prisma.scholarship.findMany({
      where: { enrollmentId: enrollment.id, effectiveFrom: { lte: enrollment.enrollDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: enrollment.enrollDate } }] },
    }),
    prisma.adjustment.findMany({
      where: { studentId: enrollment.studentId, effectiveFrom: { lte: enrollment.enrollDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: enrollment.enrollDate } }] },
    }),
  ]);
  const scholarshipPct = scholarships.reduce((s, x) => s + x.percentage, 0);
  const adjustmentPct = adjustments.reduce((s, x) => s + x.percentage, 0);
  const unitPrice = computeEffectiveUnitPrice(basePrice, scholarshipPct, adjustmentPct);
  const tuitionAmount = totalSessions * unitPrice;

  const charge = await prisma.$transaction(async (tx) => {
    const { openingBalance, unusedCreditIds } = await computeOpeningBalance(enrollment.studentId, enrollment.enrollDate, tx);
    const totalAmount = computeTotalAmount(tuitionAmount, 0, openingBalance);

    if (unusedCreditIds.length > 0) {
      await tx.creditBalance.updateMany({ where: { id: { in: unusedCreditIds } }, data: { usedAt: new Date() } });
    }

    return tx.charge.create({
      data: {
        studentId: enrollment.studentId,
        classId: enrollment.classId,
        billingPeriodId: period.id,
        sessionCount: totalSessions,
        absentCount: 0,
        deductedCount: 0,
        unitPrice,
        tuitionAmount,
        materialsAmount: 0,
        openingBalance,
        totalAmount,
        billingModel: "COURSE",
        notes: `Học phí trọn khóa ${cls.className} (${totalSessions} buổi)`,
      },
    });
  });

  return { charge };
}
