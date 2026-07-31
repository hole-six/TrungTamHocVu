"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import NewEmployeeForm from "@/components/payroll/NewEmployeeForm";
import NewPayrollRunForm from "@/components/payroll/NewPayrollRunForm";
import { exportSectionsToExcel } from "@/lib/export-utils";
import { STANDARD_TIME_PRESET_OPTIONS, type TimePreset } from "@/lib/reporting-filters";
import {
  getCreateSnapshotButtonLabel,
  getLiveFallbackLabel,
  getReportEffectiveBadge,
  getReportModeLabel,
  getSnapshotTimestampLabel,
} from "@/lib/reporting-ui";
import { PAYROLL_RUN_STATUS_LABEL } from "@/lib/server/payroll-rules";

type PayrollSummaryResponse = {
  meta: {
    requestedMode: "live" | "snapshot";
    effectiveMode: "live" | "snapshot";
    filters: {
      mode: "live" | "snapshot";
      periodKey: string | null;
      timePreset: TimePreset;
      fromDate: string | null;
      toDate: string | null;
    };
    snapshotReady: boolean;
    snapshotId: string | null;
    snapshotAt: string | null;
    periodKey: string | null;
  };
  timeScope: {
    preset: TimePreset;
    periodKey: string | null;
    label: string;
    fromDate: string | null;
    toDate: string | null;
  };
  employees: Array<{
    id: string;
    employeeCode: string;
    fullName: string;
    shortName: string;
    position: string | null;
    teachingHourlyRate: number | null;
    assistantHourlyRate: number | null;
    workStatus: string;
    contractStatus: string;
    teachingHours: number;
    teachingAmount: number;
    assistantHours: number;
    assistantAmount: number;
    staffDays: number;
    staffHours: number;
    totalWorkAmount: number;
    sessionCount: number;
    timesheetEntryCount: number;
  }>;
  runs: Array<{
    id: string;
    periodName: string;
    status: string;
    lineCount: number;
    totalAmount: number;
    teachingHours: number;
    assistantHours: number;
    staffDays: number;
  }>;
  totals: {
    employeeCount: number;
    workingEmployeeCount: number;
    totalPayroll: number;
    totalTeachingAmount: number;
    totalAssistantAmount: number;
    totalStaffAmount: number;
    totalTeachingHours: number;
    totalAssistantHours: number;
    totalStaffDays: number;
    totalStaffHours: number;
    totalSessionAssignments: number;
    totalTimesheetEntries: number;
  };
  latestRunSummary: null | {
    periodName: string;
    status: string;
    totalAmount: number;
    teachingHours: number;
    assistantHours: number;
    staffDays: number;
  };
};

function formatVnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function formatNumber(n: number) {
  return n.toLocaleString("vi-VN");
}

function getDefaultPeriodKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function toDateInputValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function PayrollWorkspace({
  canManageEmployees,
  canManagePayrollRuns,
}: {
  canManageEmployees: boolean;
  canManagePayrollRuns: boolean;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [data, setData] = useState<PayrollSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"live" | "snapshot">((searchParams.get("mode") as "live" | "snapshot") ?? "live");
  const [periodKey, setPeriodKey] = useState(searchParams.get("periodKey") ?? getDefaultPeriodKey());
  const [timePreset, setTimePreset] = useState((searchParams.get("timePreset") as TimePreset) ?? "this_month");
  const [fromDate, setFromDate] = useState(searchParams.get("fromDate") ?? "");
  const [toDate, setToDate] = useState(searchParams.get("toDate") ?? "");

  const queryString = useMemo(() => searchParams.toString(), [searchParams]);
  const showCustomDateRange = timePreset === "custom";
  const showPeriodKey = timePreset === "current_period" || timePreset === "this_month";

  useEffect(() => {
    setMode((searchParams.get("mode") as "live" | "snapshot") ?? "live");
    setPeriodKey(searchParams.get("periodKey") ?? getDefaultPeriodKey());
    setTimePreset((searchParams.get("timePreset") as TimePreset) ?? "this_month");
    setFromDate(searchParams.get("fromDate") ?? "");
    setToDate(searchParams.get("toDate") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/payroll/summary?${queryString}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Không tải được dữ liệu kỳ lương.");
        }
        return response.json();
      })
      .then((payload: PayrollSummaryResponse) => setData(payload))
      .catch((fetchError: Error) => {
        if (fetchError.name !== "AbortError") setError(fetchError.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [queryString]);

  const board = useMemo(() => {
    if (!data) return null;
    const missingTeachingRate = data.employees.filter((employee) => employee.teachingHours > 0 && employee.teachingHourlyRate == null).length;
    const missingAssistantRate = data.employees.filter((employee) => employee.assistantHours > 0 && employee.assistantHourlyRate == null).length;
    const contractAttentionCount = data.employees.filter(
      (employee) => employee.contractStatus && employee.contractStatus !== "Chưa có info" && employee.contractStatus !== "Còn hạn",
    ).length;
    return {
      missingTeachingRate,
      missingAssistantRate,
      contractAttentionCount,
      employeeRows: data.employees.length,
    };
  }, [data]);

  const applyFilters = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("mode", mode);
    next.set("timePreset", timePreset);

    if (showPeriodKey) {
      next.set("periodKey", periodKey);
    } else if (timePreset !== "custom") {
      next.delete("periodKey");
    }

    if (timePreset === "custom") {
      if (fromDate) next.set("fromDate", fromDate);
      else next.delete("fromDate");
      if (toDate) next.set("toDate", toDate);
      else next.delete("toDate");
    } else {
      next.delete("fromDate");
      next.delete("toDate");
    }

    router.push(`${pathname}?${next.toString()}`);
  };

  const createSnapshot = async () => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("mode", "snapshot");
    next.set("timePreset", timePreset);
    if (showPeriodKey) next.set("periodKey", periodKey);
    if (timePreset === "custom") {
      if (fromDate) next.set("fromDate", fromDate);
      if (toDate) next.set("toDate", toDate);
    }

    setCreatingSnapshot(true);
    setError(null);
    try {
      const response = await fetch(`/api/payroll/summary?${next.toString()}`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Không chốt được dữ liệu kỳ lương.");
      router.push(`${pathname}?${next.toString()}`);
      router.refresh();
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : "Không chốt được dữ liệu kỳ lương.");
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleExport = () => {
    if (!data) return;

    exportSectionsToExcel(
      [
        {
          title: "Tong quan payroll",
          columns: [
            { key: "metric", label: "Chi so" },
            { key: "value", label: "Gia tri" },
          ],
          rows: [
            { metric: "Pham vi thoi gian", value: data.timeScope.label },
            { metric: "Che do du lieu", value: data.meta.effectiveMode === "snapshot" ? "Snapshot" : "Live" },
            { metric: "Nhan su co phat sinh cong", value: data.totals.workingEmployeeCount },
            { metric: "Tong gio day", value: data.totals.totalTeachingHours },
            { metric: "Tong gio tro giang", value: data.totals.totalAssistantHours },
            { metric: "Tong cong hanh chinh", value: data.totals.totalStaffDays },
            { metric: "Tien day", value: formatVnd(data.totals.totalTeachingAmount) },
            { metric: "Tien tro giang", value: formatVnd(data.totals.totalAssistantAmount) },
            { metric: "Luong hanh chinh da len payroll", value: formatVnd(data.totals.totalStaffAmount) },
          ],
        },
        {
          title: "Cong phat sinh theo nhan su",
          columns: [
            { key: "employeeCode", label: "Ma NV" },
            { key: "fullName", label: "Ho ten" },
            { key: "position", label: "Vi tri" },
            { key: "teachingHours", label: "Gio day" },
            { key: "teachingAmount", label: "Tien day" },
            { key: "assistantHours", label: "Gio tro giang" },
            { key: "assistantAmount", label: "Tien tro giang" },
            { key: "staffDays", label: "Cong hanh chinh" },
            { key: "staffHours", label: "Gio hanh chinh" },
            { key: "sessionCount", label: "So buoi" },
            { key: "timesheetEntryCount", label: "So ngay cham cong" },
            { key: "contractStatus", label: "Trang thai HD" },
          ],
          rows: data.employees.map((item) => ({
            ...item,
            position: item.position ?? "",
            teachingAmount: formatVnd(item.teachingAmount),
            assistantAmount: formatVnd(item.assistantAmount),
          })),
        },
        {
          title: "Ky luong lien quan",
          columns: [
            { key: "periodName", label: "Ky" },
            { key: "status", label: "Trang thai" },
            { key: "lineCount", label: "So dong" },
            { key: "teachingHours", label: "Gio day" },
            { key: "assistantHours", label: "Gio TG" },
            { key: "staffDays", label: "Cong NV" },
            { key: "totalAmount", label: "Tong tien" },
          ],
          rows: data.runs.map((item) => ({
            ...item,
            status: PAYROLL_RUN_STATUS_LABEL[item.status as keyof typeof PAYROLL_RUN_STATUS_LABEL] ?? item.status,
            totalAmount: formatVnd(item.totalAmount),
          })),
        },
      ],
      `payroll_${data.timeScope.periodKey ?? "custom"}_${data.meta.effectiveMode}`,
      "Payroll",
    );
  };

  return (
    <div className="space-y-6">
      <div className="card space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-tight">Bảng công và lương</h1>
            <p className="mt-1 text-sm text-ink-muted48">
              Tách rõ công dạy, công trợ giảng và công hành chính theo đúng khoảng thời gian đang lọc. Công giảng dạy lấy từ
              `SessionAssignment`, công hành chính lấy từ `TimesheetEntry`.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManagePayrollRuns ? <Link href="/payroll/assistant-scores" className="btn-ghost">Điểm GV/TG</Link> : null}
            {canManageEmployees ? <NewEmployeeForm /> : null}
            {canManagePayrollRuns ? <NewPayrollRunForm /> : null}
            <button onClick={handleExport} disabled={!data} className="btn-ghost">
              Xuất Excel
            </button>
            {canManagePayrollRuns ? (
              <button onClick={createSnapshot} disabled={creatingSnapshot} className="btn-ghost">
                {getCreateSnapshotButtonLabel("payroll", creatingSnapshot)}
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Chế độ dữ liệu</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as "live" | "snapshot")} className="input">
              <option value="live">{getReportModeLabel("live")}</option>
              <option value="snapshot">{getReportModeLabel("snapshot")}</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Khoảng thời gian</span>
            <select value={timePreset} onChange={(event) => setTimePreset(event.target.value as TimePreset)} className="input">
              {STANDARD_TIME_PRESET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {showPeriodKey ? (
            <label className="space-y-1">
              <span className="text-xs font-medium text-ink-muted48">Tháng / kỳ gốc</span>
              <input type="month" value={periodKey} onChange={(event) => setPeriodKey(event.target.value)} className="input" />
            </label>
          ) : null}

          {showCustomDateRange ? (
            <label className="space-y-1">
              <span className="text-xs font-medium text-ink-muted48">Từ ngày</span>
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="input" />
            </label>
          ) : null}

          {showCustomDateRange ? (
            <label className="space-y-1">
              <span className="text-xs font-medium text-ink-muted48">Đến ngày</span>
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="input" />
            </label>
          ) : null}

          <div className="flex items-end">
            <button onClick={applyFilters} className="btn-primary w-full">
              Xem dữ liệu
            </button>
          </div>
        </div>

        {data?.meta ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`badge ${data.meta.effectiveMode === "snapshot" ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
              {getReportEffectiveBadge(data.meta.effectiveMode, "payroll")}
            </span>
            <span className="badge bg-ink/5 text-ink-muted80">Phạm vi: {data.timeScope.label}</span>
            {data.timeScope.fromDate ? (
              <span className="badge bg-ink/5 text-ink-muted80">
                {toDateInputValue(data.timeScope.fromDate)} đến {toDateInputValue(data.timeScope.toDate)}
              </span>
            ) : null}
            {data.meta.snapshotAt ? (
              <span className="badge bg-emerald-100 text-emerald-700">{getSnapshotTimestampLabel("payroll", data.meta.snapshotAt)}</span>
            ) : (
              <span className="badge bg-ink/5 text-ink-muted80">{getLiveFallbackLabel("payroll")}</span>
            )}
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      {loading || !data ? (
        <div className="card">
          <p className="text-sm text-ink-muted48">Đang tải dữ liệu công và lương...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Nhân sự có phát sinh</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{formatNumber(data.totals.workingEmployeeCount)}</p>
              <p className="mt-1 text-xs text-ink-muted48">Tổng hồ sơ: {formatNumber(data.totals.employeeCount)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Giờ dạy</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{formatNumber(data.totals.totalTeachingHours)}</p>
              <p className="mt-1 text-xs text-ink-muted48">{formatVnd(data.totals.totalTeachingAmount)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Giờ trợ giảng</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{formatNumber(data.totals.totalAssistantHours)}</p>
              <p className="mt-1 text-xs text-ink-muted48">{formatVnd(data.totals.totalAssistantAmount)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Công hành chính</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{formatNumber(data.totals.totalStaffDays)}</p>
              <p className="mt-1 text-xs text-ink-muted48">{formatNumber(data.totals.totalStaffHours)} giờ chấm công</p>
            </div>
            <div className="stat-card-accent">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Tổng tiền đã lên payroll</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">{formatVnd(data.totals.totalPayroll)}</p>
              <p className="mt-1 text-xs text-white/70">Bao gồm dòng lương hành chính đã generate</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Cần rà soát</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight">
                {formatNumber((board?.missingTeachingRate ?? 0) + (board?.missingAssistantRate ?? 0) + (board?.contractAttentionCount ?? 0))}
              </p>
              <p className="mt-1 text-xs text-ink-muted48">
                Thiếu đơn giá: {(board?.missingTeachingRate ?? 0) + (board?.missingAssistantRate ?? 0)} · HĐ: {board?.contractAttentionCount ?? 0}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.8fr)]">
            <div className="card overflow-x-auto p-0">
              <div className="flex flex-col gap-2 border-b border-hairline px-5 py-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight">Bảng công phát sinh theo nhân sự</h2>
                  <p className="mt-1 text-sm text-ink-muted48">
                    Hiển thị đúng theo bộ lọc thời gian. Đây là bảng để kiểm tra công trước khi generate hoặc đối soát kỳ lương.
                  </p>
                </div>
                <div className="text-xs text-ink-muted48">
                  {formatNumber(data.totals.totalSessionAssignments)} buổi dạy/TG · {formatNumber(data.totals.totalTimesheetEntries)} ngày chấm công
                </div>
              </div>
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nhân sự</th>
                    <th className="px-4 py-3 font-medium">Vị trí</th>
                    <th className="px-4 py-3 font-medium">Giờ dạy</th>
                    <th className="px-4 py-3 font-medium">Tiền dạy</th>
                    <th className="px-4 py-3 font-medium">Giờ TG</th>
                    <th className="px-4 py-3 font-medium">Tiền TG</th>
                    <th className="px-4 py-3 font-medium">Công HC</th>
                    <th className="px-4 py-3 font-medium">Giờ HC</th>
                    <th className="px-4 py-3 font-medium">Buổi / ngày</th>
                    <th className="px-4 py-3 font-medium">Đơn giá</th>
                    <th className="px-4 py-3 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map((employee) => {
                    const statusBadges = [
                      employee.workStatus === "ACTIVE" ? "Đang làm" : "Đã nghỉ",
                      employee.contractStatus !== "Chưa có info" ? employee.contractStatus : null,
                    ].filter(Boolean);

                    return (
                      <tr key={employee.id} className="border-b border-hairline last:border-0 hover:bg-canvas-parchment/40">
                        <td className="px-4 py-3">
                          <Link href={`/payroll/employees/${employee.id}`} className="font-medium text-primary">
                            {employee.fullName}
                          </Link>
                          <p className="text-xs text-ink-muted48">
                            {employee.employeeCode} · {employee.shortName}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-ink-muted80">{employee.position ?? "—"}</td>
                        <td className="px-4 py-3 font-medium text-ink">{formatNumber(employee.teachingHours)}</td>
                        <td className="px-4 py-3 text-ink-muted80">{formatVnd(employee.teachingAmount)}</td>
                        <td className="px-4 py-3 font-medium text-ink">{formatNumber(employee.assistantHours)}</td>
                        <td className="px-4 py-3 text-ink-muted80">{formatVnd(employee.assistantAmount)}</td>
                        <td className="px-4 py-3 font-medium text-ink">{formatNumber(employee.staffDays)}</td>
                        <td className="px-4 py-3 text-ink-muted80">{formatNumber(employee.staffHours)}</td>
                        <td className="px-4 py-3 text-ink-muted80">
                          {formatNumber(employee.sessionCount)} buổi · {formatNumber(employee.timesheetEntryCount)} ngày
                        </td>
                        <td className="px-4 py-3 text-ink-muted80">
                          <p>GV: {employee.teachingHourlyRate != null ? formatVnd(employee.teachingHourlyRate) : "Chưa có"}</p>
                          <p>TG: {employee.assistantHourlyRate != null ? formatVnd(employee.assistantHourlyRate) : "Chưa có"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {statusBadges.map((badge) => (
                              <span
                                key={`${employee.id}-${badge}`}
                                className={
                                  badge === "Đang làm"
                                    ? "badge bg-primary/10 text-primary"
                                    : badge?.includes("Đã hết hạn")
                                      ? "badge-red"
                                      : badge?.includes("Sắp")
                                        ? "badge-amber"
                                        : "badge bg-ink/5 text-ink-muted80"
                                }
                              >
                                {badge}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {data.employees.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-10 text-center text-ink-muted48">
                        Không có công phát sinh trong khoảng thời gian này.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="space-y-6">
              <div className="card space-y-4">
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight">Nguyên tắc tính</h2>
                  <p className="mt-1 text-sm text-ink-muted48">Giữ đúng mô hình workbook và tài liệu vận hành đã chốt.</p>
                </div>
                <div className="space-y-3 text-sm text-ink-muted80">
                  <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
                    <p className="font-medium text-ink">Giáo viên / trợ giảng</p>
                    <p className="mt-1">Lấy công từ buổi học đã phân công, không lấy từ chấm công ngày.</p>
                  </div>
                  <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
                    <p className="font-medium text-ink">Nhân sự hành chính</p>
                    <p className="mt-1">Lấy công từ `TimesheetEntry`, hiển thị theo số công và số giờ thực tế.</p>
                  </div>
                  <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
                    <p className="font-medium text-ink">Tổng tiền</p>
                    <p className="mt-1">Tiền live chắc chắn có cho dạy/TG; lương hành chính chỉ cộng khi đã có dòng payroll generate.</p>
                  </div>
                </div>
              </div>

              <div className="card overflow-hidden p-0">
                <div className="border-b border-hairline px-5 py-4">
                  <h2 className="font-display text-lg font-semibold tracking-tight">Kỳ lương liên quan</h2>
                  <p className="mt-1 text-sm text-ink-muted48">Tách riêng khỏi bảng công để đỡ rối. Dùng phần này để mở kỳ đã generate và đối chiếu.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
                      <tr>
                        <th className="px-4 py-3 font-medium">Kỳ</th>
                        <th className="px-4 py-3 font-medium">Công</th>
                        <th className="px-4 py-3 font-medium">Tổng tiền</th>
                        <th className="px-4 py-3 font-medium">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.runs.map((run) => (
                        <tr key={run.id} className="border-b border-hairline last:border-0 hover:bg-canvas-parchment/40">
                          <td className="px-4 py-3">
                            <Link href={`/payroll/${run.id}`} className="font-medium text-primary">
                              {run.periodName}
                            </Link>
                            <p className="text-xs text-ink-muted48">{run.lineCount} dòng lương</p>
                          </td>
                          <td className="px-4 py-3 text-ink-muted80">
                            {formatNumber(run.teachingHours)} giờ dạy · {formatNumber(run.assistantHours)} giờ TG · {formatNumber(run.staffDays)} công
                          </td>
                          <td className="px-4 py-3 font-medium text-ink">{formatVnd(run.totalAmount)}</td>
                          <td className="px-4 py-3">
                            <span className="badge bg-ink/5 text-ink-muted80">
                              {PAYROLL_RUN_STATUS_LABEL[run.status as keyof typeof PAYROLL_RUN_STATUS_LABEL] ?? run.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {data.runs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-ink-muted48">
                            Chưa có kỳ lương nào trong phạm vi này.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              {data.latestRunSummary ? (
                <div className="card">
                  <h2 className="font-display text-lg font-semibold tracking-tight">Kỳ gần nhất trong danh sách</h2>
                  <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl border border-hairline p-3">
                      <p className="text-ink-muted48">Kỳ</p>
                      <p className="font-medium text-ink">{data.latestRunSummary.periodName}</p>
                    </div>
                    <div className="rounded-2xl border border-hairline p-3">
                      <p className="text-ink-muted48">Tổng tiền</p>
                      <p className="font-medium text-ink">{formatVnd(data.latestRunSummary.totalAmount)}</p>
                    </div>
                    <div className="rounded-2xl border border-hairline p-3">
                      <p className="text-ink-muted48">Giờ dạy / TG</p>
                      <p className="font-medium text-ink">
                        {formatNumber(data.latestRunSummary.teachingHours)} / {formatNumber(data.latestRunSummary.assistantHours)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-hairline p-3">
                      <p className="text-ink-muted48">Công hành chính</p>
                      <p className="font-medium text-ink">{formatNumber(data.latestRunSummary.staffDays)}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
