import { prisma } from "@/lib/prisma";
import {
  computeEffectiveUnitPrice,
  computeTuitionAmount,
  computeTotalAmount,
  canEditCharges,
  monthRange,
  monthKey,
} from "@/lib/server/tuition-rules";
import { computeBalanceSnapshot, consumeCreditBalances } from "@/lib/server/balance";
import { settleChargesFromAdvancePayments } from "@/lib/server/advance-payment";
import { resolvePurchasedMainSessions } from "@/lib/server/enrollment-learning";
import { getCarriedSessionsForPeriod } from "@/lib/server/enrollment-wallet";

type GenerationException = {
  studentId: string;
  classId: string;
  reason: string;
};

type PendingChargeDraft =
  | {
      kind: "INSTALLMENT";
      studentId: string;
      classId: string;
      className: string;
      baseAmount: number;
      existingChargeId: string | null;
      // openingBalance đã chốt của charge cũ (nếu đang sinh lại) — giữ nguyên khi
      // regenerate, không tính/trừ credit lại (xem giải thích ở vòng lặp finalize).
      existingOpeningBalance: number | null;
      enrollmentId: string;
      installmentId: string;
      chargePayload: {
        sessionCount: number;
        scheduledSessionCount?: number;
        carriedSessionCount?: number;
        absentCount: number;
        deductedCount: number;
        unitPrice: number;
        mainTuitionAmount?: number;
        paidCatchupAmount?: number;
        tuitionAmount: number;
        materialsAmount: number;
        billingModel: "INSTALLMENT";
        installmentId: string;
        notes: string;
      };
    }
  | {
      kind: "PERIOD";
      studentId: string;
      classId: string;
      className: string;
      baseAmount: number;
      existingChargeId: string | null;
      existingOpeningBalance: number | null;
      enrollmentId: string;
      issueStart: Date;
      issueEnd: Date;
      chargePayload: {
        sessionCount: number;
        scheduledSessionCount?: number;
        carriedSessionCount?: number;
        absentCount: number;
        deductedCount: number;
        unitPrice: number;
        mainTuitionAmount?: number;
        paidCatchupAmount?: number;
        transferCreditAmount?: number;
        transferCreditSessionCount?: number;
        tuitionAmount: number;
        materialsAmount: number;
        billingModel: "PERIOD";
      };
    };

export type GenerationExceptionPreview = GenerationException & {
  studentName: string;
  studentCode: string;
  className: string;
  billingModel: string;
};

function periodNameFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getChargeCollectedAmount(chargeId: string) {
  const aggregate = await prisma.paymentAllocation.aggregate({
    where: {
      chargeId,
      payment: {
        status: {
          notIn: ["VOIDED", "REFUNDED"],
        },
      },
    },
    _sum: { amount: true },
  });

  return aggregate._sum.amount ?? 0;
}

async function replaceChargeIfUncollected(chargeId: string, reasonWhenCollected: string) {
  const collectedAmount = await getChargeCollectedAmount(chargeId);
  if (collectedAmount > 0) {
    return {
      replaced: false as const,
      blocked: true as const,
      reason: `${reasonWhenCollected} Charge này đã được thu ${collectedAmount.toLocaleString("vi-VN")}đ nên không được tự thay thế.`,
    };
  }

  const charge = await prisma.charge.findUnique({
    where: { id: chargeId },
    select: { id: true, installmentId: true },
  });

  if (!charge) {
    return { replaced: false as const, blocked: false as const, reason: null };
  }

  await prisma.$transaction(async (tx) => {
    await tx.bookIssue.updateMany({
      where: { chargeId: charge.id },
      data: { chargeId: null },
    });

    if (charge.installmentId) {
      await tx.enrollmentInstallment.update({
        where: { id: charge.installmentId },
        data: { status: "PENDING" },
      });
    }

    await tx.charge.delete({
      where: { id: charge.id },
    });

  });

  return { replaced: true as const, blocked: false as const, reason: null };
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

// Huỷ 1 buổi đã hoàn thành, hoặc sửa lại điểm danh của 1 buổi đã hoàn thành, đều có
// thể làm SAI LỆCH số buổi/số vắng của charge đã lập cho tháng đó — nếu kỳ thu tháng
// đó đã CHỐT SỔ (POSTED/CLOSED, coi như đã duyệt/đã thu tiền xong), thay đổi buổi học
// lúc này sẽ khiến hóa đơn đã in/đã chốt bị lệch số liệu mà không ai hay biết (không
// có cảnh báo, không tự sinh lại). Trả về billing period đang khóa nếu có, để chặn
// thao tác lại — nhân sự cần "Mở lại kỳ" (REOPENED) trước nếu thực sự cần sửa.
export async function findLockedPeriodForSession(classId: string, sessionDate: Date) {
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { branchId: true } });
  if (!cls) return null;

  const period = await prisma.billingPeriod.findUnique({
    where: { branchId_periodName: { branchId: cls.branchId, periodName: monthKey(sessionDate) } },
  });
  if (!period || canEditCharges(period.status)) return null;

  const hasCharge = await prisma.charge.findFirst({ where: { classId, billingPeriodId: period.id }, select: { id: true } });
  return hasCharge ? period : null;
}

// Phần khóa còn lại chưa lập phiếu của 1 ghi danh theo tháng — null nếu ghi danh chưa đặt
// số buổi khóa (dữ liệu cũ: thu liên tục theo lịch lớp như trước).
export async function getPeriodCourseRemaining(
  enrollment: { id: string; periodCourseSessionCount: number | null },
  excludeChargeId: string | null = null,
) {
  if (enrollment.periodCourseSessionCount == null) return null;
  const billed = await prisma.charge.aggregate({
    where: {
      enrollmentId: enrollment.id,
      billingModel: "PERIOD",
      ...(excludeChargeId ? { id: { not: excludeChargeId } } : {}),
    },
    _sum: { sessionCount: true },
  });
  return Math.max(0, enrollment.periodCourseSessionCount - (billed._sum.sessionCount ?? 0));
}

// Số buổi đã lên phiếu THEO THÁNG ở các kỳ trước của ghi danh này mà chưa được trả tiền.
// Tiền phân bổ không tách học phí/sách nên chia theo tỉ lệ học phí trong phiếu (cùng cách
// scripts/backfill-enrollment-wallets.ts). Làm tròn XUỐNG: thà thu đủ còn hơn bỏ sót.
async function getUnpaidInvoicedSessionsBefore(enrollmentId: string, periodStart: Date) {
  const charges = await prisma.charge.findMany({
    where: { enrollmentId, billingModel: "PERIOD", billingPeriod: { startDate: { lt: periodStart } } },
    include: { allocations: { where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } } } },
  });
  let unpaid = 0;
  for (const charge of charges) {
    if (charge.unitPrice <= 0 || charge.tuitionAmount <= 0) continue;
    const ownDue = charge.tuitionAmount + charge.materialsAmount;
    const paid = charge.allocations.reduce((sum, item) => sum + item.amount, 0);
    const tuitionPaid = Math.min(charge.tuitionAmount, paid * (charge.tuitionAmount / ownDue));
    unpaid += Math.floor((charge.tuitionAmount - tuitionPaid) / charge.unitPrice);
  }
  return unpaid;
}

// Chỉ CỘNG, không bao giờ trừ: lớp hủy bớt buổi thì phần đã thu nằm lại trong ví và tự
// trừ vào phiếu tháng sau. Số dư mang sang (carriedSessionCount) giữ đúng con số đã chốt
// lúc sinh phiếu — tính lại bây giờ sẽ lẫn cả buổi vừa nạp từ chính khoản đã thu này.
// Phiếu có số liệu không khớp công thức (dữ liệu cũ chưa lưu tổng buổi, hoặc đã sửa tay)
// thì không suy ra được đã tính những gì → không tự đụng vào.
async function addLateScheduledSessionsToCollectedCharge(
  charge: {
    id: string;
    studentId: string;
    billingModel: string;
    sessionCount: number;
    scheduledSessionCount: number;
    carriedSessionCount: number;
    absentCount: number;
    deductedCount: number;
    unitPrice: number;
    tuitionAmount: number;
    materialsAmount: number;
    openingBalance: number;
    notes: string | null;
  },
  scheduledSessionCount: number,
  // Số buổi khóa còn được lập phiếu (không tính phiếu này); null = không giới hạn.
  courseRemaining: number | null = null,
) {
  if (charge.billingModel !== "PERIOD" || charge.unitPrice <= 0) return 0;
  const billedByFormula = Math.max(0, charge.scheduledSessionCount - charge.carriedSessionCount);
  const tuitionByFormula = computeTuitionAmount(charge.sessionCount, 0, charge.deductedCount, charge.unitPrice);
  if (charge.scheduledSessionCount <= 0 || billedByFormula !== charge.sessionCount || tuitionByFormula !== charge.tuitionAmount) {
    return 0;
  }

  let lateSessions = Math.max(0, scheduledSessionCount - charge.carriedSessionCount) - charge.sessionCount;
  if (courseRemaining != null) lateSessions = Math.min(lateSessions, courseRemaining - charge.sessionCount);
  if (lateSessions <= 0) return 0;

  const sessionCount = charge.sessionCount + lateSessions;
  const tuitionAmount = computeTuitionAmount(sessionCount, 0, charge.deductedCount, charge.unitPrice);
  const note = `Cộng thêm ${lateSessions} buổi lớp xếp sau khi đã thu (${new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}).`;
  await prisma.$transaction(async (tx) => {
    await tx.charge.update({
      where: { id: charge.id },
      data: {
        sessionCount,
        scheduledSessionCount,
        mainTuitionAmount: tuitionAmount,
        tuitionAmount,
        totalAmount: computeTotalAmount(tuitionAmount, charge.materialsAmount, charge.openingBalance),
        notes: charge.notes ? `${charge.notes}\n${note}` : note,
      },
    });
    // Tiền đóng trước còn treo trên phiếu thu thì trừ luôn vào phần vừa cộng thêm.
    await settleChargesFromAdvancePayments(tx, charge.studentId);
  });
  return lateSessions;
}

export async function generateChargesForPeriod(
  periodId: string,
  // enrollmentId: chỉ sinh phiếu cho ĐÚNG ghi danh này (dùng ngay lúc ghi danh theo tháng
  // — xem generatePeriodChargesForNewEnrollment). Không truyền = cả chi nhánh như cũ.
  options?: { enrollmentId?: string },
) {
  const scopedEnrollmentId = options?.enrollmentId ?? null;
  const period = await prisma.billingPeriod.findUnique({ where: { id: periodId } });
  if (!period) return { error: "Không tìm thấy kỳ thu" as const };
  if (!canEditCharges(period.status)) {
    return { error: `Kỳ đang ở trạng thái "${period.status}", không thể sinh học phí.` as const };
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: "ACTIVE",
      class: { branchId: period.branchId, isRemedial: false },
      ...(scopedEnrollmentId ? { id: scopedEnrollmentId } : {}),
    },
    include: {
      class: { include: { course: true } },
      installments: { where: { billingPeriodId: period.id, status: "PENDING" } },
    },
  });

  const courseCharged = await prisma.charge.findMany({
    where: { billingModel: "COURSE", class: { branchId: period.branchId } },
    select: { id: true, studentId: true, classId: true, enrollmentId: true },
  });
  const courseChargedMap = new Map<string, (typeof courseCharged)[number][]>();
  for (const item of courseCharged) {
    const key = `${item.studentId}:${item.classId}`;
    courseChargedMap.set(key, [...(courseChargedMap.get(key) ?? []), item]);
  }
  // Charge trọn khóa của MỘT enrollment khác (VD: enrollment cũ đã rút) không được
  // tính là "đã có charge" cho enrollment hiện tại — nếu không sẽ chặn nhầm việc sinh
  // charge cho lần ghi danh lại (xem generateCourseCharge bên dưới, cùng gốc rễ).
  // enrollmentId=null (dữ liệu cũ trước khi có cột này, chưa xác định lại được) vẫn
  // coi là liên quan để giữ hành vi an toàn như trước.
  const findRelevantCourseCharge = (courseKey: string, enrollmentId: string) =>
    (courseChargedMap.get(courseKey) ?? []).find((item) => item.enrollmentId === null || item.enrollmentId === enrollmentId) ?? null;

  let created = 0;
  let updated = 0;
  let skippedCourseMode = 0;
  let skippedCourseBilled = 0;
  let skippedInstallmentNotDue = 0;
  const exceptions: GenerationException[] = [];
  const pendingDrafts: PendingChargeDraft[] = [];

  const pushException = (studentId: string, classId: string, reason: string) => {
    exceptions.push({ studentId, classId, reason });
  };

  for (const enrollment of enrollments) {
    if (!enrollment.classId || !enrollment.class) continue;
    const { studentId, classId } = enrollment;
    const courseKey = `${studentId}:${classId}`;

    if (enrollment.billingModel === "COURSE") {
      skippedCourseMode++;
      if (!findRelevantCourseCharge(courseKey, enrollment.id)) {
        pushException(
          studentId,
          classId,
          "Enrollment đang ở mode COURSE nhưng chưa có charge trọn khóa. Cần kiểm tra luồng ghi danh hoặc sinh charge lúc vào học.",
        );
      }
      continue;
    }

    const existingCourseCharge = findRelevantCourseCharge(courseKey, enrollment.id);
    if (existingCourseCharge) {
      const replacement = await replaceChargeIfUncollected(
        existingCourseCharge.id,
        `Enrollment đang ở mode ${enrollment.billingModel} nhưng đã có charge trọn khóa cho lớp này.`,
      );

      if (replacement.blocked) {
        skippedCourseBilled++;
        pushException(studentId, classId, replacement.reason ?? "Không thể thay charge trọn khóa đã thu.");
        continue;
      }

      if (!replacement.replaced) {
        skippedCourseBilled++;
        continue;
      }
    }

    if (enrollment.billingModel === "INSTALLMENT") {
      const installment = enrollment.installments[0];
      if (!installment) {
        skippedInstallmentNotDue++;
        continue;
      }

      let existingCharge = await prisma.charge.findUnique({
        where: {
          studentId_classId_billingPeriodId: { studentId, classId, billingPeriodId: period.id },
        },
      });

      if (existingCharge && existingCharge.billingModel !== "INSTALLMENT") {
        const replacement = await replaceChargeIfUncollected(
          existingCharge.id,
          `Đã có charge mode ${existingCharge.billingModel} trong kỳ ${period.periodName};`,
        );

        if (replacement.blocked) {
          pushException(studentId, classId, replacement.reason ?? "Không thể thay charge đã thu.");
          continue;
        }
        if (replacement.replaced) existingCharge = null;
      }

      if (existingCharge) {
        const collectedAmount = await getChargeCollectedAmount(existingCharge.id);
        if (collectedAmount > 0) {
          pushException(
            studentId,
            classId,
            `Charge trả góp kỳ ${period.periodName} đã thu ${collectedAmount.toLocaleString("vi-VN")}đ nên không được sinh đè.`,
          );
          continue;
        }
      }

      if (existingCharge?.installmentId && existingCharge.installmentId !== installment.id) {
        pushException(
          studentId,
          classId,
          "Charge hiện tại đang gắn với installment khác. Đã chặn cập nhật để tránh lệch đợt thu.",
        );
        continue;
      }

      pendingDrafts.push({
        kind: "INSTALLMENT",
        studentId,
        classId,
        className: enrollment.class.className,
        baseAmount: installment.amount,
        existingChargeId: existingCharge?.id ?? null,
        existingOpeningBalance: existingCharge?.openingBalance ?? null,
        enrollmentId: enrollment.id,
        installmentId: installment.id,
        chargePayload: {
          sessionCount: 0,
          absentCount: 0,
          deductedCount: 0,
          unitPrice: installment.amount,
          tuitionAmount: installment.amount,
          materialsAmount: 0,
          billingModel: "INSTALLMENT",
          installmentId: installment.id,
          notes: `Trả góp ${installment.label}`,
        },
      });
      continue;
    }

    if (enrollment.billingModel !== "PERIOD") {
      pushException(
        studentId,
        classId,
        `Enrollment đang ở mode ${enrollment.billingModel} chưa được phép đi vào sweep tháng. Đã bỏ qua an toàn.`,
      );
      continue;
    }

    const cls = enrollment.class;
    const basePrice = cls.tuitionPerSession ?? cls.course?.tuitionPerSession ?? 0;
    // enrollDate mang cả giờ-phút-giây lúc ghi danh, còn sessionDate luôn chuẩn hóa về
    // UTC-midnight (xem generateSessionDates) — so trực tiếp hai giá trị này làm buổi học
    // CÙNG NGÀY ghi danh (nhưng ghi danh sau 00:00) bị loại nhầm khỏi kỳ thu, mất doanh thu
    // âm thầm không báo lỗi. Phải quy enrollDate về đầu ngày UTC trước khi so.
    const enrollDateStartOfDay = new Date(Date.UTC(enrollment.enrollDate.getUTCFullYear(), enrollment.enrollDate.getUTCMonth(), enrollment.enrollDate.getUTCDate()));
    const sessionRangeStart = enrollDateStartOfDay > period.startDate ? enrollDateStartOfDay : period.startDate;

    // Ví buổi học (lib/server/enrollment-wallet.ts): số buổi lớp DỰ KIẾN của tháng này
    // (đã lên lịch, trừ buổi hủy/đã dời — RESCHEDULED được thay bằng đúng 1 buổi bù
    // nên không đếm buổi gốc) trừ đi số dư đang có trong ví = số buổi CẦN thu thêm để
    // ví đầy lại đúng mức dự kiến. Đây là toàn bộ công thức — không cần "deductedCount
    // do buổi hủy" nữa vì ví tự nhiên không bị trừ khi buổi đó không diễn ra (xem
    // debitWalletsForCompletedSession) nên phần dư luôn tự mang sang tháng sau.
    const scheduledSessionCount = await prisma.classSession.count({
      where: { classId, status: { notIn: ["CANCELLED", "RESCHEDULED"] }, sessionDate: { gte: sessionRangeStart, lte: period.endDate } },
    });
    // Số dư ví như lúc ĐẦU kỳ, không phải số dư ngay lúc bấm — xem
    // getCarriedSessionsForPeriod: sinh lại phiếu giữa tháng sau khi đã dạy vài buổi
    // thì những buổi đó không được tính 2 lần.
    const walletAtPeriodStart = await getCarriedSessionsForPeriod(prisma, enrollment.id, {
      start: period.startDate,
      end: period.endDate,
    });
    // Ví ÂM đầu kỳ vì phụ huynh chưa đóng phiếu tháng trước: những buổi đó ĐÃ nằm trên
    // phiếu tháng trước (vẫn đang đòi ở đó) — tính thêm vào phiếu tháng này là đòi 2 lần
    // (tháng 8 nợ 9 buổi thì phiếu tháng 9 thành 17 buổi). Chỉ bù phần âm, tối đa bằng
    // số buổi còn nợ trên các phiếu cũ; phần âm KHÔNG có phiếu nào đòi (buổi dạy thêm
    // chưa lên phiếu) thì vẫn thu như cũ.
    const walletBalanceBeforeCharge =
      walletAtPeriodStart < 0
        ? Math.min(0, walletAtPeriodStart + (await getUnpaidInvoicedSessionsBefore(enrollment.id, period.startDate)))
        : walletAtPeriodStart;
    let sessionCount = Math.max(0, scheduledSessionCount - walletBalanceBeforeCharge);
    const absentCount = await prisma.studentAttendance.count({
      where: {
        studentId,
        status: "ABSENT",
        session: { classId, status: "COMPLETED", sessionDate: { gte: sessionRangeStart, lte: period.endDate } },
      },
    });

    const [scholarships, adjustments, materials, existingCharge] = await Promise.all([
      prisma.scholarship.findMany({
        where: {
          enrollmentId: enrollment.id,
          effectiveFrom: { lte: period.endDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }],
        },
      }),
      prisma.adjustment.findMany({
        where: {
          studentId,
          // enrollmentId=null nghĩa là áp cho MỌI lớp học viên đang học — chỉ khớp
          // thêm những điều chỉnh CHỌN đúng lớp này (xem prisma/schema.prisma).
          OR: [{ enrollmentId: null }, { enrollmentId: enrollment.id }],
          effectiveFrom: { lte: period.endDate },
          AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }] }],
        },
      }),
      prisma.bookIssue.aggregate({
        where: { studentId, classId, issueDate: { gte: period.startDate, lte: period.endDate } },
        _sum: { amount: true },
      }),
      prisma.charge.findUnique({
        where: {
          studentId_classId_billingPeriodId: { studentId, classId, billingPeriodId: period.id },
        },
      }),
    ]);

    let chargeToUpdate = existingCharge;
    if (existingCharge && existingCharge.billingModel !== "PERIOD") {
      const replacement = await replaceChargeIfUncollected(
        existingCharge.id,
        `Đã có charge mode ${existingCharge.billingModel} trong kỳ ${period.periodName};`,
      );

      if (replacement.blocked) {
        pushException(studentId, classId, replacement.reason ?? "Không thể thay charge đã thu.");
        continue;
      }
      if (replacement.replaced) chargeToUpdate = null;
    }

    // Đóng theo tháng nhưng học theo SỐ BUỔI CỦA KHÓA: phiếu tháng này không được vượt
    // phần khóa còn lại chưa lập phiếu (tháng cuối khóa chỉ thu đúng số buổi còn lại, đủ
    // khóa thì thôi thu). Phiếu của CHÍNH kỳ này (nếu đang sinh lại) không tính vào "đã lập".
    const courseRemaining = await getPeriodCourseRemaining(enrollment, chargeToUpdate?.id ?? null);
    if (courseRemaining != null) sessionCount = Math.min(sessionCount, courseRemaining);

    if (chargeToUpdate) {
      const collectedAmount = await getChargeCollectedAmount(chargeToUpdate.id);
      if (collectedAmount > 0) {
        // Phiếu đã thu thì không sinh đè — nhưng lớp xếp THÊM buổi trong tháng sau lúc thu
        // (lớp kéo dài, lịch tự sinh thêm) thì phải cộng thêm đúng số buổi đó, nếu không
        // chúng không nằm trên phiếu nào: ví về 0 rồi âm mà vẫn "Không nợ".
        const lateSessions = await addLateScheduledSessionsToCollectedCharge(chargeToUpdate, scheduledSessionCount, courseRemaining);
        if (lateSessions > 0) {
          updated++;
          continue;
        }
        pushException(
          studentId,
          classId,
          `Charge tháng ${period.periodName} đã thu ${collectedAmount.toLocaleString("vi-VN")}đ nên không được sinh đè.`,
        );
        continue;
      }
    }

    const scholarshipPct = scholarships.reduce((sum, item) => sum + item.percentage, 0);
    const adjustmentPct = adjustments.reduce((sum, item) => sum + item.percentage, 0);
    const unitPrice = computeEffectiveUnitPrice(basePrice, scholarshipPct, adjustmentPct);
    // deductedCount giữ lại cho dữ liệu CŨ (trừ tay trước khi có Ví) — không còn cần
    // cho charge mới, vì buổi dư do trung tâm hủy đã tự nằm trong walletBalanceBeforeCharge
    // ở trên rồi (không debit ví khi buổi không diễn ra), không phải tính riêng nữa.
    const deductedCount = chargeToUpdate?.deductedCount ?? 0;

    // Buổi quy đổi khi chuyển lớp (enrollment.transferredConvertedSessionCount) giờ
    // đã được cộng THẲNG vào ví của enrollment mới ngay lúc chuyển (xem
    // transferWalletToNewEnrollment trong lib/server/enrollment-wallet.ts) — nó đã
    // nằm trong walletBalanceBeforeCharge ở trên, KHÔNG trừ thêm 1 lần nữa ở đây nữa
    // (khác bản cũ trước khi có Ví, phải tự trừ tay bằng transferCreditAmount).
    const transferCreditSessionCount = 0;
    const transferCreditAmount = 0;

    const tuitionAmount = computeTuitionAmount(sessionCount, 0, deductedCount, unitPrice);
    const materialsAmount = materials._sum.amount ?? 0;

    pendingDrafts.push({
      kind: "PERIOD",
      studentId,
      classId,
      className: enrollment.class.className,
      baseAmount: tuitionAmount + materialsAmount,
      existingChargeId: chargeToUpdate?.id ?? null,
      existingOpeningBalance: chargeToUpdate?.openingBalance ?? null,
      enrollmentId: enrollment.id,
      issueStart: period.startDate,
      issueEnd: period.endDate,
      chargePayload: {
        sessionCount,
        // Lưu lại ĐÚNG hai con số đã dùng để ra sessionCount, để phiếu báo học phí tự
        // giải thích được: tổng buổi lớp dự kiến dạy trong kỳ, trừ số buổi còn dư mang
        // sang từ kỳ trước, ra số buổi thực thu. Không lưu thì sau này không dựng lại
        // được (số dư ví đã thay đổi) và phiếu chỉ còn mỗi con số cuối, phụ huynh không
        // kiểm được.
        scheduledSessionCount,
        carriedSessionCount: walletBalanceBeforeCharge,
        absentCount,
        deductedCount,
        unitPrice,
        mainTuitionAmount: tuitionAmount,
        paidCatchupAmount: 0,
        transferCreditAmount,
        transferCreditSessionCount,
        tuitionAmount,
        materialsAmount,
        billingModel: "PERIOD",
      },
    });
  }

  const draftsByStudent = new Map<string, PendingChargeDraft[]>();
  for (const draft of pendingDrafts) {
    draftsByStudent.set(draft.studentId, [...(draftsByStudent.get(draft.studentId) ?? []), draft]);
  }

  for (const [studentId, studentDrafts] of draftsByStudent.entries()) {
    const orderedDrafts = [...studentDrafts].sort((left, right) => {
      if (right.baseAmount !== left.baseAmount) return right.baseAmount - left.baseAmount;
      return left.className.localeCompare(right.className, "vi");
    });

    // Nếu học viên ĐÃ có charge nào trong CHÍNH kỳ này (đang sinh lại, không phải lần
    // đầu), quyết định "trừ bao nhiêu credit để bù nợ đầu kỳ" đã CHỐT ở lần sinh
    // trước rồi. computeBalanceSnapshot chỉ nhìn charge/allocation để tính nợ, không
    // hề biết credit đã được "coi như" dùng để bù ở lần chạy trước — nếu cứ tính và
    // trừ credit lại mỗi lần, "Sinh học phí" (thao tác được phép bấm lại nhiều lần
    // khi kỳ còn GENERATED, đúng quy trình sửa sai trước khi chốt sổ) sẽ trừ liên
    // tục vào CreditBalance cho CÙNG một khoản nợ cũ chưa hề đổi, rút cạn tiền dư
    // thật của phụ huynh dù nợ đó chỉ cần bù đúng 1 lần. Vì vậy: chỉ tính/trừ credit
    // khi đây thật sự là charge MỚI (existingChargeId null) của học viên trong kỳ
    // này; nếu đang cập nhật charge đã có, giữ nguyên đúng openingBalance đã chốt.
    // Khi chỉ sinh cho 1 ghi danh, các phiếu KHÁC của học viên trong cùng kỳ (lớp khác)
    // không nằm trong orderedDrafts nên vòng trên không thấy — nhưng một trong số đó đã
    // gánh nợ đầu kỳ rồi. Coi như đang sinh lại: phiếu mới không mang nợ cũ lần 2, không
    // trừ credit lần 2. Chỉ áp khi sinh riêng lẻ để không đổi hành vi của đợt thu cả kỳ.
    const hasOtherChargeInPeriod = scopedEnrollmentId
      ? (await prisma.charge.count({
          where: {
            studentId,
            billingPeriodId: period.id,
            classId: { notIn: orderedDrafts.map((draft) => draft.classId) },
          },
        })) > 0
      : false;
    const isRegeneration = hasOtherChargeInPeriod || orderedDrafts.some((draft) => draft.existingChargeId !== null);

    await prisma.$transaction(async (tx) => {
      const anchorDraft = orderedDrafts[0] ?? null;

      let anchorOpeningBalance = 0;
      if (!isRegeneration && anchorDraft) {
        const snapshot = await computeBalanceSnapshot(studentId, period.startDate, tx);
        // Credit is carried value from earlier periods; it may clear only the
        // carried debt, never the current period's newly generated tuition.
        const anchorCreditToApply = Math.min(
          Math.max(snapshot.debtBeforeCredits, 0),
          snapshot.availableCreditAmount,
        );
        anchorOpeningBalance = Math.max(snapshot.debtBeforeCredits - anchorCreditToApply, 0);

        if (anchorCreditToApply > 0) {
          await consumeCreditBalances(snapshot.availableCredits, anchorCreditToApply, new Date(), tx);
        }
      }

      for (const draft of orderedDrafts) {
        const openingBalance = draft.existingChargeId
          ? draft.existingOpeningBalance ?? 0
          : draft === anchorDraft
            ? anchorOpeningBalance
            : 0;
        const totalAmount = computeTotalAmount(
          draft.chargePayload.tuitionAmount,
          draft.chargePayload.materialsAmount,
          openingBalance,
        );

        let chargeId = draft.existingChargeId;
        const payload = {
          ...draft.chargePayload,
          openingBalance,
          totalAmount,
        };

        if (chargeId) {
          await tx.charge.update({
            where: { id: chargeId },
            data: { ...payload, enrollmentId: draft.enrollmentId },
          });
          updated++;
        } else {
          const createdCharge = await tx.charge.create({
            data: {
              studentId: draft.studentId,
              classId: draft.classId,
              billingPeriodId: period.id,
              enrollmentId: draft.enrollmentId,
              ...payload,
            },
          });
          chargeId = createdCharge.id;
          created++;
        }

        if (draft.kind === "INSTALLMENT") {
          await tx.enrollmentInstallment.update({
            where: { id: draft.installmentId },
            data: { status: "CHARGED" },
          });
        }

        if (draft.kind === "PERIOD" && chargeId) {
          await tx.bookIssue.updateMany({
            where: {
              studentId: draft.studentId,
              classId: draft.classId,
              issueDate: { gte: draft.issueStart, lte: draft.issueEnd },
            },
            data: { chargeId },
          });
        }
      }

      // Học viên đã đóng trước (tiền còn nằm trên phiếu thu, chưa gắn phiếu học phí
      // nào) thì phiếu vừa sinh phải tự trừ vào khoản đó ngay — đúng như cột "HP tồn
      // tháng trước" âm trong file quản lý thật, phụ huynh không phải đóng lại.
      await settleChargesFromAdvancePayments(tx, studentId);
    });
  }

  // Sinh phiếu cho 1 ghi danh lẻ KHÔNG đánh dấu cả kỳ là "đã sinh học phí" — các học
  // viên khác của kỳ này vẫn chưa có phiếu.
  if (period.status === "DRAFT" && !scopedEnrollmentId) {
    await prisma.billingPeriod.update({
      where: { id: period.id },
      data: { status: "GENERATED" },
    });
  }

  return {
    created,
    updated,
    skippedCourseMode,
    skippedCourseBilled,
    skippedInstallmentNotDue,
    exceptionCount: exceptions.length,
    exceptions,
    totalEnrollments: enrollments.length,
  };
}

// Ghi danh THEO THÁNG xong là có phiếu ngay cho tháng đang học — nhất quán với gói theo
// khóa (generateCourseCharge chạy lúc ghi danh). Trước đây phải đợi đợt thu tự động
// ngày 1 tháng SAU: em vào 15/9 học trọn nửa tháng không có phiếu nào, ví âm dần, rồi
// 1/10 phụ huynh nhận một phiếu gộp to bất ngờ.
//
// Sinh cho mọi tháng từ tháng ghi danh tới tháng hiện tại (thường chỉ 1 tháng; nhiều
// hơn khi nhân viên ghi danh lùi ngày). Công thức số buổi dùng chung với đợt thu cả kỳ
// nên tháng đầu tự thu lẻ đúng số buổi từ ngày vào. Không bao giờ ném lỗi — kỳ đã khóa
// hay lỗi dữ liệu thì trả về cảnh báo để ghi danh vẫn thành công.
export async function generatePeriodChargesForNewEnrollment(enrollmentId: string, now: Date = new Date()) {
  const warnings: string[] = [];
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { class: { select: { branchId: true, isRemedial: true } } },
  });
  if (!enrollment || enrollment.billingModel !== "PERIOD" || !enrollment.class || enrollment.class.isRemedial) {
    return { warnings };
  }

  const startKey = monthKey(enrollment.enrollDate);
  const nowKey = monthKey(now);
  const months: string[] = [];
  const [startYear, startMonth] = startKey.split("-").map(Number);
  for (let offset = 0; offset < 12; offset += 1) {
    const key = monthKey(new Date(Date.UTC(startYear, startMonth - 1 + offset, 1)));
    months.push(key);
    if (key >= nowKey) break;
  }

  for (const periodName of months) {
    const period = await ensureBillingPeriod(enrollment.class.branchId, periodName);
    const result = await generateChargesForPeriod(period.id, { enrollmentId });
    if ("error" in result) {
      warnings.push(`Tháng ${periodName}: ${result.error}`);
      continue;
    }
    for (const exception of result.exceptions) warnings.push(`Tháng ${periodName}: ${exception.reason}`);
  }
  return { warnings };
}

export async function generateCourseCharge(enrollmentId: string, options?: { billingPeriodId?: string }) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { class: { include: { course: true } } },
  });

  if (!enrollment) return { error: "Không tìm thấy ghi danh" as const };
  if (enrollment.billingModel !== "COURSE") {
    return { error: `Ghi danh này đang ở mode ${enrollment.billingModel}, không được sinh charge trọn khóa.` as const };
  }

  const cls = enrollment.class;
  if (!cls || !enrollment.classId) {
    return { error: "Gói học chưa được gán vào lớp cụ thể để tính học phí." as const };
  }
  const totalSessions = resolvePurchasedMainSessions(enrollment);
  if (!totalSessions || totalSessions <= 0) {
    return { error: `Lớp "${cls.className}" chưa cấu hình tổng số buổi (totalSessions), không thể tính học phí trọn khóa.` as const };
  }

  const existing = await prisma.charge.findFirst({
    where: {
      studentId: enrollment.studentId,
      classId: enrollment.classId,
      billingModel: "COURSE",
      OR: [{ enrollmentId: null }, { enrollmentId: enrollment.id }],
    },
  });
  // Nếu ĐÃ có charge trọn khóa cho đúng lớp này (đang sinh lại charge COURSE, không
  // phải chuyển từ mode khác sang) — giữ lại đúng openingBalance đã chốt của nó
  // TRƯỚC KHI xoá, để không tính/trừ credit lại lần nữa cho cùng một khoản nợ cũ
  // (cùng lỗi đã sửa ở generateChargesForPeriod: sinh lại charge nhiều lần không
  // được phép rút thêm CreditBalance mỗi lần bấm).
  let preservedOpeningBalance: number | null = null;
  if (existing) {
    const replacement = await replaceChargeIfUncollected(existing.id, "Học viên đã có charge trọn khóa cho lớp này.");
    if (replacement.blocked) {
      return { error: replacement.reason ?? "Charge trọn khóa này đã thu nên không thể sinh lại." };
    }
    preservedOpeningBalance = existing.openingBalance;
  }

  const conflictingPeriodOrInstallment = await prisma.charge.findMany({
    where: {
      studentId: enrollment.studentId,
      classId: enrollment.classId,
      billingModel: { in: ["PERIOD", "INSTALLMENT"] },
    },
  });

  for (const conflict of conflictingPeriodOrInstallment) {
    const replacement = await replaceChargeIfUncollected(
      conflict.id,
      `Đã tồn tại charge mode ${conflict.billingModel} cho lớp này.`,
    );

    if (replacement.blocked) {
      return { error: replacement.reason ?? `Charge ${conflict.billingModel} này đã thu nên không thể sinh lại.` };
    }
  }

  const basePrice = enrollment.tuitionUnitPriceSnapshot ?? cls.tuitionPerSession ?? cls.course?.tuitionPerSession ?? 0;
  const period = options?.billingPeriodId
    ? await prisma.billingPeriod.findUnique({ where: { id: options.billingPeriodId } })
    : await ensureBillingPeriod(cls.branchId, periodNameFromDate(enrollment.enrollDate));

  if (!period) {
    return { error: "Không tìm thấy kỳ thu để gắn phiếu trọn khóa." as const };
  }

  if (period.branchId !== cls.branchId) {
    return { error: "Kỳ thu không thuộc cùng cơ sở với lớp học." as const };
  }

  const [scholarships, adjustments, detachedBookIssues] = await Promise.all([
    prisma.scholarship.findMany({
      where: {
        enrollmentId: enrollment.id,
        effectiveFrom: { lte: enrollment.enrollDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: enrollment.enrollDate } }],
      },
    }),
    prisma.adjustment.findMany({
      where: {
        studentId: enrollment.studentId,
        OR: [{ enrollmentId: null }, { enrollmentId: enrollment.id }],
        effectiveFrom: { lte: enrollment.enrollDate },
        AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: enrollment.enrollDate } }] }],
      },
    }),
    prisma.bookIssue.findMany({
      where: {
        studentId: enrollment.studentId,
        classId: enrollment.classId,
        chargeId: null,
        paymentStatus: { not: "PAID" },
      },
      select: { id: true, amount: true },
    }),
  ]);

  // Đơn giá chốt (tuitionUnitPriceSnapshot) mang 2 nghĩa khác nhau tùy nguồn:
  //   - Ghi danh MỚI: giá thỏa thuận CHƯA trừ chiết khấu → chiết khấu phải áp lên nó.
  //     Trước đây mọi snapshot đều bị coi là giá cuối, nên chiết khấu nhập ngay lúc gán
  //     lớp trọn khóa bị bỏ qua âm thầm, phụ huynh bị thu đủ giá (tests/enrollment.test.ts).
  //   - CHUYỂN LỚP (transfer / kết thúc lớp): đã lưu giá SAU khi áp % mang sang, kèm bản
  //     ghi chiết khấu chỉ để hiển thị/mang tiếp — áp lần nữa là trừ chiết khấu 2 lần.
  const snapshotIsDiscounted = enrollment.pricingBasis === "CONTINUATION_TRANSFER" && enrollment.tuitionUnitPriceSnapshot != null;
  const scholarshipPct = snapshotIsDiscounted ? 0 : scholarships.reduce((sum, item) => sum + item.percentage, 0);
  const adjustmentPct = snapshotIsDiscounted ? 0 : adjustments.reduce((sum, item) => sum + item.percentage, 0);
  const unitPrice = computeEffectiveUnitPrice(basePrice, scholarshipPct, adjustmentPct);
  const paidCatchupUnitPrice = enrollment.paidCatchupUnitPrice ?? unitPrice;
  const mainTuitionAmount = totalSessions * unitPrice;
  const paidCatchupAmount = enrollment.paidCatchupSessionCount * paidCatchupUnitPrice;
  const transferCreditAmount = Math.min(enrollment.transferredValueAmount, mainTuitionAmount + paidCatchupAmount);
  const transferRemainderAmount = Math.max(0, enrollment.transferredValueAmount - (mainTuitionAmount + paidCatchupAmount));
  const tuitionAmount = mainTuitionAmount + paidCatchupAmount - transferCreditAmount;
  const materialsAmount = detachedBookIssues.reduce((sum, item) => sum + item.amount, 0);

  const charge = await prisma.$transaction(async (tx) => {
    const balanceAnchorDate = options?.billingPeriodId ? period.startDate : enrollment.enrollDate;
    const chargeBaseAmount = tuitionAmount + materialsAmount;

    let openingBalance: number;
    if (preservedOpeningBalance !== null) {
      openingBalance = preservedOpeningBalance;
    } else {
      const snapshot = await computeBalanceSnapshot(enrollment.studentId, balanceAnchorDate, tx);
      // A course charge follows the same rule as period billing: unused credit
      // settles prior debt only, so a new charge can never be made negative.
      const creditToApply = Math.min(
        Math.max(snapshot.debtBeforeCredits, 0),
        snapshot.availableCreditAmount,
      );
      openingBalance = Math.max(snapshot.debtBeforeCredits - creditToApply, 0);

      if (creditToApply > 0) {
        await consumeCreditBalances(snapshot.availableCredits, creditToApply, new Date(), tx);
      }
    }
    const totalAmount = computeTotalAmount(tuitionAmount, materialsAmount, openingBalance);

    const createdCharge = await tx.charge.create({
      data: {
        studentId: enrollment.studentId,
        classId: enrollment.classId!,
        billingPeriodId: period.id,
        sessionCount: totalSessions,
        absentCount: 0,
        deductedCount: 0,
        unitPrice,
        mainTuitionAmount,
        paidCatchupAmount,
        transferCreditAmount,
        transferRemainderAmount,
        tuitionAmount,
        materialsAmount,
        openingBalance,
        totalAmount,
        billingModel: "COURSE",
        notes: [
          `Hoc phi khoa chinh ${cls.className}: ${totalSessions} buoi x ${unitPrice.toLocaleString("vi-VN")}d`,
          enrollment.paidCatchupSessionCount > 0
            ? `Bo tro dau khoa: ${enrollment.paidCatchupSessionCount} buoi x ${paidCatchupUnitPrice.toLocaleString("vi-VN")}d`
            : null,
          transferCreditAmount > 0 ? `Bu tru chuyen lop: ${transferCreditAmount.toLocaleString("vi-VN")}d` : null,
          transferRemainderAmount > 0 ? `Tien du sau quy doi: ${transferRemainderAmount.toLocaleString("vi-VN")}d` : null,
        ].filter(Boolean).join(" · "),
        enrollmentId: enrollment.id,
      },
    });

    if (detachedBookIssues.length > 0) {
      await tx.bookIssue.updateMany({
        where: { id: { in: detachedBookIssues.map((item) => item.id) } },
        data: { chargeId: createdCharge.id },
      });
    }

    await settleChargesFromAdvancePayments(tx, enrollment.studentId);

    return createdCharge;
  });

  return { charge };
}

export async function previewChargeGenerationExceptions(periodId: string) {
  const period = await prisma.billingPeriod.findUnique({ where: { id: periodId } });
  if (!period) return { error: "Không tìm thấy kỳ thu" as const };

  const enrollments = await prisma.enrollment.findMany({
    where: { status: "ACTIVE", class: { branchId: period.branchId, isRemedial: false } },
    include: {
      student: { select: { id: true, fullName: true, studentCode: true } },
      class: true,
      installments: { where: { billingPeriodId: period.id, status: "PENDING" } },
    },
  });

  const courseCharged = await prisma.charge.findMany({
    where: { billingModel: "COURSE", class: { branchId: period.branchId } },
    select: { id: true, studentId: true, classId: true, enrollmentId: true },
  });
  const courseChargedMap = new Map<string, (typeof courseCharged)[number][]>();
  for (const item of courseCharged) {
    const key = `${item.studentId}:${item.classId}`;
    courseChargedMap.set(key, [...(courseChargedMap.get(key) ?? []), item]);
  }
  const findRelevantCourseCharge = (courseKey: string, enrollmentId: string) =>
    (courseChargedMap.get(courseKey) ?? []).find((item) => item.enrollmentId === null || item.enrollmentId === enrollmentId) ?? null;

  const exceptions: GenerationExceptionPreview[] = [];
  const pushException = (enrollment: (typeof enrollments)[number], reason: string) => {
    exceptions.push({
      studentId: enrollment.studentId,
      classId: enrollment.classId ?? "",
      studentName: enrollment.student.fullName,
      studentCode: enrollment.student.studentCode,
      className: enrollment.class?.className ?? "Gói học",
      billingModel: enrollment.billingModel,
      reason,
    });
  };

  for (const enrollment of enrollments) {
    const courseKey = `${enrollment.studentId}:${enrollment.classId}`;

    if (enrollment.billingModel === "COURSE") {
      if (!findRelevantCourseCharge(courseKey, enrollment.id)) {
        pushException(
          enrollment,
          "Mode COURSE nhưng chưa có charge trọn khóa. Cần kiểm tra luồng ghi danh hoặc sinh charge khi vào học.",
        );
      }
      continue;
    }

    const existingCourseCharge = findRelevantCourseCharge(courseKey, enrollment.id);
    if (existingCourseCharge) {
      const collectedAmount = await getChargeCollectedAmount(existingCourseCharge.id);
      if (collectedAmount > 0) {
        pushException(
          enrollment,
          `Mode ${enrollment.billingModel} nhưng đã có charge trọn khóa đã thu ${collectedAmount.toLocaleString("vi-VN")}đ cho lớp này.`,
        );
      }
      continue;
    }

    if (enrollment.billingModel === "INSTALLMENT") {
      const installment = enrollment.installments[0];
      if (!installment || !enrollment.classId) continue;

      const existingCharge = await prisma.charge.findUnique({
        where: {
          studentId_classId_billingPeriodId: {
            studentId: enrollment.studentId,
            classId: enrollment.classId,
            billingPeriodId: period.id,
          },
        },
      });

      if (existingCharge && existingCharge.billingModel !== "INSTALLMENT") {
        const collectedAmount = await getChargeCollectedAmount(existingCharge.id);
        if (collectedAmount > 0) {
          pushException(
            enrollment,
            `Đã có charge mode ${existingCharge.billingModel} trong kỳ ${period.periodName} và đã thu ${collectedAmount.toLocaleString("vi-VN")}đ.`,
          );
        }
        continue;
      }

      if (existingCharge?.installmentId && existingCharge.installmentId !== installment.id) {
        pushException(enrollment, "Charge hiện tại đang gắn với installment khác.");
      }
      continue;
    }

    if (enrollment.billingModel !== "PERIOD") {
      pushException(enrollment, `Mode ${enrollment.billingModel} chưa được phép đi vào sweep tháng.`);
      continue;
    }

    if (!enrollment.classId) continue;

    const existingCharge = await prisma.charge.findUnique({
      where: {
        studentId_classId_billingPeriodId: {
          studentId: enrollment.studentId,
          classId: enrollment.classId,
          billingPeriodId: period.id,
        },
      },
    });

    if (existingCharge && existingCharge.billingModel !== "PERIOD") {
      const collectedAmount = await getChargeCollectedAmount(existingCharge.id);
      if (collectedAmount > 0) {
        pushException(
          enrollment,
          `Đã có charge mode ${existingCharge.billingModel} trong kỳ ${period.periodName} và đã thu ${collectedAmount.toLocaleString("vi-VN")}đ.`,
        );
      }
    }
  }

  return {
    periodId: period.id,
    periodName: period.periodName,
    exceptionCount: exceptions.length,
    exceptions,
  };
}
