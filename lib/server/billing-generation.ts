import { prisma } from "@/lib/prisma";
import {
  computeEffectiveUnitPrice,
  computeTuitionAmount,
  computeTotalAmount,
  canEditCharges,
  monthRange,
} from "@/lib/server/tuition-rules";
import { computeBalanceSnapshot, consumeCreditBalances } from "@/lib/server/balance";

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
      installmentId: string;
      chargePayload: {
        sessionCount: number;
        absentCount: number;
        deductedCount: number;
        unitPrice: number;
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
      issueStart: Date;
      issueEnd: Date;
      chargePayload: {
        sessionCount: number;
        absentCount: number;
        deductedCount: number;
        unitPrice: number;
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

async function getChargeCollectedAmount(chargeId: string) {
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
      reason: `${reasonWhenCollected} Charge nÃ y Ä‘Ã£ Ä‘Æ°á»£c thu ${collectedAmount.toLocaleString("vi-VN")}Ä‘ nÃªn khÃ´ng Ä‘Æ°á»£c tá»± thay tháº¿.`,
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

export async function generateChargesForPeriod(periodId: string) {
  const period = await prisma.billingPeriod.findUnique({ where: { id: periodId } });
  if (!period) return { error: "KhÃ´ng tÃ¬m tháº¥y ká»³ thu" as const };
  if (!canEditCharges(period.status)) {
    return { error: `Ká»³ Ä‘ang á»Ÿ tráº¡ng thÃ¡i "${period.status}", khÃ´ng thá»ƒ sinh há»c phÃ­.` as const };
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { status: "ACTIVE", class: { branchId: period.branchId } },
    include: {
      class: { include: { course: true } },
      installments: { where: { billingPeriodId: period.id, status: "PENDING" } },
    },
  });

  const courseCharged = await prisma.charge.findMany({
    where: { billingModel: "COURSE", class: { branchId: period.branchId } },
    select: { id: true, studentId: true, classId: true },
  });
  const courseChargedMap = new Map<string, (typeof courseCharged)[number]>(
    courseCharged.map((item) => [`${item.studentId}:${item.classId}`, item]),
  );

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
      if (!courseChargedMap.has(courseKey)) {
        pushException(
          studentId,
          classId,
          "Enrollment Ä‘ang á»Ÿ mode COURSE nhÆ°ng chÆ°a cÃ³ charge trá»n khÃ³a. Cáº§n kiá»ƒm tra luá»“ng ghi danh hoáº·c sinh charge lÃºc vÃ o há»c.",
        );
      }
      continue;
    }

    const existingCourseCharge = courseChargedMap.get(courseKey);
    if (existingCourseCharge) {
      const replacement = await replaceChargeIfUncollected(
        existingCourseCharge.id,
        `Enrollment Ä‘ang á»Ÿ mode ${enrollment.billingModel} nhÆ°ng Ä‘Ã£ cÃ³ charge trá»n khÃ³a cho lá»›p nÃ y.`,
      );

      if (replacement.blocked) {
        skippedCourseBilled++;
        pushException(studentId, classId, replacement.reason ?? "KhÃ´ng thá»ƒ thay charge trá»n khÃ³a Ä‘Ã£ thu.");
        continue;
      }

      if (!replacement.replaced) {
        skippedCourseBilled++;
        continue;
      }

      courseChargedMap.delete(courseKey);
    }

    if (enrollment.billingModel === "INSTALLMENT") {
      const installment = enrollment.installments[0];
      if (!installment) {
        skippedInstallmentNotDue++;
        continue;
      }

      const existingCharge = await prisma.charge.findUnique({
        where: {
          studentId_classId_billingPeriodId: { studentId, classId, billingPeriodId: period.id },
        },
      });

      if (existingCharge && existingCharge.billingModel !== "INSTALLMENT") {
        const replacement = await replaceChargeIfUncollected(
          existingCharge.id,
          `ÄÃ£ cÃ³ charge mode ${existingCharge.billingModel} trong ká»³ ${period.periodName};`,
        );

        if (replacement.blocked) {
          pushException(studentId, classId, replacement.reason ?? "KhÃ´ng thá»ƒ thay charge Ä‘Ã£ thu.");
          continue;
        }
      }

      if (existingCharge?.installmentId && existingCharge.installmentId !== installment.id) {
        pushException(
          studentId,
          classId,
          "Charge hiá»‡n táº¡i Ä‘ang gáº¯n vá»›i installment khÃ¡c. ÄÃ£ cháº·n cáº­p nháº­t Ä‘á»ƒ trÃ¡nh lá»‡ch Ä‘á»£t thu.",
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
          notes: `Tráº£ gÃ³p ${installment.label}`,
        },
      });
      continue;
    }

    if (enrollment.billingModel !== "PERIOD") {
      pushException(
        studentId,
        classId,
        `Enrollment Ä‘ang á»Ÿ mode ${enrollment.billingModel} chÆ°a Ä‘Æ°á»£c phÃ©p Ä‘i vÃ o sweep thÃ¡ng. ÄÃ£ bá» qua an toÃ n.`,
      );
      continue;
    }

    const cls = enrollment.class;
    const basePrice = cls.tuitionPerSession ?? cls.course?.tuitionPerSession ?? 0;
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
        where: {
          enrollmentId: enrollment.id,
          effectiveFrom: { lte: period.endDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }],
        },
      }),
      prisma.adjustment.findMany({
        where: {
          studentId,
          effectiveFrom: { lte: period.endDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }],
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

    if (existingCharge && existingCharge.billingModel !== "PERIOD") {
      const replacement = await replaceChargeIfUncollected(
        existingCharge.id,
        `ÄÃ£ cÃ³ charge mode ${existingCharge.billingModel} trong ká»³ ${period.periodName};`,
      );

      if (replacement.blocked) {
        pushException(studentId, classId, replacement.reason ?? "KhÃ´ng thá»ƒ thay charge Ä‘Ã£ thu.");
        continue;
      }
    }

    const scholarshipPct = scholarships.reduce((sum, item) => sum + item.percentage, 0);
    const adjustmentPct = adjustments.reduce((sum, item) => sum + item.percentage, 0);
    const unitPrice = computeEffectiveUnitPrice(basePrice, scholarshipPct, adjustmentPct);
    const deductedCount = existingCharge?.deductedCount ?? 0;
    const tuitionAmount = computeTuitionAmount(sessionCount, absentCount, deductedCount, unitPrice);
    const materialsAmount = materials._sum.amount ?? 0;

    pendingDrafts.push({
      kind: "PERIOD",
      studentId,
      classId,
      className: enrollment.class.className,
      baseAmount: tuitionAmount + materialsAmount,
      existingChargeId: existingCharge?.id ?? null,
      issueStart: period.startDate,
      issueEnd: period.endDate,
      chargePayload: {
        sessionCount,
        absentCount,
        deductedCount,
        unitPrice,
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
        anchorCreditToApply = Math.min(
          Math.max(snapshot.debtBeforeCredits + anchorDraft.baseAmount, 0),
          snapshot.availableCreditAmount,
        );
        anchorOpeningBalance = snapshot.debtBeforeCredits - anchorCreditToApply;
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
            data: payload,
          });
          updated++;
        } else {
          const createdCharge = await tx.charge.create({
            data: {
              studentId: draft.studentId,
              classId: draft.classId,
              billingPeriodId: period.id,
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

  if (!enrollment) return { error: "KhÃ´ng tÃ¬m tháº¥y ghi danh" as const };
  if (enrollment.billingModel !== "COURSE") {
    return { error: `Ghi danh nÃ y Ä‘ang á»Ÿ mode ${enrollment.billingModel}, khÃ´ng Ä‘Æ°á»£c sinh charge trá»n khÃ³a.` as const };
  }

  const cls = enrollment.class;
  const totalSessions = cls.totalSessions;
  if (!totalSessions || totalSessions <= 0) {
    return { error: `Lá»›p "${cls.className}" chÆ°a cáº¥u hÃ¬nh tá»•ng sá»‘ buá»•i (totalSessions), khÃ´ng thá»ƒ tÃ­nh há»c phÃ­ trá»n khÃ³a.` as const };
  }

  const existing = await prisma.charge.findFirst({
    where: { studentId: enrollment.studentId, classId: enrollment.classId, billingModel: "COURSE" },
  });
  if (existing) {
    const replacement = await replaceChargeIfUncollected(existing.id, "Há»c viÃªn Ä‘Ã£ cÃ³ charge trá»n khÃ³a cho lá»›p nÃ y.");
    if (replacement.blocked) {
      return { error: replacement.reason ?? "Charge trá»n khÃ³a nÃ y Ä‘Ã£ thu nÃªn khÃ´ng thá»ƒ sinh láº¡i." };
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
      `ÄÃ£ tá»“n táº¡i charge mode ${conflict.billingModel} cho lá»›p nÃ y.`,
    );

    if (replacement.blocked) {
      return { error: replacement.reason ?? `Charge ${conflict.billingModel} nÃ y Ä‘Ã£ thu nÃªn khÃ´ng thá»ƒ sinh láº¡i.` };
    }
  }

  const basePrice = cls.tuitionPerSession ?? cls.course?.tuitionPerSession ?? 0;
  const period = options?.billingPeriodId
    ? await prisma.billingPeriod.findUnique({ where: { id: options.billingPeriodId } })
    : await ensureBillingPeriod(cls.branchId, periodNameFromDate(enrollment.enrollDate));

  if (!period) {
    return { error: "KhÃ´ng tÃ¬m tháº¥y ká»³ thu Ä‘á»ƒ gáº¯n phiáº¿u trá»n khÃ³a." as const };
  }

  if (period.branchId !== cls.branchId) {
    return { error: "Ká»³ thu khÃ´ng thuá»™c cÃ¹ng cÆ¡ sá»Ÿ vá»›i lá»›p há»c." as const };
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
        effectiveFrom: { lte: enrollment.enrollDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: enrollment.enrollDate } }],
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

  const scholarshipPct = scholarships.reduce((sum, item) => sum + item.percentage, 0);
  const adjustmentPct = adjustments.reduce((sum, item) => sum + item.percentage, 0);
  const unitPrice = computeEffectiveUnitPrice(basePrice, scholarshipPct, adjustmentPct);
  const tuitionAmount = totalSessions * unitPrice;
  const materialsAmount = detachedBookIssues.reduce((sum, item) => sum + item.amount, 0);

  const charge = await prisma.$transaction(async (tx) => {
    const balanceAnchorDate = options?.billingPeriodId ? period.startDate : enrollment.enrollDate;
    const snapshot = await computeBalanceSnapshot(enrollment.studentId, balanceAnchorDate, tx);
    const chargeBaseAmount = tuitionAmount + materialsAmount;
    const creditToApply = Math.min(
      Math.max(snapshot.debtBeforeCredits + chargeBaseAmount, 0),
      snapshot.availableCreditAmount,
    );
    const openingBalance = snapshot.debtBeforeCredits - creditToApply;
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
        tuitionAmount,
        materialsAmount,
        openingBalance,
        totalAmount,
        billingModel: "COURSE",
        notes: `Há»c phÃ­ trá»n khÃ³a ${cls.className} (${totalSessions} buá»•i)`,
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
  if (!period) return { error: "KhÃ´ng tÃ¬m tháº¥y ká»³ thu" as const };

  const enrollments = await prisma.enrollment.findMany({
    where: { status: "ACTIVE", class: { branchId: period.branchId } },
    include: {
      student: { select: { id: true, fullName: true, studentCode: true } },
      class: true,
      installments: { where: { billingPeriodId: period.id, status: "PENDING" } },
    },
  });

  const courseCharged = await prisma.charge.findMany({
    where: { billingModel: "COURSE", class: { branchId: period.branchId } },
    select: { id: true, studentId: true, classId: true },
  });
  const courseChargedMap = new Map<string, (typeof courseCharged)[number]>(
    courseCharged.map((item) => [`${item.studentId}:${item.classId}`, item]),
  );

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
      if (!courseChargedMap.has(courseKey)) {
        pushException(
          enrollment,
          "Mode COURSE nhÆ°ng chÆ°a cÃ³ charge trá»n khÃ³a. Cáº§n kiá»ƒm tra luá»“ng ghi danh hoáº·c sinh charge khi vÃ o há»c.",
        );
      }
      continue;
    }

    if (courseChargedMap.has(courseKey)) {
      const existingCourseCharge = courseChargedMap.get(courseKey);
      if (existingCourseCharge) {
        const collectedAmount = await getChargeCollectedAmount(existingCourseCharge.id);
        if (collectedAmount > 0) {
          pushException(
            enrollment,
            `Mode ${enrollment.billingModel} nhÆ°ng Ä‘Ã£ cÃ³ charge trá»n khÃ³a Ä‘Ã£ thu ${collectedAmount.toLocaleString("vi-VN")}Ä‘ cho lá»›p nÃ y.`,
          );
        }
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
            `ÄÃ£ cÃ³ charge mode ${existingCharge.billingModel} trong ká»³ ${period.periodName} vÃ  Ä‘Ã£ thu ${collectedAmount.toLocaleString("vi-VN")}Ä‘.`,
          );
        }
        continue;
      }

      if (existingCharge?.installmentId && existingCharge.installmentId !== installment.id) {
        pushException(enrollment, "Charge hiá»‡n táº¡i Ä‘ang gáº¯n vá»›i installment khÃ¡c.");
      }
      continue;
    }

    if (enrollment.billingModel !== "PERIOD") {
      pushException(enrollment, `Mode ${enrollment.billingModel} chÆ°a Ä‘Æ°á»£c phÃ©p Ä‘i vÃ o sweep thÃ¡ng.`);
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
          `ÄÃ£ cÃ³ charge mode ${existingCharge.billingModel} trong ká»³ ${period.periodName} vÃ  Ä‘Ã£ thu ${collectedAmount.toLocaleString("vi-VN")}Ä‘.`,
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
