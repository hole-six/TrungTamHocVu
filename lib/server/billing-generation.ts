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
import { resolvePurchasedMainSessions } from "@/lib/server/enrollment-learning";

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
      enrollmentId: string;
      installmentId: string;
      chargePayload: {
        sessionCount: number;
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
      enrollmentId: string;
      issueStart: Date;
      issueEnd: Date;
      chargePayload: {
        sessionCount: number;
        absentCount: number;
        deductedCount: number;
        unitPrice: number;
        mainTuitionAmount?: number;
        paidCatchupAmount?: number;
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

export async function generateChargesForPeriod(periodId: string) {
  const period = await prisma.billingPeriod.findUnique({ where: { id: periodId } });
  if (!period) return { error: "Không tìm thấy kỳ thu" as const };
  if (!canEditCharges(period.status)) {
    return { error: `Kỳ đang ở trạng thái "${period.status}", không thể sinh học phí.` as const };
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { status: "ACTIVE", class: { branchId: period.branchId, isRemedial: false } },
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

    const sessionCount = await prisma.classSession.count({
      where: { classId, status: "COMPLETED", sessionDate: { gte: sessionRangeStart, lte: period.endDate } },
    });
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

    if (chargeToUpdate) {
      const collectedAmount = await getChargeCollectedAmount(chargeToUpdate.id);
      if (collectedAmount > 0) {
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
    const deductedCount = chargeToUpdate?.deductedCount ?? 0;
    const tuitionAmount = computeTuitionAmount(sessionCount, 0, deductedCount, unitPrice);
    const materialsAmount = materials._sum.amount ?? 0;

    pendingDrafts.push({
      kind: "PERIOD",
      studentId,
      classId,
      className: enrollment.class.className,
      baseAmount: tuitionAmount + materialsAmount,
      existingChargeId: chargeToUpdate?.id ?? null,
      enrollmentId: enrollment.id,
      issueStart: period.startDate,
      issueEnd: period.endDate,
      chargePayload: {
        sessionCount,
        absentCount,
        deductedCount,
        unitPrice,
        mainTuitionAmount: tuitionAmount,
        paidCatchupAmount: 0,
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

    await prisma.$transaction(async (tx) => {
      const snapshot = await computeBalanceSnapshot(studentId, period.startDate, tx);
      const anchorDraft = orderedDrafts[0] ?? null;

      let anchorOpeningBalance = 0;
      let anchorCreditToApply = 0;
      if (anchorDraft) {
        // Credit is carried value from earlier periods; it may clear only the
        // carried debt, never the current period's newly generated tuition.
        anchorCreditToApply = Math.min(
          Math.max(snapshot.debtBeforeCredits, 0),
          snapshot.availableCreditAmount,
        );
        anchorOpeningBalance = Math.max(snapshot.debtBeforeCredits - anchorCreditToApply, 0);
      }

      if (anchorCreditToApply > 0) {
        await consumeCreditBalances(snapshot.availableCredits, anchorCreditToApply, new Date(), tx);
      }

      for (const draft of orderedDrafts) {
        const openingBalance = draft === anchorDraft ? anchorOpeningBalance : 0;
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
    });
  }

  if (period.status === "DRAFT") {
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
  if (existing) {
    const replacement = await replaceChargeIfUncollected(existing.id, "Học viên đã có charge trọn khóa cho lớp này.");
    if (replacement.blocked) {
      return { error: replacement.reason ?? "Charge trọn khóa này đã thu nên không thể sinh lại." };
    }
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

  const scholarshipPct = enrollment.tuitionUnitPriceSnapshot ? 0 : scholarships.reduce((sum, item) => sum + item.percentage, 0);
  const adjustmentPct = enrollment.tuitionUnitPriceSnapshot ? 0 : adjustments.reduce((sum, item) => sum + item.percentage, 0);
  const unitPrice = enrollment.tuitionUnitPriceSnapshot ?? computeEffectiveUnitPrice(basePrice, scholarshipPct, adjustmentPct);
  const paidCatchupUnitPrice = enrollment.paidCatchupUnitPrice ?? unitPrice;
  const mainTuitionAmount = totalSessions * unitPrice;
  const paidCatchupAmount = enrollment.paidCatchupSessionCount * paidCatchupUnitPrice;
  const transferCreditAmount = Math.min(enrollment.transferredValueAmount, mainTuitionAmount + paidCatchupAmount);
  const transferRemainderAmount = Math.max(0, enrollment.transferredValueAmount - (mainTuitionAmount + paidCatchupAmount));
  const tuitionAmount = mainTuitionAmount + paidCatchupAmount - transferCreditAmount;
  const materialsAmount = detachedBookIssues.reduce((sum, item) => sum + item.amount, 0);

  const charge = await prisma.$transaction(async (tx) => {
    const balanceAnchorDate = options?.billingPeriodId ? period.startDate : enrollment.enrollDate;
    const snapshot = await computeBalanceSnapshot(enrollment.studentId, balanceAnchorDate, tx);
    const chargeBaseAmount = tuitionAmount + materialsAmount;
    // A course charge follows the same rule as period billing: unused credit
    // settles prior debt only, so a new charge can never be made negative.
    const creditToApply = Math.min(
      Math.max(snapshot.debtBeforeCredits, 0),
      snapshot.availableCreditAmount,
    );
    const openingBalance = Math.max(snapshot.debtBeforeCredits - creditToApply, 0);
    const totalAmount = computeTotalAmount(tuitionAmount, materialsAmount, openingBalance);

    if (creditToApply > 0) {
      await consumeCreditBalances(snapshot.availableCredits, creditToApply, new Date(), tx);
    }

    const createdCharge = await tx.charge.create({
      data: {
        studentId: enrollment.studentId,
        classId: enrollment.classId,
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
      classId: enrollment.classId,
      studentName: enrollment.student.fullName,
      studentCode: enrollment.student.studentCode,
      className: enrollment.class.className,
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
      if (!installment) continue;

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
