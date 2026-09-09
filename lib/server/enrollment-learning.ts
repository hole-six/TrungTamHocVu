import type { Prisma } from "@prisma/client";
import { computeEffectiveUnitPrice, overlapsWindow } from "./tuition-rules";
import { type ScheduleRuleLike, estimateEndDateFromRules, getVietnamToday } from "./class-rules";
import { getHolidayDateSet } from "./holidays";

type EnrollmentWithClass = {
  id: string;
  studentId: string;
  classId?: string | null;
  billingModel?: string;
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
  // PERIOD (95% học sinh) KHÔNG có "đã mua N buổi" — quyền học nằm trong Ví buổi học
  // (lib/server/enrollment-wallet.ts), không phải con số cố định. Trước đây fallback
  // về class.totalSessions (số buổi DỰ KIẾN của lớp) cho mọi enrollment, khiến toàn bộ
  // hàm bên dưới (entitledMainSessions/remainingMainSessions/continuationStatus) bịa
  // ra quyền học giả cho PERIOD — đây là chỗ sửa gốc, chỉ COURSE mới fallback.
  if (enrollment.billingModel === "PERIOD") return enrollment.purchasedMainSessionCount ?? 0;
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

// Tiền HỌC PHÍ thực thu của riêng 1 ghi danh (không tính tiền giáo trình — sách đã
// giao là hàng đã nhận, không quy đổi thành buổi học ở lớp mới được).
//
// Vì sao cần: giá trị mang sang lớp mới của gói THEO KHÓA trước đây tính bằng
// "số buổi còn được hưởng × đơn giá" — tức mặc định học viên đã đóng đủ tiền cả
// khóa. Học viên mới đóng một phần vẫn được quy đổi y như đóng đủ, tức hệ thống tự
// tạo ra giá trị chưa từng thu được. Chốt nghiệp vụ của chủ trung tâm: SỐ TIỀN THU
// VÀO mới là số tiền đích đến cuối cùng.
export async function computeEnrollmentPaidTuitionAmount(
  prismaClient: Prisma.TransactionClient,
  enrollment: { id: string; studentId: string; classId?: string | null },
): Promise<number> {
  const charges = await prismaClient.charge.findMany({
    where: {
      OR: [
        { enrollmentId: enrollment.id },
        // Charge cũ sinh trước khi có cột enrollmentId — nhận diện lại theo học viên +
        // lớp để không bỏ sót tiền đã thu của chính ghi danh này.
        ...(enrollment.classId
          ? [{ enrollmentId: null, studentId: enrollment.studentId, classId: enrollment.classId }]
          : []),
      ],
    },
    select: {
      tuitionAmount: true,
      materialsAmount: true,
      allocations: {
        where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } },
        select: { amount: true },
      },
    },
  });

  let paidTuition = 0;
  for (const charge of charges) {
    const paid = charge.allocations.reduce((sum, item) => sum + item.amount, 0);
    if (paid <= 0) continue;
    // 1 khoản thu phân bổ vào charge trả cho CẢ học phí lẫn giáo trình — chia theo tỉ
    // lệ để chỉ lấy đúng phần học phí.
    const ownDue = charge.tuitionAmount + charge.materialsAmount;
    paidTuition += ownDue > 0 ? Math.round((paid * charge.tuitionAmount) / ownDue) : paid;
  }
  return paidTuition;
}

export function computeLearningSnapshot(
  enrollment: EnrollmentWithClass,
  completedMainSessions: number,
  futureMainSessions: ClassSessionLite[],
  unitPriceOverride?: number,
  holidayDates?: Set<string>,
  paidTuitionAmount?: number,
) {
  const plan = computeEnrollmentTuitionPlan(enrollment, unitPriceOverride);
  const manualExtraSessions = resolveManualExtraSessions(enrollment);
  const entitledMainSessions = plan.purchasedMainSessions + manualExtraSessions;
  const remainingMainSessions = Math.max(0, entitledMainSessions - completedMainSessions);
  const paidRemainingSessions = Math.max(0, plan.purchasedMainSessions - completedMainSessions);
  const manualExtraRemainingSessions = Math.max(0, remainingMainSessions - paidRemainingSessions);
  const remainingValue = paidRemainingSessions * plan.unitPrice;
  const isPeriod = enrollment.billingModel === "PERIOD";
  // PERIOD không có "hết buổi"/"cần chuyển lớp" — quyền học nằm trong Ví, không phải
  // trong entitledMainSessions (luôn = 0 cho PERIOD sau khi sửa resolvePurchasedMainSessions
  // ở trên). Chốt cứng continuationStatus = "ON_TRACK" để MỌI nơi đang so sánh
  // === "NEED_TRANSFER"/"COMPLETED" tự động không kích hoạt cho PERIOD, thay vì bắt
  // từng màn hình tự nhớ gate theo billingModel.
  const expectedStudentEndDate = isPeriod
    ? null
    : computeExpectedStudentEndDate(enrollment, remainingMainSessions, futureMainSessions, holidayDates);
  const continuationStatus = isPeriod
    ? "ON_TRACK"
    : remainingMainSessions <= 0
      ? "COMPLETED"
      : expectedStudentEndDate
        ? "ON_TRACK"
        : "NEED_TRANSFER";

  // Giá trị ĐƯỢC PHÉP mang sang lớp mới (chỉ áp dụng gói THEO KHÓA — gói theo tháng
  // dùng Ví buổi học, bản thân ví đã chỉ tăng khi có tiền thu thật).
  //
  // Lấy giá trị NHỎ HƠN giữa 2 cách tính:
  //   (a) theo quyền lợi: số buổi còn lại × đơn giá  — cách cũ, đúng khi đã đóng đủ;
  //   (b) theo tiền thật: tiền học phí đã thu − giá trị số buổi đã dạy.
  // Đóng đủ thì (b) ≥ (a) nên kết quả không đổi so với trước. Đóng thiếu thì (b) nhỏ
  // hơn và được chọn — chặn đúng chỗ hệ thống từng "tặng" giá trị chưa hề thu được.
  // KHÔNG sửa lại paidRemainingSessions tại chỗ: manualExtraRemainingSessions được
  // suy ra từ nó, hạ số này xuống sẽ thổi phồng số buổi cộng linh động miễn phí.
  const entitlementTransferValue = remainingValue;
  const moneyTransferValue =
    paidTuitionAmount === undefined
      ? null
      : Math.max(0, paidTuitionAmount - completedMainSessions * plan.unitPrice);
  const transferableValue = isPeriod
    ? 0
    : moneyTransferValue === null
      ? entitlementTransferValue
      : Math.min(entitlementTransferValue, moneyTransferValue);
  const transferableSessions = plan.unitPrice > 0 ? Math.floor(transferableValue / plan.unitPrice) : 0;

  return {
    ...plan,
    completedMainSessions,
    manualExtraSessions,
    entitledMainSessions,
    remainingMainSessions,
    paidRemainingSessions,
    manualExtraRemainingSessions,
    remainingValue,
    paidTuitionAmount: paidTuitionAmount ?? null,
    transferableValue,
    transferableSessions,
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
  const [completedMainSessions, futureMainSessions, scholarships, adjustments, paidTuitionAmount] = await Promise.all([
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
    computeEnrollmentPaidTuitionAmount(prismaClient, enrollment),
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
    ...computeLearningSnapshot(enrollment, completedMainSessions, futureMainSessions, effectiveUnitPrice, holidayDates, paidTuitionAmount),
    scholarshipPct,
    adjustmentPct,
  };
}

// Quy đổi từ SỐ TIỀN sang số buổi ở lớp mới. Đây là dạng gốc — chuyển lớp luôn đi qua
// tiền (chốt nghiệp vụ: tiền thu vào là đích đến cuối cùng), số buổi chỉ là cách hiển
// thị lại số tiền đó theo đơn giá của lớp đang xét.
export function computeTransferConversionFromValue(remainingValue: number, newUnitPrice: number) {
  const value = Math.max(0, remainingValue);
  if (newUnitPrice <= 0) {
    return { remainingValue: value, convertedSessionCount: 0, remainingCashAmount: value };
  }
  const convertedSessionCount = Math.floor(value / newUnitPrice);
  return {
    remainingValue: value,
    convertedSessionCount,
    remainingCashAmount: value - convertedSessionCount * newUnitPrice,
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
