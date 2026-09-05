import type { Prisma } from "@prisma/client";
import { computeEffectiveUnitPrice, overlapsWindow } from "./tuition-rules";
import { type ScheduleRuleLike, estimateEndDateFromRules, getVietnamToday } from "./class-rules";
import { getHolidayDateSet } from "./holidays";

type EnrollmentWithClass = {
  id: string;
  studentId: string;
  classId?: string | null;
  enrollDate: Date;
  purchasedMainSessionCount: number | null;
  manualExtraSessionCount?: number | null;
  tuitionUnitPriceSnapshot: number | null;
  paidCatchupSessionCount: number;
  paidCatchupUnitPrice: number | null;
  transferredValueAmount: number;
  class?: {
    totalSessions: number | null;
    tuitionPerSession: number | null;
    nextClassId?: string | null;
    course?: { tuitionPerSession: number } | null;
    // Optional — chỉ có khi caller truyền kèm (xem getEnrollmentLearningSnapshot) — dùng
    // để chiếu tiếp "dự kiến kết thúc" khi buổi đã sinh sẵn trong DB không đủ, xem
    // computeExpectedStudentEndDate bên dưới.
    scheduleRules?: ScheduleRuleLike[];
    branchId?: string;
  } | null;
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

function addOneUtcDay(date: Date) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

// futureMainSessions chỉ chứa ClassSession ĐÃ SINH SẴN trong DB — sweep tự động chỉ sinh
// trước một khoảng ngắn (xem computeAutoSessionWindow trong class-generation.ts), nên học
// viên còn nhiều buổi hơn số đã sinh sẵn sẽ không có đủ dữ liệu để lấy ngày thật. Trường
// hợp đó, chiếu tiếp lịch từ ScheduleRule (không cần ClassSession tồn tại) — cùng cách
// app/(app)/classes/[id]/page.tsx đã dùng ở cấp lớp — thay vì để null.
function computeExpectedStudentEndDate(
  enrollment: EnrollmentWithClass,
  remainingMainSessions: number,
  futureMainSessions: ClassSessionLite[],
  holidayDates?: Set<string>,
): Date | null {
  if (remainingMainSessions <= 0) return null;
  if (futureMainSessions.length >= remainingMainSessions) {
    return futureMainSessions[remainingMainSessions - 1].sessionDate;
  }
  if (!enrollment.class?.scheduleRules || enrollment.class.scheduleRules.length === 0) return null;
  const shortage = remainingMainSessions - futureMainSessions.length;
  const cursor = futureMainSessions.length
    ? addOneUtcDay(futureMainSessions[futureMainSessions.length - 1].sessionDate)
    : getVietnamToday();
  return estimateEndDateFromRules(cursor, shortage, enrollment.class.scheduleRules, holidayDates ?? new Set());
}

export function resolveEnrollmentUnitPrice(enrollment: EnrollmentWithClass) {
  return enrollment.tuitionUnitPriceSnapshot ?? enrollment.class?.tuitionPerSession ?? enrollment.class?.course?.tuitionPerSession ?? 0;
}

export function resolvePurchasedMainSessions(enrollment: EnrollmentWithClass) {
  return enrollment.purchasedMainSessionCount ?? enrollment.class?.totalSessions ?? 0;
}

export function resolveManualExtraSessions(enrollment: EnrollmentWithClass) {
  return Math.max(0, enrollment.manualExtraSessionCount ?? 0);
}

export function computeEnrollmentTuitionPlan(enrollment: EnrollmentWithClass, unitPriceOverride?: number) {
  const purchasedMainSessions = resolvePurchasedMainSessions(enrollment);
  const unitPrice = unitPriceOverride ?? resolveEnrollmentUnitPrice(enrollment);
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
  unitPriceOverride?: number,
  holidayDates?: Set<string>,
) {
  const plan = computeEnrollmentTuitionPlan(enrollment, unitPriceOverride);
  const manualExtraSessions = resolveManualExtraSessions(enrollment);
  const entitledMainSessions = plan.purchasedMainSessions + manualExtraSessions;
  const remainingMainSessions = Math.max(0, entitledMainSessions - completedMainSessions);
  const paidRemainingSessions = Math.max(0, plan.purchasedMainSessions - completedMainSessions);
  const manualExtraRemainingSessions = Math.max(0, remainingMainSessions - paidRemainingSessions);
  const remainingValue = paidRemainingSessions * plan.unitPrice;
  const expectedStudentEndDate = computeExpectedStudentEndDate(enrollment, remainingMainSessions, futureMainSessions, holidayDates);
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
  
  // ĐẾM BUỔI THEO LỊCH ĐÃ QUA (không phân biệt có mặt/vắng)
  // Logic: Qua ngày = tính buổi, vắng thì được buổi bổ trợ riêng
  // KHÔNG đếm theo attendance.status = "PRESENT" vì sẽ làm chậm tiến độ
  const [completedMainSessions, futureMainSessions, scholarships, adjustments] = await Promise.all([
    enrollment.classId
      ? prismaClient.classSession.count({
          where: {
            classId: enrollment.classId,
            status: "COMPLETED",
            sessionDate: { gte: learningStart },
          },
        })
      : Promise.resolve(0),
    enrollment.classId
      ? prismaClient.classSession.findMany({
          where: {
            classId: enrollment.classId,
            status: { notIn: ["CANCELLED", "RESCHEDULED", "COMPLETED"] },
            sessionDate: { gte: now },
          },
          orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
          select: { id: true, classId: true, sessionDate: true, status: true },
        })
      : Promise.resolve([]),
    prismaClient.scholarship.findMany({
      where: { enrollmentId: enrollment.id },
      select: { percentage: true, effectiveFrom: true, effectiveTo: true },
    }),
    prismaClient.adjustment.findMany({
      where: { studentId: enrollment.studentId, OR: [{ enrollmentId: null }, { enrollmentId: enrollment.id }] },
      select: { percentage: true, effectiveFrom: true, effectiveTo: true },
    }),
  ]);

  // Học phí "còn lại quy đổi" (chuyển lớp / kết thúc lớp) phải dựa trên số tiền học
  // viên THỰC NỘP sau học bổng/điều chỉnh, không phải giá gốc — nếu không, học viên
  // có giảm giá sẽ bị quy đổi thừa/thiếu tiền khi chuyển lớp. Lấy % đang hiệu lực TẠI
  // THỜI ĐIỂM HIỆN TẠI (thời điểm chuyển/kết thúc lớp), không phải lúc ghi danh.
  const scholarshipPct = scholarships
    .filter((item) => overlapsWindow(item.effectiveFrom, item.effectiveTo, now, now))
    .reduce((sum, item) => sum + item.percentage, 0);
  const adjustmentPct = adjustments
    .filter((item) => overlapsWindow(item.effectiveFrom, item.effectiveTo, now, now))
    .reduce((sum, item) => sum + item.percentage, 0);
  const effectiveUnitPrice = computeEffectiveUnitPrice(resolveEnrollmentUnitPrice(enrollment), scholarshipPct, adjustmentPct);

  // Chỉ cần lấy ngày lễ khi caller có truyền branchId — dùng để chiếu tiếp "dự kiến kết
  // thúc" qua ScheduleRule khi buổi đã sinh sẵn không đủ (xem computeExpectedStudentEndDate).
  const holidayDates = enrollment.class?.branchId ? await getHolidayDateSet(enrollment.class.branchId) : undefined;

  // Trả kèm % học bổng/điều chỉnh đang hiệu lực (không chỉ đơn giá đã áp dụng) để
  // luồng chuyển lớp biết CÓ học bổng hay không mà mở tuỳ chọn giữ nguyên/không giữ
  // khi ghi danh vào lớp mới — thay vì âm thầm mất học bổng sau khi chuyển.
  return {
    ...computeLearningSnapshot(enrollment, completedMainSessions, futureMainSessions, effectiveUnitPrice, holidayDates),
    scholarshipPct,
    adjustmentPct,
  };
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
