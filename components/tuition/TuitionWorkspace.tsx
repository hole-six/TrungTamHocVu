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
  const board = useMemo(() => {
    if (!data) return null;
    const debtors = data.selectedPeriod?.debtors ?? [];
    const portalMissingCount = debtors.filter((item) => !item.guardianPortalEmail).length;
    const portalInactiveCount = debtors.filter((item) => item.guardianPortalEmail && !item.guardianPortalActive).length;
    const heavyDebtors = [...debtors].sort((a, b) => b.totalOutstanding - a.totalOutstanding).slice(0, 5);
    const debtByClass = [...data.latestSummary.classes].sort((a, b) => b.remainingAmount - a.remainingAmount);
    return {
      debtorCount: debtors.length,
      portalMissingCount,
      portalInactiveCount,
      heavyDebtors,
      debtByClass,
      classWithDebtCount: debtByClass.filter((item) => item.remainingAmount > 0).length,
      averageDebt: debtors.length ? Math.round(debtors.reduce((sum, item) => sum + item.totalOutstanding, 0) / debtors.length) : 0,
    };
  }, [data]);
  const selectedPeriodSummary = useMemo(() => {
    if (!data) return null;
    if (data.selectedPeriod?.id) {
      return data.periods.find((item) => item.id === data.selectedPeriod?.id) ?? null;
    }
    const key = data.meta.periodKey ?? periodKey;
    return data.periods.find((item) => item.periodName === key) ?? null;
  }, [data, periodKey]);
  const portfolioTotals = useMemo(() => {
    if (!data) return null;
    return {
      billed: data.totals.totalBilled,
      paid: data.totals.totalPaid,
      debt: data.totals.totalDebt,
      periodCount: data.periods.length,
    };
  }, [data]);

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
          <div className="card">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight text-ink">Bức tranh kỳ đang xem</h2>
                <p className="mt-1 text-sm text-ink-muted48">
                  Mọi số chính ở hàng dưới đều bám theo kỳ <strong>{selectedPeriodSummary?.periodName ?? data.meta.periodKey ?? periodKey}</strong>, để tránh nhầm với số cộng dồn toàn hệ thống.
                </p>
              </div>
              <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm text-ink-muted80">
                <p className="font-semibold text-ink">Nguyên tắc đọc trang này</p>
                <p className="mt-1">1 kỳ đang xem → 1 nhóm tổng quan → 1 danh sách cần thu → 1 bảng theo lớp → 1 lịch sử các kỳ.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Phải thu kỳ này</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{formatVnd(selectedPeriodSummary?.total ?? 0)}</p>
              <p className="mt-1 text-xs text-ink-muted48">{selectedPeriodSummary?.chargeCount ?? 0} khoản thu trong kỳ</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Đã thu kỳ này</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-emerald-600">{formatVnd(selectedPeriodSummary?.paid ?? 0)}</p>
              <p className="mt-1 text-xs text-ink-muted48">Số đã thu của đúng kỳ đang xem</p>
            </div>
            <div className="stat-card-accent">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Còn nợ kỳ này</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">{formatVnd(selectedPeriodSummary?.debt ?? 0)}</p>
              <p className="mt-1 text-xs text-white/75">Ưu tiên xử lý theo kỳ hiện hành</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">HV cần xử lý</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{board?.debtorCount ?? 0}</p>
              <p className="mt-1 text-xs text-ink-muted48">Trong kỳ {data.selectedPeriod?.periodName ?? data.meta.periodKey ?? periodKey}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">PH thiếu portal</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{board?.portalMissingCount ?? 0}</p>
              <p className="mt-1 text-xs text-ink-muted48">{board?.portalInactiveCount ?? 0} portal chưa kích hoạt</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Lớp còn nợ</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{board?.classWithDebtCount ?? 0}</p>
              <p className="mt-1 text-xs text-ink-muted48">Nợ bình quân: {formatVnd(board?.averageDebt ?? 0)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <div className="card">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight">Tổng quan toàn bộ danh mục học phí</h2>
                  <p className="mt-1 text-sm text-ink-muted48">Khối này để quản lý nhìn sức khỏe tài chính chung, tách riêng khỏi số của kỳ đang xem.</p>
                </div>
                <span className="badge bg-ink/5 text-ink-muted80">{portfolioTotals?.periodCount ?? 0} kỳ thu đã ghi nhận</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Phải thu cộng dồn</p>
                  <p className="mt-2 text-xl font-semibold text-ink">{formatVnd(portfolioTotals?.billed ?? 0)}</p>
                </div>
                <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Đã thu cộng dồn</p>
                  <p className="mt-2 text-xl font-semibold text-emerald-600">{formatVnd(portfolioTotals?.paid ?? 0)}</p>
                </div>
                <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Công nợ cộng dồn</p>
                  <p className="mt-2 text-xl font-semibold text-red-600">{formatVnd(portfolioTotals?.debt ?? 0)}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="font-display text-base font-bold tracking-tight text-ink">Việc cần minh mẫn ngay</h2>
              <div className="mt-3 space-y-3 text-sm">
                <div className="rounded-2xl border border-hairline p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Checklist vận hành</p>
                  <ul className="mt-2 space-y-2">
                    <li>• Mọi số lớn ở đầu trang đọc theo kỳ đang xem, không lấy số cộng dồn để đi thu tiền.</li>
                    <li>• Khi lớp còn nợ cao, phải đối chiếu attendance, giáo trình và giảm trừ trước khi nhắc phụ huynh.</li>
                    <li>• Portal phụ huynh thiếu hoặc chưa kích hoạt phải xử lý sớm, để hóa đơn và nhật ký gửi được đồng bộ.</li>
                    <li>• Snapshot chỉ dùng đối soát kỳ cũ, không coi là nơi chỉnh dữ liệu gốc.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)]">
            <div className="space-y-6">
              <div className="card">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold tracking-tight">Bảng điều hành kỳ thu</h2>
                    <p className="mt-1 text-sm text-ink-muted48">Giữ lại ngữ cảnh của đúng kỳ đang xem: kỳ nào, bản nào, nợ ai, portal nào thiếu.</p>
                  </div>
                  {data.selectedPeriod ? (
                    <Link href={`/tuition/${data.selectedPeriod.id}`} className="text-sm font-medium text-primary hover:underline">
                      Mở chi tiết kỳ thu
                    </Link>
                  ) : null}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Ngữ cảnh kỳ đang xem</p>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-ink-muted48">Kỳ / chế độ</dt>
                        <dd className="text-right font-medium">{data.meta.periodKey ?? periodKey} · {data.meta.effectiveMode === "snapshot" ? "Đã chốt" : "Hiện tại"}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-ink-muted48">Snapshot</dt>
                        <dd className="text-right font-medium">{data.meta.snapshotAt ? getSnapshotTimestampLabel("tuition", data.meta.snapshotAt) : "Chưa có snapshot"}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-ink-muted48">HV có nợ</dt>
                        <dd className="text-right font-medium">{board?.debtorCount ?? 0}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-ink-muted48">Portal PH thiếu</dt>
                        <dd className="text-right font-medium">{board?.portalMissingCount ?? 0}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Ưu tiên quản lý</p>
                    <ul className="mt-3 space-y-2 text-sm">
                      <li>• Thu ngân ưu tiên nợ kỳ này trước, sau đó mới xử lý các khoản treo cũ.</li>
                      <li>• Quản lý ưu tiên phụ huynh chưa có portal hoặc portal chưa kích hoạt.</li>
                      <li>• Lớp nợ cao phải đối chiếu sĩ số thực học, giáo trình và điều chỉnh phát sinh.</li>
                      <li>• Khi cần chứng từ khóa sổ mới dùng snapshot để đối soát.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="card overflow-x-auto">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold tracking-tight">Tổng hợp theo lớp</h2>
                    <p className="mt-1 text-sm text-ink-muted48">Nhìn lớp nào thu tốt, lớp nào đang treo nợ, lớp nào vướng tồn đầu hoặc giáo trình.</p>
                  </div>
                </div>
                <table className="mt-3 w-full text-left text-sm">
                  <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                    <tr>
                      <th className="py-2 font-medium">Lớp</th>
                      <th className="py-2 font-medium">HV</th>
                      <th className="py-2 font-medium">Buổi</th>
                      <th className="py-2 font-medium">Tồn đầu</th>
                      <th className="py-2 font-medium">Học phí + phát sinh</th>
                      <th className="py-2 font-medium">Đã thu</th>
                      <th className="py-2 font-medium">Còn nợ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(board?.debtByClass ?? data.latestSummary.classes).map((item) => (
                      <tr key={`${item.classCode}-${item.className}`} className="border-b border-hairline last:border-0">
                        <td className="py-2 font-medium">
                          <div>{item.className}</div>
                          <div className="text-xs text-ink-muted48">{item.classCode}</div>
                        </td>
                        <td className="py-2 text-ink-muted80">{item.studentCount}</td>
                        <td className="py-2 text-ink-muted80">{item.sessionCount}</td>
                        <td className="py-2 text-ink-muted80">{formatVnd(item.openingBalance)}</td>
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
                </div>

                <div className="mt-4 space-y-3">
                  {data.selectedPeriod?.debtors.map((debtor, index) => (
                    <div key={debtor.chargeId} className="rounded-xl border border-hairline p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="badge bg-primary/10 text-primary">#{index + 1}</span>
                            <Link href={`/students/${debtor.studentId}`} className="font-medium text-primary hover:underline">
                              {debtor.studentName}
                            </Link>
                            <span className="text-xs text-ink-muted48">({debtor.studentCode})</span>
                            {debtor.leadCode ? <span className="badge bg-sky-50 text-sky-700">Lead {debtor.leadCode}</span> : null}
                            {!debtor.guardianPortalEmail ? <span className="badge bg-amber-100 text-amber-700">Thiếu portal</span> : null}
                          </div>
                          <p className="mt-1 text-sm text-ink-muted48">
                            Lớp thu phí: {debtor.className}
                            {debtor.currentClassName !== debtor.className ? ` · Lớp đang học: ${debtor.currentClassName}` : ""}
                          </p>
                          <p className="mt-1 text-sm text-ink-muted48">
                            PH chính: {debtor.guardianName ?? "Chưa gắn"} · {debtor.guardianPhone ?? "Chưa có SĐT"}
                          </p>
                          <p className="mt-1 text-sm text-ink-muted48">
                            Portal: {debtor.guardianPortalEmail ?? "Chưa tạo tài khoản"} {debtor.guardianPortalEmail ? (debtor.guardianPortalActive ? "· hoạt động" : "· chưa kích hoạt") : ""}
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
            </div>

            <div className="space-y-6">
              <div className="card">
                <h2 className="font-display text-base font-bold tracking-tight text-ink">Panel điều hành</h2>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="rounded-2xl border border-hairline p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Cảnh báo</p>
                    <ul className="mt-2 space-y-2">
                      {(selectedPeriodSummary?.debt ?? 0) > 0 ? <li>• Công nợ của kỳ đang xem là {formatVnd(selectedPeriodSummary?.debt ?? 0)}.</li> : null}
                      {(portfolioTotals?.debt ?? 0) > 0 ? <li>• Công nợ cộng dồn toàn bộ hệ thống đang là {formatVnd(portfolioTotals?.debt ?? 0)}.</li> : null}
                      {(board?.portalMissingCount ?? 0) > 0 ? <li>• Có {board?.portalMissingCount} phụ huynh chưa có portal để nhận reminder/journal.</li> : null}
                      {(board?.portalInactiveCount ?? 0) > 0 ? <li>• Có {board?.portalInactiveCount} portal phụ huynh chưa kích hoạt.</li> : null}
                      {(board?.classWithDebtCount ?? 0) > 0 ? <li>• Có {board?.classWithDebtCount} lớp còn nợ, cần đối chiếu cùng vận hành lớp.</li> : null}
                      {data.meta.effectiveMode === "live" ? <li>• Đang xem dữ liệu live, số liệu có thể đổi khi có thu tiền mới.</li> : <li>• Đang xem snapshot kỳ cũ, không sửa trực tiếp trên report.</li>}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-hairline p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Top nợ cao</p>
                    <div className="mt-2 space-y-2">
                      {board?.heavyDebtors.map((item) => (
                        <div key={item.chargeId} className="rounded-xl bg-canvas-parchment/50 px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <Link href={`/students/${item.studentId}`} className="font-medium text-primary hover:underline">
                              {item.studentName}
                            </Link>
                            <span className="font-medium text-red-600">{formatVnd(item.totalOutstanding)}</span>
                          </div>
                          <p className="mt-1 text-xs text-ink-muted48">{item.className} · {item.guardianName ?? "Chưa gắn PH"}</p>
                        </div>
                      ))}
                      {(board?.heavyDebtors.length ?? 0) === 0 ? <p className="text-sm text-ink-muted48">Không có học viên nợ cao.</p> : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-hairline p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Lối đi nhanh</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      {data.selectedPeriod ? (
                        <Link href={`/tuition/${data.selectedPeriod.id}`} className="text-primary hover:underline">
                          Mở kỳ thu →
                        </Link>
                      ) : null}
                      <Link href="/cashbook" className="text-primary hover:underline">
                        Mở sổ quỹ →
                      </Link>
                      <Link href="/guardians" className="text-primary hover:underline">
                        Mở phụ huynh →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Kỳ</th>
                  <th>Số khoản thu</th>
                  <th>Phải thu</th>
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
