import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { ensurePayrollRun, generatePayrollForRun } from "../lib/server/payroll-generation";
import { generateChargesForPeriod, generateCourseCharge } from "../lib/server/billing-generation";

const prisma = new PrismaClient();
const TAG = "[QA-MASTER-2026-08-02]";
const PERIOD_AUGUST = "2026-08";

function runNpmScript(scriptName: string) {
  console.log(`\n▶ Running ${scriptName}...`);
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", `npm run ${scriptName}`]
      : ["run", scriptName];

  const result = spawnSync(command, args, {
    shell: false,
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Script "${scriptName}" failed with exit code ${result.status ?? "unknown"}.`);
  }
}

function periodDate(periodName: string, day: number) {
  return new Date(`${periodName}-${String(day).padStart(2, "0")}T09:00:00.000Z`);
}

async function ensureAssetMaintenance(branchId: string) {
  const asset = await prisma.asset.findFirst({
    where: { branchId },
    orderBy: { createdAt: "asc" },
  });
  if (!asset) return { created: false, reason: "Không có tài sản để seed bảo dưỡng." };

  const existing = await prisma.assetTransaction.findFirst({
    where: { assetId: asset.id, type: "MAINTENANCE", notes: TAG },
  });
  if (existing) {
    return { created: false, assetId: asset.id, transactionId: existing.id };
  }

  const created = await prisma.$transaction(async (tx) => {
    const transaction = await tx.assetTransaction.create({
      data: {
        assetId: asset.id,
        type: "MAINTENANCE",
        quantity: 0,
        amount: 650000,
        txnDate: new Date("2026-07-18T08:30:00.000Z"),
        notes: TAG,
      },
    });

    const cashTransaction = await tx.cashTransaction.create({
      data: {
        branchId,
        type: "CHI",
        txnDate: new Date("2026-07-18T08:30:00.000Z"),
        detail: "Bảo dưỡng tài sản",
        description: `QA maintenance for ${asset.name}`,
        amount: 650000,
        status: "CONFIRMED",
        notes: TAG,
      },
    });

    await tx.assetCashPosting.create({
      data: {
        assetTransactionId: transaction.id,
        cashTransactionId: cashTransaction.id,
        amount: 650000,
        postingKind: "MAINTENANCE",
        notes: TAG,
      },
    });

    await tx.asset.update({
      where: { id: asset.id },
      data: { status: "MAINTENANCE" },
    });

    return { transactionId: transaction.id, cashTransactionId: cashTransaction.id };
  });

  return { created: true, assetId: asset.id, ...created };
}

async function ensureTimesheetAndPayroll(branchId: string) {
  const employee = await prisma.employee.findFirst({
    where: {
      branchId,
      payMode: "MONTHLY",
      workStatus: "ACTIVE",
    },
    orderBy: { createdAt: "asc" },
  });

  if (!employee) return { createdEntries: 0, payrollRunId: null, note: "Không có nhân viên monthly để seed bảng công." };

  const period = await prisma.timesheetPeriod.upsert({
    where: { branchId_periodName: { branchId, periodName: "2026-07" } },
    update: {},
    create: {
      branchId,
      periodName: "2026-07",
      startDate: new Date("2026-07-01T00:00:00.000Z"),
      endDate: new Date("2026-07-31T23:59:59.999Z"),
    },
  });

  let createdEntries = 0;
  for (const day of [14, 15, 16, 17, 21]) {
    const workDate = new Date(`2026-07-${String(day).padStart(2, "0")}T00:00:00.000Z`);
    const existing = await prisma.timesheetEntry.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
    });

    if (!existing) {
      await prisma.timesheetEntry.create({
        data: {
          periodId: period.id,
          employeeId: employee.id,
          workDate,
          checkInAm: "08:00",
          checkOutAm: "12:00",
          checkInPm: "13:30",
          checkOutPm: "17:30",
          hours: 8,
          days: 1,
        },
      });
      createdEntries += 1;
    }
  }

  const run = await ensurePayrollRun(branchId, "2026-07");
  const payrollResult = await generatePayrollForRun(run.id);

  return {
    createdEntries,
    payrollRunId: run.id,
    payrollResult,
  };
}

async function recalculateAllOpenPayrollRuns(branchId: string) {
  const runs = await prisma.payrollRun.findMany({
    where: { branchId, status: { in: ["DRAFT", "CALCULATED", "REVIEWED"] } },
    orderBy: { periodName: "asc" },
  });
  const results = [];
  for (const run of runs) {
    results.push({ runId: run.id, periodName: run.periodName, result: await generatePayrollForRun(run.id) });
  }
  return results;
}

async function ensurePaymentCashParity(branchId: string) {
  const category =
    (await prisma.transactionCategory.findFirst({
      where: { type: "THU", name: "QA payment parity repair" },
    })) ??
    (await prisma.transactionCategory.create({
      data: { type: "THU", name: "QA payment parity repair", detail: TAG },
    }));

  const payments = await prisma.payment.findMany({
    where: {
      student: { branchId },
      status: { notIn: ["VOIDED", "REFUNDED"] },
    },
    include: {
      student: true,
      allocations: true,
      cashPosting: { include: { cashTransaction: true } },
    },
  });

  let repaired = 0;
  for (const payment of payments) {
    const allocatedAmount = payment.allocations.reduce((sum, item) => sum + item.amount, 0);
    const refundedAmount = await prisma.refund.aggregate({
      where: { paymentId: payment.id },
      _sum: { amount: true },
    });
    const refunded = refundedAmount._sum.amount ?? 0;
    const netPaymentAmount = Math.max(payment.amount - refunded, 0);
    const credits = await prisma.creditBalance.findMany({
      where: { paymentId: payment.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    let currentCreditAmount = credits.reduce((sum, item) => sum + item.amount, 0);
    let overflow = Math.max(allocatedAmount + currentCreditAmount - netPaymentAmount, 0);

    for (const credit of credits) {
      if (overflow <= 0) break;
      const deduction = Math.min(credit.amount, overflow);
      if (deduction >= credit.amount) {
        await prisma.creditBalance.delete({ where: { id: credit.id } });
      } else {
        await prisma.creditBalance.update({
          where: { id: credit.id },
          data: { amount: credit.amount - deduction, usedAt: credit.usedAt ?? new Date() },
        });
      }
      currentCreditAmount -= deduction;
      overflow -= deduction;
      repaired += 1;
    }

    const missingCreditAmount = Math.max(netPaymentAmount - allocatedAmount - currentCreditAmount, 0);
    if (missingCreditAmount > 0) {
      const reason = `QA credit carry-forward from payment ${payment.paymentNo}`;
      const existingCredit = await prisma.creditBalance.findFirst({
        where: { studentId: payment.studentId, paymentId: payment.id, reason },
      });
      if (existingCredit) {
        await prisma.creditBalance.update({
          where: { id: existingCredit.id },
          data: { amount: missingCreditAmount, usedAt: null },
        });
      } else {
        await prisma.creditBalance.create({
          data: {
            studentId: payment.studentId,
            paymentId: payment.id,
            amount: missingCreditAmount,
            reason,
          },
        });
      }
      currentCreditAmount = credits.reduce((sum, item) => sum + item.amount, 0) + missingCreditAmount;
      repaired += 1;
    }

    const expectedStatus =
      refunded <= 0
        ? allocatedAmount > 0 || currentCreditAmount > 0
          ? "ALLOCATED"
          : "CONFIRMED"
        : refunded >= payment.amount
        ? "REFUNDED"
        : "PARTIALLY_REFUNDED";

    const shouldRepair =
      allocatedAmount + currentCreditAmount !== netPaymentAmount ||
      payment.status !== expectedStatus ||
      payment.cashPosting?.amount !== payment.amount ||
      payment.cashPosting?.cashTransaction.amount !== payment.amount ||
      !payment.cashPosting;

    const existingCashTx = await prisma.cashTransaction.findFirst({
      where: {
        branchId,
        description: payment.paymentNo,
      },
    });

    const cashTransaction = existingCashTx
      ? await prisma.cashTransaction.update({
          where: { id: existingCashTx.id },
          data: {
            categoryId: category.id,
            type: "THU",
            txnDate: payment.paidDate,
            amount: payment.amount,
            detail: TAG,
            description: payment.paymentNo,
            handledById: payment.receivedById ?? null,
            status: "CONFIRMED",
            notes: `${TAG}: repaired from payment ${payment.paymentNo}`,
          },
        })
      : await prisma.cashTransaction.create({
          data: {
            branchId,
            categoryId: category.id,
            type: "THU",
            txnDate: payment.paidDate,
            amount: payment.amount,
            detail: TAG,
            description: payment.paymentNo,
            handledById: payment.receivedById ?? null,
            status: "CONFIRMED",
            notes: `${TAG}: repaired from payment ${payment.paymentNo}`,
          },
        });

    if (payment.amount !== allocatedAmount) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          amount: allocatedAmount + currentCreditAmount + refunded,
          notes: `${payment.notes ? `${payment.notes} | ` : ""}${TAG}: amount synced with allocations`,
        },
      });
    }

    if (shouldRepair) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: expectedStatus,
        },
      });
    }

    await prisma.paymentCashPosting.upsert({
      where: { paymentId: payment.id },
      update: {
        cashTransactionId: cashTransaction.id,
        amount: payment.amount,
      },
      create: {
        paymentId: payment.id,
        cashTransactionId: cashTransaction.id,
        amount: payment.amount,
      },
    });

    repaired += 1;
  }

  return { repaired };
}

async function ensureActiveCourseEnrollmentsCharged(branchId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: "ACTIVE",
      billingModel: "COURSE",
      class: {
        branchId,
        isRemedial: false,
      },
    },
    include: {
      class: true,
    },
  });

  let repaired = 0;
  const errors: Array<{ enrollmentId: string; classCode: string; message: string }> = [];

  for (const enrollment of enrollments) {
    const existingCourseCharge = await prisma.charge.findFirst({
      where: {
        studentId: enrollment.studentId,
        classId: enrollment.classId,
        billingModel: "COURSE",
      },
    });

    if (existingCourseCharge) continue;

    if (!enrollment.class.totalSessions || enrollment.class.totalSessions <= 0) {
      const completedSessionCount = await prisma.classSession.count({
        where: {
          classId: enrollment.classId,
        },
      });

      if (completedSessionCount > 0) {
        await prisma.class.update({
          where: { id: enrollment.classId },
          data: {
            totalSessions: completedSessionCount,
            notes: `${enrollment.class.notes ? `${enrollment.class.notes} | ` : ""}${TAG}: backfilled totalSessions from class sessions`,
          },
        });
      }
    }

    const result = await generateCourseCharge(enrollment.id);
    if ("error" in result) {
      errors.push({
        enrollmentId: enrollment.id,
        classCode: enrollment.class.classCode,
        message: result.error ?? "Unknown course charge repair error",
      });
      continue;
    }

    repaired += 1;
  }

  return { repaired, errors };
}

async function ensureBillingModelSwitchCases(branchId: string) {
  const august = await prisma.billingPeriod.findUnique({
    where: { branchId_periodName: { branchId, periodName: PERIOD_AUGUST } },
  });
  if (!august) {
    return {
      periodToCourseSuccess: null,
      courseToPeriodSuccess: null,
      partialPeriodSwitchCandidate: null,
      note: `Không tìm thấy kỳ ${PERIOD_AUGUST}.`,
    };
  }

  const charges = await prisma.charge.findMany({
    where: {
      billingPeriodId: august.id,
      student: { studentCode: { startsWith: "STRESS-HV" } },
    },
    include: {
      student: true,
      class: true,
      allocations: {
        include: {
          payment: true,
        },
      },
    },
    orderBy: [{ student: { studentCode: "asc" } }, { createdAt: "asc" }],
  });

  const withPaid = charges.map((charge) => ({
    charge,
    paidAmount: charge.allocations
      .filter((allocation) => allocation.payment.status !== "VOIDED" && allocation.payment.status !== "REFUNDED")
      .reduce((sum, allocation) => sum + allocation.amount, 0),
  }));

  const periodToCourseCandidate = withPaid.find(({ charge, paidAmount }) => {
    if (charge.billingModel !== "PERIOD" || paidAmount !== 0 || charge.totalAmount <= 0) return false;

    const sameEnrollmentCharges = withPaid.filter(
      ({ charge: other }) =>
        other.studentId === charge.studentId &&
        other.classId === charge.classId &&
        other.billingModel === "PERIOD",
    );

    return sameEnrollmentCharges.every((item) => item.paidAmount === 0);
  });
  const courseToPeriodCandidate = withPaid.find(
    ({ charge, paidAmount }) => charge.billingModel === "COURSE" && paidAmount === 0 && charge.totalAmount > 0,
  );
  const partialPeriodSwitchCandidate = withPaid.find(
    ({ charge, paidAmount }) => charge.billingModel === "PERIOD" && paidAmount > 0 && paidAmount < charge.totalAmount,
  );

  let periodToCourseSuccess: string | null = null;
  if (periodToCourseCandidate) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: periodToCourseCandidate.charge.studentId,
        classId: periodToCourseCandidate.charge.classId,
        status: "ACTIVE",
      },
    });

    if (enrollment && enrollment.billingModel !== "COURSE") {
      const previous = enrollment.billingModel;
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { billingModel: "COURSE", notes: `${enrollment.notes ? `${enrollment.notes} | ` : ""}${TAG}: switched PERIOD→COURSE` },
      });
      const result = await generateCourseCharge(enrollment.id, { billingPeriodId: august.id });
      if ("error" in result) {
        await prisma.enrollment.update({ where: { id: enrollment.id }, data: { billingModel: previous } });
      } else {
        periodToCourseSuccess = enrollment.id;
      }
    }
  }

  let courseToPeriodSuccess: string | null = null;
  if (courseToPeriodCandidate) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: courseToPeriodCandidate.charge.studentId,
        classId: courseToPeriodCandidate.charge.classId,
        status: "ACTIVE",
      },
    });

    if (enrollment && enrollment.billingModel !== "PERIOD") {
      const previous = enrollment.billingModel;
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { billingModel: "PERIOD", notes: `${enrollment.notes ? `${enrollment.notes} | ` : ""}${TAG}: switched COURSE→PERIOD` },
      });
      const result = await generateChargesForPeriod(august.id);
      if ("error" in result) {
        await prisma.enrollment.update({ where: { id: enrollment.id }, data: { billingModel: previous } });
      } else {
        courseToPeriodSuccess = enrollment.id;
      }
    }
  }

  return {
    periodToCourseSuccess,
    courseToPeriodSuccess,
    partialPeriodSwitchCandidate: partialPeriodSwitchCandidate?.charge.id ?? null,
  };
}

async function ensureQAMetadata(branchId: string) {
  const august = await prisma.billingPeriod.findUnique({
    where: { branchId_periodName: { branchId, periodName: PERIOD_AUGUST } },
  });

  if (august) {
    await generateChargesForPeriod(august.id);
  }

  const july = await prisma.billingPeriod.findUnique({
    where: { branchId_periodName: { branchId, periodName: "2026-07" } },
  });

  return {
    julyPeriodId: july?.id ?? null,
    augustPeriodId: august?.id ?? null,
  };
}

async function ensureSinglePrimaryGuardian(branchId: string) {
  const links = await prisma.studentGuardian.findMany({
    where: { student: { branchId }, isPrimary: true },
    orderBy: [{ id: "asc" }],
  });
  const byStudent = new Map<string, typeof links>();
  for (const link of links) {
    byStudent.set(link.studentId, [...(byStudent.get(link.studentId) ?? []), link]);
  }

  let repaired = 0;
  for (const studentLinks of byStudent.values()) {
    if (studentLinks.length <= 1) continue;
    const [keep, ...duplicates] = studentLinks;
    for (const duplicate of duplicates) {
      await prisma.studentGuardian.update({
        where: { id: duplicate.id },
        data: { isPrimary: false },
      });
      repaired += 1;
    }

    if (!keep.isPrimary) {
      await prisma.studentGuardian.update({
        where: { id: keep.id },
        data: { isPrimary: true },
      });
      repaired += 1;
    }
  }

  return { repaired };
}

async function main() {
  runNpmScript("seed:demo");
  runNpmScript("seed:tuition-stress");
  runNpmScript("repair:tuition-balances");
  runNpmScript("sync:db");

  const branch = await prisma.branch.findUnique({ where: { code: "CS1" } });
  if (!branch) throw new Error("Không tìm thấy cơ sở CS1 sau khi seed.");

  const metadata = await ensureQAMetadata(branch.id);
  const assetMaintenance = await ensureAssetMaintenance(branch.id);
  const timesheetAndPayroll = await ensureTimesheetAndPayroll(branch.id);
  const payrollRecalculation = await recalculateAllOpenPayrollRuns(branch.id);
  const switchCases = await ensureBillingModelSwitchCases(branch.id);
  runNpmScript("repair:tuition-balances");
  const paymentCashParity = await ensurePaymentCashParity(branch.id);
  const courseEnrollmentRepair = await ensureActiveCourseEnrollmentsCharged(branch.id);
  const primaryGuardianRepair = await ensureSinglePrimaryGuardian(branch.id);

  const summary = {
    ok: true,
    tag: TAG,
    branch: { id: branch.id, code: branch.code, name: branch.name },
    periods: metadata,
    assetMaintenance,
    timesheetAndPayroll,
    payrollRecalculation,
    switchCases,
    paymentCashParity,
    courseEnrollmentRepair,
    primaryGuardianRepair,
    counts: {
      stressStudents: await prisma.student.count({ where: { studentCode: { startsWith: "STRESS-HV" } } }),
      charges: await prisma.charge.count({ where: { student: { studentCode: { startsWith: "STRESS-HV" } } } }),
      sessionCredits: await prisma.sessionCredit.count({ where: { student: { studentCode: { startsWith: "STRESS-HV" } } } }),
      maintenanceTransactions: await prisma.assetTransaction.count({ where: { type: "MAINTENANCE" } }),
      assetCashPostings: await prisma.assetCashPosting.count(),
      payrollRuns: await prisma.payrollRun.count({ where: { branchId: branch.id } }),
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
