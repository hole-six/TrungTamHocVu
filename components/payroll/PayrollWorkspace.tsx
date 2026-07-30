"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import NewEmployeeForm from "@/components/payroll/NewEmployeeForm";
import NewPayrollRunForm from "@/components/payroll/NewPayrollRunForm";
import {
  getCreateSnapshotButtonLabel,
  getLiveFallbackLabel,
  getReportEffectiveBadge,
  getReportModeLabel,
  getSnapshotTimestampLabel,
} from "@/lib/reporting-ui";
import { exportSectionsToExcel } from "@/lib/export-utils";
import { PAYROLL_RUN_STATUS_LABEL } from "@/lib/server/payroll-rules";

type PayrollSummaryResponse = {
  meta: {
    requestedMode: "live" | "snapshot";
    effectiveMode: "live" | "snapshot";
    filters: {
      mode: "live" | "snapshot";
      periodKey: string | null;
    };
    snapshotReady: boolean;
    snapshotId: string | null;
    snapshotAt: string | null;
    periodKey: string | null;
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
  }>;
  runs: Array<{
    id: string;
    periodName: string;
    status: string;
    lineCount: number;
    totalAmount: number;
  }>;
  totals: {
    employeeCount: number;
    totalPayroll: number;
    totalTeachingAmount: number;
    totalAssistantAmount: number;
    totalStaffAmount: number;
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

function getDefaultPeriodKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

  const queryString = useMemo(() => searchParams.toString(), [searchParams]);

  useEffect(() => {
    setMode((searchParams.get("mode") as "live" | "snapshot") ?? "live");
    setPeriodKey(searchParams.get("periodKey") ?? getDefaultPeriodKey());
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

  const applyFilters = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("mode", mode);
    next.set("periodKey", periodKey);
    next.set("timePreset", mode === "snapshot" ? "current_period" : "this_month");
    router.push(`${pathname}?${next.toString()}`);
  };

  const createSnapshot = async () => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("mode", "snapshot");
    next.set("periodKey", periodKey);
    next.set("timePreset", "current_period");

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
          title: "Tổng quan kỳ lương",
          columns: [
            { key: "metric", label: "Chỉ số" },
            { key: "value", label: "Giá trị" },
          ],
          rows: [
            { metric: "Kỳ lương", value: data.meta.periodKey ?? periodKey },
            { metric: "Chế độ dữ liệu", value: data.meta.effectiveMode === "snapshot" ? "Kỳ đã chốt" : "Dữ liệu hiện tại" },
            { metric: "Số nhân sự", value: data.totals.employeeCount },
            { metric: "Tổng lương", value: formatVnd(data.totals.totalPayroll) },
            { metric: "Tiền dạy", value: formatVnd(data.totals.totalTeachingAmount) },
            { metric: "Tiền trợ giảng", value: formatVnd(data.totals.totalAssistantAmount) },
            { metric: "Lương hành chính", value: formatVnd(data.totals.totalStaffAmount) },
          ],
        },
        {
          title: "Danh sách nhân sự",
          columns: [
            { key: "employeeCode", label: "Mã NV" },
            { key: "fullName", label: "Họ tên" },
            { key: "shortName", label: "Tên ngắn" },
            { key: "position", label: "Vị trí" },
            { key: "teachingHourlyRate", label: "Lương GV/H" },
            { key: "assistantHourlyRate", label: "Lương TG/H" },
            { key: "workStatus", label: "Trạng thái làm việc" },
            { key: "contractStatus", label: "Trạng thái HĐ" },
          ],
          rows: data.employees.map((item) => ({
            ...item,
            position: item.position ?? "",
            teachingHourlyRate: item.teachingHourlyRate != null ? formatVnd(item.teachingHourlyRate) : "",
            assistantHourlyRate: item.assistantHourlyRate != null ? formatVnd(item.assistantHourlyRate) : "",
          })),
        },
        {
          title: "Danh sách kỳ lương",
          columns: [
            { key: "periodName", label: "Kỳ" },
            { key: "status", label: "Trạng thái" },
            { key: "lineCount", label: "Số dòng lương" },
            { key: "totalAmount", label: "Tổng tiền" },
          ],
          rows: data.runs.map((item) => ({
            periodName: item.periodName,
            status: PAYROLL_RUN_STATUS_LABEL[item.status as keyof typeof PAYROLL_RUN_STATUS_LABEL] ?? item.status,
            lineCount: item.lineCount,
            totalAmount: formatVnd(item.totalAmount),
          })),
        },
        {
          title: "Kỳ lương gần nhất",
          columns: [
            { key: "periodName", label: "Kỳ" },
            { key: "status", label: "Trạng thái" },
            { key: "totalAmount", label: "Tổng tiền" },
            { key: "teachingHours", label: "Giờ dạy" },
            { key: "assistantHours", label: "Giờ trợ giảng" },
            { key: "staffDays", label: "Công NV" },
          ],
          rows: data.latestRunSummary
            ? [
                {
                  periodName: data.latestRunSummary.periodName,
                  status: PAYROLL_RUN_STATUS_LABEL[data.latestRunSummary.status as keyof typeof PAYROLL_RUN_STATUS_LABEL] ?? data.latestRunSummary.status,
                  totalAmount: formatVnd(data.latestRunSummary.totalAmount),
                  teachingHours: data.latestRunSummary.teachingHours,
                  assistantHours: data.latestRunSummary.assistantHours,
                  staffDays: data.latestRunSummary.staffDays,
                },
              ]
            : [],
        },
      ],
      `nhan-su-luong_${data.meta.periodKey ?? periodKey}_${data.meta.effectiveMode}`,
      "NhanSuLuong",
    );
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Nhân sự & Lương</h1>
            <p className="mt-1 text-sm text-ink-muted48">
              Công dạy của giáo viên/trợ giảng lấy từ buổi học đã phân công; chấm công ngày chỉ áp dụng cho nhân sự hành chính.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManagePayrollRuns ? <Link href="/payroll/assistant-scores" className="btn-ghost">Đánh giá điểm trợ giảng</Link> : null}
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

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Chế độ dữ liệu</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as "live" | "snapshot")} className="input">
              <option value="live">{getReportModeLabel("live")}</option>
              <option value="snapshot">{getReportModeLabel("snapshot")}</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Kỳ lương</span>
            <input type="month" value={periodKey} onChange={(event) => setPeriodKey(event.target.value)} className="input" />
          </label>
          <div className="flex items-end">
            <button onClick={applyFilters} className="btn-primary w-full">Xem dữ liệu</button>
          </div>
        </div>

        {data?.meta ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className={`badge ${data.meta.effectiveMode === "snapshot" ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
              {getReportEffectiveBadge(data.meta.effectiveMode, "payroll")}
            </span>
            <span className="badge bg-ink/5 text-ink-muted80">Kỳ: {data.meta.periodKey ?? periodKey}</span>
            {data.meta.snapshotAt ? (
              <span className="badge bg-emerald-100 text-emerald-700">{getSnapshotTimestampLabel("payroll", data.meta.snapshotAt)}</span>
            ) : (
              <span className="badge bg-ink/5 text-ink-muted80">{getLiveFallbackLabel("payroll")}</span>
            )}
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>

      {loading || !data ? (
        <div className="card">
          <p className="text-sm text-ink-muted48">Đang tải dữ liệu kỳ lương...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Nhân sự</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{data.totals.employeeCount}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Tổng lương</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{formatVnd(data.totals.totalPayroll)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Tiền dạy</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-primary">{formatVnd(data.totals.totalTeachingAmount + data.totals.totalAssistantAmount)}</p>
            </div>
            <div className="stat-card-accent">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Lương hành chính</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">{formatVnd(data.totals.totalStaffAmount)}</p>
            </div>
          </div>

          {data.latestRunSummary ? (
            <div className="card">
              <h2 className="font-display text-lg font-semibold tracking-tight">Kỳ lương gần nhất</h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-4 text-sm">
                <div><p className="text-ink-muted48">Kỳ</p><p className="font-medium">{data.latestRunSummary.periodName}</p></div>
                <div><p className="text-ink-muted48">Giờ dạy</p><p className="font-medium">{data.latestRunSummary.teachingHours}</p></div>
                <div><p className="text-ink-muted48">Giờ trợ giảng</p><p className="font-medium">{data.latestRunSummary.assistantHours}</p></div>
                <div><p className="text-ink-muted48">Công NV</p><p className="font-medium">{data.latestRunSummary.staffDays}</p></div>
              </div>
            </div>
          ) : null}

          <div className="card overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
                <tr>
                  <th className="px-4 py-3 font-medium">Mã NV</th>
                  <th className="px-4 py-3 font-medium">Họ tên</th>
                  <th className="px-4 py-3 font-medium">Tên ngắn</th>
                  <th className="px-4 py-3 font-medium">Vị trí</th>
                  <th className="px-4 py-3 font-medium">Lương/giờ dạy</th>
                  <th className="px-4 py-3 font-medium">Lương/giờ TG</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((employee) => (
                  <tr key={employee.id} className="border-b border-hairline last:border-0 hover:bg-canvas-parchment/40">
                    <td className="px-4 py-3">
                      <Link href={`/payroll/employees/${employee.id}`} className="text-primary">{employee.employeeCode}</Link>
                    </td>
                    <td className="px-4 py-3 font-medium">{employee.fullName}</td>
                    <td className="px-4 py-3 text-ink-muted80">{employee.shortName}</td>
                    <td className="px-4 py-3 text-ink-muted80">{employee.position ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-muted80">{employee.teachingHourlyRate?.toLocaleString("vi-VN") ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-muted80">{employee.assistantHourlyRate?.toLocaleString("vi-VN") ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`badge ${employee.workStatus === "ACTIVE" ? "bg-primary/10 text-primary" : "bg-ink/5 text-ink-muted48"}`}>
                          {employee.workStatus === "ACTIVE" ? "Đang làm" : "Đã nghỉ"}
                        </span>
                        {employee.contractStatus && employee.contractStatus !== "Chưa có info" ? (
                          <span className={employee.contractStatus.includes("Sắp") ? "badge-amber" : employee.contractStatus.includes("Đã hết hạn") ? "badge-red" : "badge-gray"}>
                            {employee.contractStatus}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
                <tr>
                  <th className="px-4 py-3 font-medium">Kỳ</th>
                  <th className="px-4 py-3 font-medium">Số dòng lương</th>
                  <th className="px-4 py-3 font-medium">Tổng lương</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((run) => (
                  <tr key={run.id} className="border-b border-hairline last:border-0 hover:bg-canvas-parchment/40">
                    <td className="px-4 py-3">
                      <Link href={`/payroll/${run.id}`} className="font-medium text-primary">{run.periodName}</Link>
                    </td>
                    <td className="px-4 py-3 text-ink-muted80">{run.lineCount}</td>
                    <td className="px-4 py-3 text-ink-muted80">{formatVnd(run.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-ink/5 text-ink-muted80">{PAYROLL_RUN_STATUS_LABEL[run.status] ?? run.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
