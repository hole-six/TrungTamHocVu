import { prisma } from "@/lib/prisma";
import type { StandardReportFilters } from "@/lib/reporting-filters";
import { serializeFilterHashInput } from "@/lib/reporting-filters";
import { getReportHpSummary, getReportHsSummary, getReportsDashboardData } from "@/lib/server/reporting";

const REPORT_CODE = "REPORTS_SUMMARY";
const PERIOD_TYPE = "MONTH";

function hashString(input: string) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

function getCurrentMonthPeriodKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthDateRange(periodKey: string) {
  const [yearRaw, monthRaw] = periodKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Kỳ báo cáo không hợp lệ: ${periodKey}`);
  }

  return {
    startDate: new Date(year, month - 1, 1, 0, 0, 0, 0),
    endDate: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

export function resolveReportingPeriodKey(filters: StandardReportFilters) {
  return filters.periodKey ?? getCurrentMonthPeriodKey();
}

export function buildReportFilterHash(filters: StandardReportFilters) {
  return hashString(serializeFilterHashInput(filters));
}

export async function buildReportsSummaryLivePayload(branchId: string | null, canViewTuition: boolean) {
  const [dashboard, reportHs, reportHp] = await Promise.all([
    getReportsDashboardData(branchId),
    getReportHsSummary(branchId),
    canViewTuition
      ? getReportHpSummary(branchId)
      : Promise.resolve({
          periodName: null,
          totals: {
            sessionCount: 0,
            materialsAmount: 0,
            openingBalance: 0,
            tuitionAmount: 0,
            billedAmount: 0,
            collectedAmount: 0,
            remainingAmount: 0,
          },
          classes: [],
        }),
  ]);

  return {
    dashboard,
    reportHs,
    reportHp: canViewTuition ? reportHp : null,
  };
}

export async function findReportsSummarySnapshot(branchId: string, filters: StandardReportFilters) {
  const periodKey = resolveReportingPeriodKey(filters);
  const filterHash = buildReportFilterHash(filters);
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
    summary: snapshot.summaryJson ? JSON.parse(snapshot.summaryJson) : {},
    detail: snapshot.detailJson ? JSON.parse(snapshot.detailJson) : {},
    rowCount: snapshot.rowCount,
    status: snapshot.status,
  };
}

export async function createReportsSummarySnapshot({
  branchId,
  userId,
  filters,
  canViewTuition,
}: {
  branchId: string;
  userId: string;
  filters: StandardReportFilters;
  canViewTuition: boolean;
}) {
  const periodKey = resolveReportingPeriodKey(filters);
  const filterHash = buildReportFilterHash(filters);
  const { startDate, endDate } = getMonthDateRange(periodKey);
  const payload = await buildReportsSummaryLivePayload(branchId, canViewTuition);

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
    studentActive: payload.dashboard.studentActive,
    studentLeft: payload.dashboard.studentLeft,
    totalLeads: payload.dashboard.totalLeads,
    totalThu: payload.dashboard.totalThu,
    totalChi: payload.dashboard.totalChi,
    tuitionPeriodName: payload.reportHp?.periodName ?? null,
    classCount: payload.reportHs.classes.length,
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
      rowCount: payload.reportHs.classes.length + (payload.reportHp?.classes.length ?? 0),
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
      rowCount: payload.reportHs.classes.length + (payload.reportHp?.classes.length ?? 0),
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
