import type { ReportMode } from "@/lib/reporting-filters";

export function getReportModeLabel(mode: ReportMode) {
  return mode === "snapshot" ? "Kỳ đã chốt" : "Dữ liệu hiện tại";
}

export function getReportEffectiveBadge(mode: ReportMode, scope: "report" | "tuition" | "cashbook" | "payroll") {
  if (mode === "snapshot") {
    if (scope === "tuition") return "Đang xem dữ liệu kỳ đã chốt";
    if (scope === "cashbook") return "Đang xem thu chi kỳ đã chốt";
    if (scope === "payroll") return "Đang xem kỳ lương đã chốt";
    return "Đang xem báo cáo kỳ đã chốt";
  }
  return "Đang xem dữ liệu hiện tại";
}

export function getCreateSnapshotButtonLabel(scope: "report" | "tuition" | "cashbook" | "payroll", creating: boolean) {
  if (creating) {
    if (scope === "tuition") return "Đang chốt dữ liệu kỳ...";
    if (scope === "cashbook") return "Đang chốt thu chi kỳ...";
    if (scope === "payroll") return "Đang chốt dữ liệu kỳ lương...";
    return "Đang chốt báo cáo kỳ...";
  }
  if (scope === "tuition") return "Chốt dữ liệu kỳ này";
  if (scope === "cashbook") return "Chốt thu chi kỳ này";
  if (scope === "payroll") return "Chốt kỳ lương này";
  return "Chốt báo cáo kỳ này";
}

export function getSnapshotTimestampLabel(scope: "report" | "tuition" | "cashbook" | "payroll", timestamp: string) {
  const prefix =
    scope === "tuition"
      ? "Đã chốt dữ liệu lúc"
      : scope === "cashbook"
        ? "Đã chốt thu chi lúc"
        : scope === "payroll"
          ? "Đã chốt kỳ lương lúc"
          : "Đã chốt báo cáo lúc";
  return `${prefix} ${new Date(timestamp).toLocaleString("vi-VN")}`;
}

export function getLiveFallbackLabel(scope: "report" | "tuition" | "cashbook" | "payroll") {
  if (scope === "tuition") return "Chưa có bản chốt phù hợp, hệ thống đang dùng dữ liệu hiện tại";
  if (scope === "cashbook") return "Chưa có bản chốt phù hợp, hệ thống đang dùng dữ liệu thu chi hiện tại";
  if (scope === "payroll") return "Chưa có bản chốt phù hợp, hệ thống đang dùng dữ liệu lương hiện tại";
  return "Chưa có bản chốt phù hợp, hệ thống đang dùng báo cáo hiện tại";
}
