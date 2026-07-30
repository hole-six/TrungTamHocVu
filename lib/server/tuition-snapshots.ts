import { prisma } from "@/lib/prisma";
import type { StandardReportFilters } from "@/lib/reporting-filters";
import { serializeFilterHashInput } from "@/lib/reporting-filters";
import { getReportHpSummary } from "@/lib/server/reporting";

const REPORT_CODE = "TUITION_OVERVIEW";
const PERIOD_TYPE = "MONTH";

function hashString(input: string) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

function getCurrentMonthPeriodKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthDateRange(periodKey: string) {
  const [yearRaw, monthRaw] = periodKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Kỳ học phí không hợp lệ: ${periodKey}`);
  }
  return {
    startDate: new Date(year, month - 1, 1, 0, 0, 0, 0),
    endDate: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

export function resolveTuitionPeriodKey(filters: StandardReportFilters) {
  return filters.periodKey ?? getCurrentMonthPeriodKey();
}

function buildFilterHash(filters: StandardReportFilters) {
  return hashString(serializeFilterHashInput(filters));
}

async function buildOutstandingMaps(studentIds: string[]) {
  if (studentIds.length === 0) {
    return {
      chargeByStudent: new Map<string, number>(),
      paidByStudent: new Map<string, number>(),
    };
  }

  const charges = await prisma.charge.findMany({
    where: { studentId: { in: studentIds } },
    select: { id: true, studentId: true, totalAmount: true },
  });

  const chargeByStudent = new Map<string, number>();
  for (const charge of charges) {
    chargeByStudent.set(charge.studentId, (chargeByStudent.get(charge.studentId) ?? 0) + charge.totalAmount);
  }

  const allocations = charges.length
    ? await prisma.paymentAllocation.findMany({
        where: { chargeId: { in: charges.map((charge) => charge.id) } },
        select: { chargeId: true, amount: true },
      })
    : [];

  const chargeOwner = new Map(charges.map((charge) => [charge.id, charge.studentId]));
  const paidByStudent = new Map<string, number>();
  for (const allocation of allocations) {
    const studentId = chargeOwner.get(allocation.chargeId);
    if (!studentId) continue;
    paidByStudent.set(studentId, (paidByStudent.get(studentId) ?? 0) + allocation.amount);
  }

  return { chargeByStudent, paidByStudent };
}

export async function buildTuitionOverviewLivePayload(branchId: string | null, filters?: Pick<StandardReportFilters, "periodKey">) {
  const branchWhere = branchId ? { branchId } : {};
  const periods = await prisma.billingPeriod.findMany({
    where: branchWhere,
    orderBy: { periodName: "desc" },
    include: { charges: { include: { allocations: true } } },
  });
  const currentPeriodKey = filters?.periodKey ?? null;
  const selectedPeriod = currentPeriodKey
    ? await prisma.billingPeriod.findFirst({
        where: { ...branchWhere, periodName: currentPeriodKey },
        include: {
          charges: {
            include: {
              class: true,
              student: {
                include: {
                  lead: true,
                  guardians: {
                    include: { guardian: { include: { user: true } } },
                    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
                  },
                  enrollments: {
                    where: { status: "ACTIVE" },
                    include: { class: true },
                    orderBy: { enrollDate: "desc" },
                    take: 1,
                  },
                },
              },
              allocations: true,
            },
            orderBy: [{ class: { className: "asc" } }, { student: { fullName: "asc" } }],
          },
        },
      })
    : null;

  const studentIds = selectedPeriod ? [...new Set(selectedPeriod.charges.map((charge) => charge.studentId))] : [];
  const { chargeByStudent, paidByStudent } = await buildOutstandingMaps(studentIds);

  const totalBilled = periods.reduce((sum, period) => sum + period.charges.reduce((chargeSum, charge) => chargeSum + charge.totalAmount, 0), 0);
  const totalPaid = periods.reduce(
    (sum, period) =>
      sum + period.charges.reduce((chargeSum, charge) => chargeSum + charge.allocations.reduce((allocationSum, allocation) => allocationSum + allocation.amount, 0), 0),
    0,
  );

  return {
    periods: periods.map((period) => {
      const total = period.charges.reduce((sum, charge) => sum + charge.totalAmount, 0);
      const paid = period.charges.reduce((sum, charge) => sum + charge.allocations.reduce((allocationSum, allocation) => allocationSum + allocation.amount, 0), 0);
      return {
        id: period.id,
        periodName: period.periodName,
        status: period.status,
        chargeCount: period.charges.length,
        total,
        paid,
        debt: total - paid,
      };
    }),
    totals: {
      totalBilled,
      totalPaid,
      totalDebt: totalBilled - totalPaid,
    },
    selectedPeriod: selectedPeriod
      ? {
          id: selectedPeriod.id,
          periodName: selectedPeriod.periodName,
          status: selectedPeriod.status,
          debtors: selectedPeriod.charges
            .map((charge) => {
              const paid = charge.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
              const remaining = charge.totalAmount - paid;
              const primaryGuardian =
                charge.student.guardians.find((item) => item.isPrimary)?.guardian ?? charge.student.guardians[0]?.guardian ?? null;
              const activeEnrollment = charge.student.enrollments[0] ?? null;
              return {
                chargeId: charge.id,
                studentId: charge.studentId,
                studentName: charge.student.fullName,
                studentCode: charge.student.studentDisplayId ?? charge.student.studentCode,
                leadCode: charge.student.lead?.leadCode ?? null,
                className: charge.class.className,
                currentClassName: activeEnrollment?.class.className ?? charge.class.className,
                guardianName: primaryGuardian?.fullName ?? null,
                guardianPhone: primaryGuardian?.phone ?? null,
                guardianPortalEmail: primaryGuardian?.user?.email ?? null,
                guardianPortalActive: primaryGuardian?.user?.isActive ?? false,
                totalAmount: charge.totalAmount,
                paidAmount: paid,
                remainingAmount: remaining,
                totalOutstanding: (chargeByStudent.get(charge.studentId) ?? 0) - (paidByStudent.get(charge.studentId) ?? 0),
              };
            })
            .filter((charge) => charge.remainingAmount > 0)
            .sort((left, right) => right.remainingAmount - left.remainingAmount),
        }
      : null,
    latestSummary: await getReportHpSummary(branchId),
  };
}

export async function findTuitionOverviewSnapshot(branchId: string, filters: StandardReportFilters) {
  const periodKey = resolveTuitionPeriodKey(filters);
  const filterHash = buildFilterHash(filters);
  const period = await prisma.reportingPeriod.findUnique({
    where: {
      branchId_periodType_periodKey: {
        branchId,
        periodType: PERIOD_TYPE,
        periodKey,
      },
    },
  });
  if (!period) return null;

  const snapshot = await prisma.reportSnapshot.findFirst({
    where: {
      branchId,
      periodId: period.id,
      reportCode: REPORT_CODE,
      filterHash,
    },
    orderBy: { asOfAt: "desc" },
  });
  if (!snapshot) return null;

  return {
    id: snapshot.id,
    periodKey,
    asOfAt: snapshot.asOfAt,
    detail: snapshot.detailJson ? JSON.parse(snapshot.detailJson) : {},
  };
}

export async function createTuitionOverviewSnapshot({
  branchId,
  userId,
  filters,
}: {
  branchId: string;
  userId: string;
  filters: StandardReportFilters;
}) {
  const periodKey = resolveTuitionPeriodKey(filters);
  const filterHash = buildFilterHash(filters);
  const { startDate, endDate } = getMonthDateRange(periodKey);
  const payload = await buildTuitionOverviewLivePayload(branchId, filters);

  const period = await prisma.reportingPeriod.upsert({
    where: {
      branchId_periodType_periodKey: {
        branchId,
        periodType: PERIOD_TYPE,
        periodKey,
      },
    },
    update: {
      startDate,
      endDate,
      status: "SNAPSHOT_READY",
    },
    create: {
      branchId,
      periodType: PERIOD_TYPE,
      periodKey,
      startDate,
      endDate,
      status: "SNAPSHOT_READY",
    },
  });

  const detailJson = JSON.stringify(payload);
  const summaryJson = JSON.stringify({
    totalBilled: payload.totals.totalBilled,
    totalPaid: payload.totals.totalPaid,
    totalDebt: payload.totals.totalDebt,
    latestPeriodName: payload.latestSummary.periodName,
    periodCount: payload.periods.length,
  });

  const snapshot = await prisma.reportSnapshot.upsert({
    where: {
      periodId_reportCode_filterHash: {
        periodId: period.id,
        reportCode: REPORT_CODE,
        filterHash,
      },
    },
    update: {
      branchId,
      filterJson: serializeFilterHashInput(filters),
      mode: "SNAPSHOT",
      status: "READY",
      asOfAt: new Date(),
      summaryJson,
      detailJson,
      rowCount: payload.periods.length,
      createdById: userId,
    },
    create: {
      branchId,
      periodId: period.id,
      reportCode: REPORT_CODE,
      filterHash,
      filterJson: serializeFilterHashInput(filters),
      mode: "SNAPSHOT",
      status: "READY",
      asOfAt: new Date(),
      summaryJson,
      detailJson,
      rowCount: payload.periods.length,
      createdById: userId,
    },
  });

  return {
    id: snapshot.id,
    periodKey,
    asOfAt: snapshot.asOfAt,
    payload,
  };
}
