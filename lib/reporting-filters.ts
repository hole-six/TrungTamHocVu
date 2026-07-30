export type ReportMode = "live" | "snapshot";

export type TimePreset =
  | "today"
  | "this_week"
  | "this_month"
  | "current_period"
  | "custom"
  | "all_time";

export type StandardReportFilters = {
  mode: ReportMode;
  branchId: string | null;
  keyword: string | null;
  classId: string | null;
  employeeId: string | null;
  status: string | null;
  periodKey: string | null;
  timePreset: TimePreset;
  fromDate: string | null;
  toDate: string | null;
};

export const STANDARD_TIME_PRESET_OPTIONS: Array<{ value: TimePreset; label: string }> = [
  { value: "today", label: "Hôm nay" },
  { value: "this_week", label: "Tuần này" },
  { value: "this_month", label: "Tháng này" },
  { value: "current_period", label: "Kỳ hiện tại" },
  { value: "custom", label: "Tùy chọn ngày" },
  { value: "all_time", label: "Toàn thời gian" },
];

function toNullable(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMode(value: string | null): ReportMode {
  return value === "snapshot" ? "snapshot" : "live";
}

function normalizeTimePreset(value: string | null): TimePreset {
  switch (value) {
    case "today":
    case "this_week":
    case "this_month":
    case "current_period":
    case "custom":
    case "all_time":
      return value;
    default:
      return "this_month";
  }
}

export function parseStandardReportFilters(searchParams: URLSearchParams, branchId: string | null): StandardReportFilters {
  return {
    mode: normalizeMode(searchParams.get("mode")),
    branchId,
    keyword: toNullable(searchParams.get("q")),
    classId: toNullable(searchParams.get("classId")),
    employeeId: toNullable(searchParams.get("employeeId")),
    status: toNullable(searchParams.get("status")),
    periodKey: toNullable(searchParams.get("periodKey")),
    timePreset: normalizeTimePreset(searchParams.get("timePreset")),
    fromDate: toNullable(searchParams.get("fromDate")),
    toDate: toNullable(searchParams.get("toDate")),
  };
}

export function serializeFilterHashInput(filters: StandardReportFilters) {
  return JSON.stringify({
    mode: filters.mode,
    branchId: filters.branchId,
    keyword: filters.keyword,
    classId: filters.classId,
    employeeId: filters.employeeId,
    status: filters.status,
    periodKey: filters.periodKey,
    timePreset: filters.timePreset,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
  });
}
