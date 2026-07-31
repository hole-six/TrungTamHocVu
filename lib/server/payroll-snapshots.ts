import { prisma } from "@/lib/prisma";
import type { StandardReportFilters, TimePreset } from "@/lib/reporting-filters";
import { serializeFilterHashInput } from "@/lib/reporting-filters";
import { computeContractStatus } from "@/lib/server/payroll-rules";

const REPORT_CODE = "PAYROLL_OVERVIEW";
const PERIOD_TYPE = "MONTH";

type ResolvedPayrollDateRange = {
  preset: TimePreset;
  periodKey: string | null;
  label: string;
  startDate: Date | null;
  endDate: Date | null;
};

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

function formatPeriodLabel(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function toEndOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function parseDateInput(value: string | null) {
  if (!value) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
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

function getWeekDateRange(now = new Date()) {
  const day = now.getDay();
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + offsetToMonday);
  const startDate = toStartOfDay(start);
  const end = new Date(startDate);
  end.setDate(startDate.getDate() + 6);
  return {
    startDate,
    endDate: toEndOfDay(end),
  };
}

function buildRangeLabel(preset: TimePreset, startDate: Date | null, endDate: Date | null, periodKey: string | null) {
  if (preset === "all_time") return "Toàn thời gian";
  if (preset === "today") return "Hôm nay";
  if (preset === "this_week") return "Tuần này";
  if (preset === "this_month") return `Tháng này (${periodKey ?? ""})`;
  if (preset === "current_period") return `Kỳ ${periodKey ?? ""}`;
  if (preset === "custom" && startDate && endDate) {
    return `${startDate.toLocaleDateString("vi-VN")} - ${endDate.toLocaleDateString("vi-VN")}`;
  }
  return "Khoảng thời gian đã chọn";
}

export function resolvePayrollPeriodKey(filters: StandardReportFilters) {
  return filters.periodKey ?? getCurrentMonthPeriodKey();
}

export function resolvePayrollDateRange(filters: StandardReportFilters): ResolvedPayrollDateRange {
  const now = new Date();
  const fallbackPeriodKey = resolvePayrollPeriodKey(filters);

  switch (filters.timePreset) {
    case "today": {
      const startDate = toStartOfDay(now);
      const endDate = toEndOfDay(now);
      return {
        preset: filters.timePreset,
        periodKey: formatPeriodLabel(startDate),
        label: buildRangeLabel(filters.timePreset, startDate, endDate, formatPeriodLabel(startDate)),
        startDate,
        endDate,
      };
    }
    case "this_week": {
      const { startDate, endDate } = getWeekDateRange(now);
      return {
        preset: filters.timePreset,
        periodKey: formatPeriodLabel(startDate),
        label: buildRangeLabel(filters.timePreset, startDate, endDate, formatPeriodLabel(startDate)),
        startDate,
        endDate,
      };
    }
    case "all_time":
      return {
        preset: filters.timePreset,
        periodKey: null,
        label: buildRangeLabel(filters.timePreset, null, null, null),
        startDate: null,
        endDate: null,
      };
    case "custom": {
      const parsedFromDate = parseDateInput(filters.fromDate);
      const parsedToDate = parseDateInput(filters.toDate);
      const startSeed = parsedFromDate ?? parsedToDate ?? now;
      const endSeed = parsedToDate ?? parsedFromDate ?? now;
      const startDate = toStartOfDay(startSeed <= endSeed ? startSeed : endSeed);
      const endDate = toEndOfDay(endSeed >= startSeed ? endSeed : startSeed);
      return {
        preset: filters.timePreset,
        periodKey: formatPeriodLabel(startDate),
        label: buildRangeLabel(filters.timePreset, startDate, endDate, formatPeriodLabel(startDate)),
        startDate,
        endDate,
      };
    }
    case "current_period":
    case "this_month":
    default: {
      const periodKey = filters.timePreset === "this_month" && !filters.periodKey ? getCurrentMonthPeriodKey(now) : fallbackPeriodKey;
      const { startDate, endDate } = getMonthDateRange(periodKey);
      return {
        preset: filters.timePreset,
        periodKey,
        label: buildRangeLabel(filters.timePreset, startDate, endDate, periodKey),
        startDate,
        endDate,
      };
    }
  }
}

function buildFilterHash(filters: StandardReportFilters) {
  return hashString(serializeFilterHashInput(filters));
}

function getRunPeriodKeysForRange(startDate: Date | null, endDate: Date | null) {
  if (!startDate || !endDate) return null;
  const keys: string[] = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const limit = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cursor <= limit) {
    keys.push(formatPeriodLabel(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

export async function buildPayrollOverviewLivePayload(branchId: string | null, filters: StandardReportFilters) {
  const branchWhere = branchId ? { branchId } : {};
  const timeRange = resolvePayrollDateRange(filters);
  const rangeFilter =
    timeRange.startDate && timeRange.endDate
      ? {
          gte: timeRange.startDate,
          lte: timeRange.endDate,
        }
      : undefined;
  const runPeriodKeys = getRunPeriodKeysForRange(timeRange.startDate, timeRange.endDate);

  const [employeesRaw, teachingAssignments, assistantAssignments, timesheetEntries, runs] = await Promise.all([
    prisma.employee.findMany({
      where: branchWhere,
      orderBy: { fullName: "asc" },
      include: { contracts: { orderBy: { signDate: "desc" }, take: 1 } },
    }),
    prisma.sessionAssignment.findMany({
      where: {
        ...(branchId ? { employee: { branchId } } : {}),
        role: "TEACHER",
        ...(rangeFilter ? { session: { sessionDate: rangeFilter } } : {}),
      },
      include: { session: true },
    }),
    prisma.sessionAssignment.findMany({
      where: {
        ...(branchId ? { employee: { branchId } } : {}),
        role: { in: ["ASSISTANT", "ASSISTANT2"] },
        ...(rangeFilter ? { session: { sessionDate: rangeFilter } } : {}),
      },
      include: { session: true },
    }),
    prisma.timesheetEntry.findMany({
      where: {
        ...(branchId ? { employee: { branchId } } : {}),
        ...(rangeFilter ? { workDate: rangeFilter } : {}),
      },
    }),
    prisma.payrollRun.findMany({
      where: {
        ...branchWhere,
        ...(runPeriodKeys ? { periodName: { in: runPeriodKeys } } : {}),
      },
      orderBy: { periodName: "desc" },
      include: {
        _count: { select: { lines: true } },
        lines: true,
      },
      take: runPeriodKeys ? undefined : 12,
    }),
  ]);

  const employees = employeesRaw.map(({ contracts, ...employee }) => ({
    ...employee,
    contractStatus: computeContractStatus(employee.resignDate, contracts[0]?.expiryDate ?? null),
  }));

  const teachingByEmployee = new Map<string, { hours: number; amount: number; sessions: number }>();
  const assistantByEmployee = new Map<string, { hours: number; amount: number; sessions: number }>();
  const timesheetByEmployee = new Map<string, { days: number; hours: number; entries: number }>();

  for (const item of teachingAssignments) {
    const current = teachingByEmployee.get(item.employeeId) ?? { hours: 0, amount: 0, sessions: 0 };
    current.hours += item.hours ?? 0;
    current.amount += item.amount ?? 0;
    current.sessions += 1;
    teachingByEmployee.set(item.employeeId, current);
  }

  for (const item of assistantAssignments) {
    const current = assistantByEmployee.get(item.employeeId) ?? { hours: 0, amount: 0, sessions: 0 };
    current.hours += item.hours ?? 0;
    current.amount += item.amount ?? 0;
    current.sessions += 1;
    assistantByEmployee.set(item.employeeId, current);
  }

  for (const item of timesheetEntries) {
    const current = timesheetByEmployee.get(item.employeeId) ?? { days: 0, hours: 0, entries: 0 };
    current.days += item.days ?? 0;
    current.hours += item.hours ?? 0;
    current.entries += 1;
    timesheetByEmployee.set(item.employeeId, current);
  }

  const employeeWork = employees.map((employee) => {
    const teaching = teachingByEmployee.get(employee.id) ?? { hours: 0, amount: 0, sessions: 0 };
    const assistant = assistantByEmployee.get(employee.id) ?? { hours: 0, amount: 0, sessions: 0 };
    const timesheet = timesheetByEmployee.get(employee.id) ?? { days: 0, hours: 0, entries: 0 };
    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      shortName: employee.shortName,
      position: employee.position,
      teachingHourlyRate: employee.teachingHourlyRate,
      assistantHourlyRate: employee.assistantHourlyRate,
      workStatus: employee.workStatus,
      contractStatus: employee.contractStatus,
      teachingHours: teaching.hours,
      teachingAmount: teaching.amount,
      assistantHours: assistant.hours,
      assistantAmount: assistant.amount,
      staffDays: timesheet.days,
      staffHours: timesheet.hours,
      totalWorkAmount: teaching.amount + assistant.amount,
      sessionCount: teaching.sessions + assistant.sessions,
      timesheetEntryCount: timesheet.entries,
    };
  });

  const employeeRows = employeeWork.filter(
    (employee) =>
      employee.teachingHours > 0 ||
      employee.assistantHours > 0 ||
      employee.staffDays > 0 ||
      employee.staffHours > 0,
  );

  const totalTeachingAmount = employeeRows.reduce((sum, employee) => sum + employee.teachingAmount, 0);
  const totalAssistantAmount = employeeRows.reduce((sum, employee) => sum + employee.assistantAmount, 0);
  const totalStaffAmount = runs.reduce((sum, run) => sum + run.lines.reduce((lineSum, line) => lineSum + line.baseSalaryAmount, 0), 0);
  const totalPayroll = totalTeachingAmount + totalAssistantAmount + totalStaffAmount;

  const latestRun = runs[0] ?? null;

  return {
    timeScope: {
      preset: timeRange.preset,
      periodKey: timeRange.periodKey,
      label: timeRange.label,
      fromDate: timeRange.startDate ? timeRange.startDate.toISOString() : null,
      toDate: timeRange.endDate ? timeRange.endDate.toISOString() : null,
    },
    employees: employeeRows,
    employeeDirectory: employees.map((employee) => ({
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
      teachingHours: run.lines.reduce((sum, line) => sum + line.teachingHours, 0),
      assistantHours: run.lines.reduce((sum, line) => sum + line.assistantHours, 0),
      staffDays: run.lines.reduce((sum, line) => sum + line.staffDays, 0),
    })),
    totals: {
      employeeCount: employees.length,
      workingEmployeeCount: employeeRows.length,
      totalPayroll,
      totalTeachingAmount,
      totalAssistantAmount,
      totalStaffAmount,
      totalTeachingHours: employeeRows.reduce((sum, employee) => sum + employee.teachingHours, 0),
      totalAssistantHours: employeeRows.reduce((sum, employee) => sum + employee.assistantHours, 0),
      totalStaffDays: employeeRows.reduce((sum, employee) => sum + employee.staffDays, 0),
      totalStaffHours: employeeRows.reduce((sum, employee) => sum + employee.staffHours, 0),
      totalSessionAssignments: employeeRows.reduce((sum, employee) => sum + employee.sessionCount, 0),
      totalTimesheetEntries: employeeRows.reduce((sum, employee) => sum + employee.timesheetEntryCount, 0),
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
  const timeRange = resolvePayrollDateRange(filters);
  const periodRange = getMonthDateRange(periodKey);
  const payload = await buildPayrollOverviewLivePayload(branchId, filters);

  const period = await prisma.reportingPeriod.upsert({
    where: {
      branchId_periodType_periodKey: {
        branchId,
        periodType: PERIOD_TYPE,
        periodKey,
      },
    },
    update: {
      startDate: timeRange.startDate ?? periodRange.startDate,
      endDate: timeRange.endDate ?? periodRange.endDate,
      status: "SNAPSHOT_READY",
    },
    create: {
      branchId,
      periodType: PERIOD_TYPE,
      periodKey,
      startDate: timeRange.startDate ?? periodRange.startDate,
      endDate: timeRange.endDate ?? periodRange.endDate,
      status: "SNAPSHOT_READY",
    },
  });

  const detailJson = JSON.stringify(payload);
  const summaryJson = JSON.stringify({
    employeeCount: payload.totals.employeeCount,
    workingEmployeeCount: payload.totals.workingEmployeeCount,
    totalPayroll: payload.totals.totalPayroll,
    totalTeachingAmount: payload.totals.totalTeachingAmount,
    totalAssistantAmount: payload.totals.totalAssistantAmount,
    totalStaffAmount: payload.totals.totalStaffAmount,
    latestRunPeriodName: payload.latestRunSummary?.periodName ?? null,
    timeScopeLabel: payload.timeScope.label,
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
      rowCount: payload.employees.length,
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
      rowCount: payload.employees.length,
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
