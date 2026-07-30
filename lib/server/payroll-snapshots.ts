import { prisma } from "@/lib/prisma";
import type { StandardReportFilters } from "@/lib/reporting-filters";
import { serializeFilterHashInput } from "@/lib/reporting-filters";
import { computeContractStatus } from "@/lib/server/payroll-rules";

const REPORT_CODE = "PAYROLL_OVERVIEW";
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
    throw new Error(`Kỳ lương không hợp lệ: ${periodKey}`);
  }
  return {
    startDate: new Date(year, month - 1, 1, 0, 0, 0, 0),
    endDate: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

export function resolvePayrollPeriodKey(filters: StandardReportFilters) {
  return filters.periodKey ?? getCurrentMonthPeriodKey();
}

function buildFilterHash(filters: StandardReportFilters) {
  return hashString(serializeFilterHashInput(filters));
}

export async function buildPayrollOverviewLivePayload(branchId: string | null) {
  const branchWhere = branchId ? { branchId } : {};

  const [employeesRaw, runs] = await Promise.all([
    prisma.employee.findMany({
      where: branchWhere,
      orderBy: { fullName: "asc" },
      include: { contracts: { orderBy: { signDate: "desc" }, take: 1 } },
    }),
    prisma.payrollRun.findMany({
      where: branchWhere,
      orderBy: { periodName: "desc" },
      include: {
        _count: { select: { lines: true } },
        lines: true,
      },
    }),
  ]);

  const employees = employeesRaw.map(({ contracts, ...employee }) => ({
    ...employee,
    contractStatus: computeContractStatus(employee.resignDate, contracts[0]?.expiryDate ?? null),
  }));

  const totalPayroll = runs.reduce((sum, run) => sum + run.lines.reduce((lineSum, line) => lineSum + line.totalAmount, 0), 0);
  const totalTeachingAmount = runs.reduce((sum, run) => sum + run.lines.reduce((lineSum, line) => lineSum + line.teachingAmount, 0), 0);
  const totalAssistantAmount = runs.reduce((sum, run) => sum + run.lines.reduce((lineSum, line) => lineSum + line.assistantAmount, 0), 0);
  const totalStaffAmount = runs.reduce((sum, run) => sum + run.lines.reduce((lineSum, line) => lineSum + line.baseSalaryAmount, 0), 0);

  const latestRun = runs[0] ?? null;

  return {
    employees: employees.map((employee) => ({
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      shortName: employee.shortName,
      position: employee.position,
      teachingHourlyRate: employee.teachingHourlyRate,
      assistantHourlyRate: employee.assistantHourlyRate,
      workStatus: employee.workStatus,
      contractStatus: employee.contractStatus,
    })),
    runs: runs.map((run) => ({
      id: run.id,
      periodName: run.periodName,
      status: run.status,
      lineCount: run._count.lines,
      totalAmount: run.lines.reduce((sum, line) => sum + line.totalAmount, 0),
    })),
    totals: {
      employeeCount: employees.length,
      totalPayroll,
      totalTeachingAmount,
      totalAssistantAmount,
      totalStaffAmount,
    },
    latestRunSummary: latestRun
      ? {
          periodName: latestRun.periodName,
          status: latestRun.status,
          totalAmount: latestRun.lines.reduce((sum, line) => sum + line.totalAmount, 0),
          teachingHours: latestRun.lines.reduce((sum, line) => sum + line.teachingHours, 0),
          assistantHours: latestRun.lines.reduce((sum, line) => sum + line.assistantHours, 0),
          staffDays: latestRun.lines.reduce((sum, line) => sum + line.staffDays, 0),
        }
      : null,
  };
}

export async function findPayrollOverviewSnapshot(branchId: string, filters: StandardReportFilters) {
  const periodKey = resolvePayrollPeriodKey(filters);
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

export async function createPayrollOverviewSnapshot({
  branchId,
  userId,
  filters,
}: {
  branchId: string;
  userId: string;
  filters: StandardReportFilters;
}) {
  const periodKey = resolvePayrollPeriodKey(filters);
  const filterHash = buildFilterHash(filters);
  const { startDate, endDate } = getMonthDateRange(periodKey);
  const payload = await buildPayrollOverviewLivePayload(branchId);

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
    employeeCount: payload.totals.employeeCount,
    totalPayroll: payload.totals.totalPayroll,
    totalTeachingAmount: payload.totals.totalTeachingAmount,
    totalAssistantAmount: payload.totals.totalAssistantAmount,
    totalStaffAmount: payload.totals.totalStaffAmount,
    latestRunPeriodName: payload.latestRunSummary?.periodName ?? null,
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
      rowCount: payload.runs.length,
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
      rowCount: payload.runs.length,
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
