"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import NewPeriodForm from "@/components/tuition/NewPeriodForm";
import { BILLING_PERIOD_STATUS_LABEL } from "@/lib/server/tuition-rules";
import {
  getCreateSnapshotButtonLabel,
  getLiveFallbackLabel,
  getReportEffectiveBadge,
  getReportModeLabel,
  getSnapshotTimestampLabel,
} from "@/lib/reporting-ui";
import { exportSectionsToExcel } from "@/lib/export-utils";

type TuitionSummaryResponse = {
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
  periods: Array<{
    id: string;
    periodName: string;
    status: string;
    chargeCount: number;
    total: number;
    paid: number;
    debt: number;
  }>;
  totals: {
    totalBilled: number;
    totalPaid: number;
    totalDebt: number;
  };
  selectedPeriod: {
    id: string;
    periodName: string;
    status: string;
    debtors: Array<{
      chargeId: string;
      studentId: string;
      studentName: string;
      studentCode: string;
      leadCode: string | null;
      className: string;
      currentClassName: string;
      guardianName: string | null;
      guardianPhone: string | null;
      guardianPortalEmail: string | null;
      guardianPortalActive: boolean;
      totalAmount: number;
      paidAmount: number;
      remainingAmount: number;
      totalOutstanding: number;
    }>;
  } | null;
  latestSummary: {
    periodName: string | null;
    totals: {
      sessionCount: number;
      materialsAmount: number;
      openingBalance: number;
      tuitionAmount: number;
      billedAmount: number;
      collectedAmount: number;
      remainingAmount: number;
    };
    classes: Array<{
      classCode: string;
      className: string;
      sessionCount: number;
      materialsAmount: number;
      openingBalance: number;
      tuitionAmount: number;
      billedAmount: number;
      collectedAmount: number;
      remainingAmount: number;
      studentCount: number;
    }>;
  };
};

function formatVnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function getDefaultPeriodKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function TuitionWorkspace({ canManageTuition }: { canManageTuition: boolean }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [data, setData] = useState<TuitionSummaryResponse | null>(null);
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

    fetch(`/api/tuition/summary?${queryString}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Không tải được dữ liệu học phí.");
        }
        return response.json();
      })
      .then((payload: TuitionSummaryResponse) => setData(payload))
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
      const response = await fetch(`/api/tuition/summary?${next.toString()}`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Không chốt được dữ liệu học phí kỳ này.");
      router.push(`${pathname}?${next.toString()}`);
      router.refresh();
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : "Không chốt được dữ liệu học phí kỳ này.");
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleExport = () => {
    if (!data) return;

    exportSectionsToExcel(
      [
        {
          title: "Tổng quan học phí",
          columns: [
            { key: "metric", label: "Chỉ số" },
            { key: "value", label: "Giá trị" },
          ],
          rows: [
            { metric: "Kỳ báo cáo", value: data.meta.periodKey ?? periodKey },
            { metric: "Chế độ dữ liệu", value: data.meta.effectiveMode === "snapshot" ? "Kỳ đã chốt" : "Dữ liệu hiện tại" },
            { metric: "Tổng phải thu", value: formatVnd(data.totals.totalBilled) },
            { metric: "Đã thu", value: formatVnd(data.totals.totalPaid) },
            { metric: "Còn nợ", value: formatVnd(data.totals.totalDebt) },
          ],
        },
        {
          title: "Danh sách kỳ học phí",
          columns: [
            { key: "periodName", label: "Kỳ" },
            { key: "status", label: "Trạng thái" },
            { key: "chargeCount", label: "Số khoản thu" },
            { key: "total", label: "Phải thu" },
            { key: "paid", label: "Đã thu" },
            { key: "debt", label: "Còn nợ" },
          ],
          rows: data.periods.map((item) => ({
            ...item,
            total: formatVnd(item.total),
            paid: formatVnd(item.paid),
            debt: formatVnd(item.debt),
          })),
        },
        {
          title: "Tổng hợp học phí theo lớp",
          columns: [
            { key: "classCode", label: "Mã lớp" },
            { key: "className", label: "Tên lớp" },
            { key: "studentCount", label: "Số HV" },
            { key: "sessionCount", label: "Số buổi" },
            { key: "openingBalance", label: "Tồn đầu kỳ" },
            { key: "tuitionAmount", label: "Học phí" },
            { key: "materialsAmount", label: "Giáo trình" },
            { key: "billedAmount", label: "Phải thu" },
            { key: "collectedAmount", label: "Đã thu" },
            { key: "remainingAmount", label: "Còn nợ" },
          ],
          rows: data.latestSummary.classes.map((item) => ({
            ...item,
            openingBalance: formatVnd(item.openingBalance),
            tuitionAmount: formatVnd(item.tuitionAmount),
            materialsAmount: formatVnd(item.materialsAmount),
            billedAmount: formatVnd(item.billedAmount),
            collectedAmount: formatVnd(item.collectedAmount),
            remainingAmount: formatVnd(item.remainingAmount),
          })),
        },
        {
          title: "Công nợ cần xử lý",
          columns: [
            { key: "studentName", label: "Học viên" },
            { key: "studentCode", label: "Mã HV" },
            { key: "leadCode", label: "Mã lead" },
            { key: "className", label: "Lớp thu phí" },
            { key: "guardianName", label: "Phụ huynh chính" },
            { key: "guardianPhone", label: "SĐT PH" },
            { key: "guardianPortalEmail", label: "Portal PH" },
            { key: "remainingAmount", label: "Nợ kỳ này" },
            { key: "totalOutstanding", label: "Tổng nợ" },
          ],
          rows: (data.selectedPeriod?.debtors ?? []).map((item) => ({
            ...item,
            remainingAmount: formatVnd(item.remainingAmount),
            totalOutstanding: formatVnd(item.totalOutstanding),
          })),
        },
      ],
      `hoc-phi_${data.meta.periodKey ?? periodKey}_${data.meta.effectiveMode}`,
      "HocPhi",
    );
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="page-title">Học phí</h1>
            <p className="page-subtitle">Theo dõi kỳ thu, phải thu, đã thu, còn nợ và bản đã chốt theo tháng.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManageTuition ? <NewPeriodForm /> : null}
            <button onClick={handleExport} disabled={!data} className="btn-ghost">
              Xuất Excel
            </button>
            {canManageTuition ? (
              <button onClick={createSnapshot} disabled={creatingSnapshot} className="btn-ghost">
                {getCreateSnapshotButtonLabel("tuition", creatingSnapshot)}
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
            <span className="text-xs font-medium text-ink-muted48">Kỳ báo cáo</span>
            <input type="month" value={periodKey} onChange={(event) => setPeriodKey(event.target.value)} className="input" />
          </label>
          <div className="flex items-end">
            <button onClick={applyFilters} className="btn-primary w-full">Xem dữ liệu</button>
          </div>
        </div>

        {data?.meta ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className={`badge ${data.meta.effectiveMode === "snapshot" ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
              {getReportEffectiveBadge(data.meta.effectiveMode, "tuition")}
            </span>
            <span className="badge bg-ink/5 text-ink-muted80">Kỳ: {data.meta.periodKey ?? periodKey}</span>
            {data.meta.snapshotAt ? (
              <span className="badge bg-emerald-100 text-emerald-700">{getSnapshotTimestampLabel("tuition", data.meta.snapshotAt)}</span>
            ) : (
              <span className="badge bg-ink/5 text-ink-muted80">{getLiveFallbackLabel("tuition")}</span>
            )}
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>

      {loading || !data ? (
        <div className="card">
          <p className="text-sm text-ink-muted48">Đang tải dữ liệu học phí...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Tổng phải thu</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{formatVnd(data.totals.totalBilled)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Đã thu</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-emerald-600">{formatVnd(data.totals.totalPaid)}</p>
            </div>
            <div className="stat-card-accent">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Còn nợ</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">{formatVnd(data.totals.totalDebt)}</p>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">Tổng hợp học phí theo lớp</h2>
                <p className="mt-1 text-sm text-ink-muted48">Kỳ tổng hợp gần nhất: {data.latestSummary.periodName ?? "Chưa có"}</p>
              </div>
            </div>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                <tr>
                  <th className="py-2 font-medium">Lớp</th>
                  <th className="py-2 font-medium">HV</th>
                  <th className="py-2 font-medium">Buổi</th>
                  <th className="py-2 font-medium">Phải thu</th>
                  <th className="py-2 font-medium">Đã thu</th>
                  <th className="py-2 font-medium">Còn lại</th>
                </tr>
              </thead>
              <tbody>
                {data.latestSummary.classes.map((item) => (
                  <tr key={`${item.classCode}-${item.className}`} className="border-b border-hairline last:border-0">
                    <td className="py-2 font-medium">{item.className}</td>
                    <td className="py-2 text-ink-muted80">{item.studentCount}</td>
                    <td className="py-2 text-ink-muted80">{item.sessionCount}</td>
                    <td className="py-2 text-ink-muted80">{formatVnd(item.billedAmount)}</td>
                    <td className="py-2 text-emerald-600 font-medium">{formatVnd(item.collectedAmount)}</td>
                    <td className={`py-2 font-medium ${item.remainingAmount > 0 ? "text-red-600" : "text-ink-muted80"}`}>{formatVnd(item.remainingAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">Công nợ cần xử lý ngay</h2>
                <p className="mt-1 text-sm text-ink-muted48">
                  Danh sách nợ của kỳ {data.selectedPeriod?.periodName ?? data.meta.periodKey ?? periodKey}, ưu tiên cho thu ngân và quản lý xử lý nhanh.
                </p>
              </div>
              {data.selectedPeriod ? (
                <Link href={`/tuition/${data.selectedPeriod.id}`} className="text-sm font-medium text-primary hover:underline">
                  Mở chi tiết kỳ thu
                </Link>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {data.selectedPeriod?.debtors.map((debtor) => (
                <div key={debtor.chargeId} className="rounded-xl border border-hairline p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/students/${debtor.studentId}`} className="font-medium text-primary hover:underline">
                          {debtor.studentName}
                        </Link>
                        <span className="text-xs text-ink-muted48">({debtor.studentCode})</span>
                        {debtor.leadCode ? <span className="badge bg-sky-50 text-sky-700">Lead {debtor.leadCode}</span> : null}
                      </div>
                      <p className="mt-1 text-sm text-ink-muted48">
                        Lớp thu phí: {debtor.className}
                        {debtor.currentClassName !== debtor.className ? ` · Lớp đang học: ${debtor.currentClassName}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-ink-muted48">
                        PH chính: {debtor.guardianName ?? "Chưa gắn"} · {debtor.guardianPhone ?? "Chưa có SĐT"}
                      </p>
                      <p className="mt-1 text-sm text-ink-muted48">
                        Portal: {debtor.guardianPortalEmail ?? "Chưa tạo tài khoản"}{" "}
                        {debtor.guardianPortalActive ? "· hoạt động" : "· chưa kích hoạt"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-ink-muted48">Nợ kỳ này</p>
                      <p className="font-display text-xl font-semibold text-red-600">{formatVnd(debtor.remainingAmount)}</p>
                      <p className="mt-1 text-xs text-ink-muted48">Tổng nợ học viên: {formatVnd(debtor.totalOutstanding)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {(data.selectedPeriod?.debtors.length ?? 0) === 0 ? (
                <p className="text-sm text-ink-muted48">Không có công nợ mở trong kỳ đang xem.</p>
              ) : null}
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Kỳ</th>
                  <th>Số khoản thu</th>
                  <th>Tổng phải thu</th>
                  <th>Đã thu</th>
                  <th>Còn nợ</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data.periods.map((period) => (
                  <tr key={period.id}>
                    <td>
                      <Link href={`/tuition/${period.id}`} className="font-medium text-primary hover:underline">
                        {period.periodName}
                      </Link>
                    </td>
                    <td className="text-ink-muted80">{period.chargeCount}</td>
                    <td className="text-ink-muted80">{formatVnd(period.total)}</td>
                    <td className="text-emerald-600 font-medium">{formatVnd(period.paid)}</td>
                    <td className={`font-medium ${period.debt > 0 ? "text-red-600" : "text-ink-muted80"}`}>{formatVnd(period.debt)}</td>
                    <td><span className="badge-gray">{BILLING_PERIOD_STATUS_LABEL[period.status] ?? period.status}</span></td>
                  </tr>
                ))}
                {data.periods.length === 0 && (
                  <tr className="table-empty">
                    <td colSpan={6}>
                      <div className="empty-state">
                        <p className="empty-state-title">Chưa có kỳ thu nào</p>
                        <p className="empty-state-desc">Tạo kỳ thu để bắt đầu vận hành học phí chuẩn theo kỳ.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
