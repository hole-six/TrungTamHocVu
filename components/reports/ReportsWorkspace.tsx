"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/server/lead-rules";
import { getCreateSnapshotButtonLabel, getLiveFallbackLabel, getReportEffectiveBadge, getReportModeLabel, getSnapshotTimestampLabel } from "@/lib/reporting-ui";
import { exportSectionsToExcel } from "@/lib/export-utils";

type ReportsResponse = {
  meta: { requestedMode: "live"|"snapshot"; effectiveMode: "live"|"snapshot"; filters: { mode: "live"|"snapshot"; periodKey: string|null; keyword: string|null; timePreset: string }; snapshotReady: boolean; snapshotId: string|null; snapshotAt: string|null; periodKey: string|null };
  dashboard: {
    studentActive: number; studentLeft: number; totalLeads: number; conversionRate: number;
    leadPipeline: Record<string, number>; revenueByPeriod: Array<{ period: string; billed: number; collected: number }>;
    debtors: Array<{ id: string; fullName: string; studentCode: string; outstanding: number; guardianName?: string|null; guardianPhone?: string|null; guardianPortalEmail?: string|null; guardianPortalActive?: boolean; leadCode?: string|null; className?: string|null }>;
    portalCoverageCount: number; studentsWithoutPortal: number; convertedStudentsWithoutPortal: number; qualifiedLeadsWithoutClass: number;
    materialsTotal: number; materialsCost: number; materialsProfit: number; bookRanking: Array<{ name: string; total: number }>;
    payrollByPeriod: Array<{ period: string; total: number }>; totalThu: number; totalChi: number;
    birthdayThisMonth: Array<{ id: string; fullName: string; studentCode: string; dob: string|null }>;
    tuitionByClass: Array<{ className: string; sessionCount: number; tuitionTotal: number; materialsTotal: number; billed: number; collected: number }>;
    payrollBreakdown: null | { periodName: string; teachers: Array<{ name: string; hours: number; amount: number }>; assistants: Array<{ name: string; hours: number; amount: number }> };
  };
  reportHs: { activeStudents: number; leftStudents: number; newEnrollments: number; totalStudents: number; classes: Array<{ classCode: string; className: string; activeCount: number; leftCount: number; totalCount: number }> };
  reportHp: null | { periodName: string|null; totals: { sessionCount: number; materialsAmount: number; openingBalance: number; tuitionAmount: number; billedAmount: number; collectedAmount: number; remainingAmount: number }; classes: Array<{ classCode: string; className: string; sessionCount: number; materialsAmount: number; openingBalance: number; tuitionAmount: number; billedAmount: number; collectedAmount: number; remainingAmount: number; studentCount: number }> };
};

function fvnd(n: number) { return `${n.toLocaleString("vi-VN")}đ`; }
function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }
function getDefaultPeriodKey() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; }

const PIPELINE_COLOR: Record<string, string> = {
  NEW: "#f97316", CONTACTING: "#ea580c", APPOINTED: "#c2410c", TESTED: "#ea580c",
  QUALIFIED: "#f59e0b", UNQUALIFIED: "#94a3b8", ENROLLED: "#10b981", LOST: "#ef4444",
};

function KpiTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-1">{label}</p>
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-[#94a3b8] mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="text-lg font-black tracking-tight text-[#0f1729]">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function ReportsWorkspace({ canAccessReports }: { canAccessReports: boolean }) {
  const searchParams = useSearchParams(); const pathname = usePathname(); const router = useRouter();
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true); const [creating, setCreating] = useState(false); const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"live"|"snapshot">((searchParams.get("mode") as "live"|"snapshot") ?? "live");
  const [periodKey, setPeriodKey] = useState(searchParams.get("periodKey") ?? getDefaultPeriodKey());
  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");
  const qs = useMemo(() => searchParams.toString(), [searchParams]);

  useEffect(() => { setMode((searchParams.get("mode") as "live"|"snapshot") ?? "live"); setPeriodKey(searchParams.get("periodKey") ?? getDefaultPeriodKey()); setKeyword(searchParams.get("q") ?? ""); }, [searchParams]);

  useEffect(() => {
    if (!canAccessReports) return;
    const ctrl = new AbortController();
    setLoading(true); setError(null);
    fetch(`/api/reports/summary?${qs}`, { cache: "no-store", signal: ctrl.signal })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Không tải được dữ liệu."); return r.json(); })
      .then((d: ReportsResponse) => setData(d))
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [qs, canAccessReports]);

  const applyFilters = () => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("mode", mode); p.set("periodKey", periodKey); p.set("timePreset", mode === "snapshot" ? "current_period" : "this_month");
    if (keyword.trim()) p.set("q", keyword.trim()); else p.delete("q");
    router.push(`${pathname}?${p.toString()}`);
  };

  const createSnapshot = async () => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("mode", "snapshot"); p.set("periodKey", periodKey); p.set("timePreset", "current_period");
    setCreating(true); setError(null);
    try {
      const r = await fetch(`/api/reports/summary?${p.toString()}`, { method: "POST" });
      const pl = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(pl.error ?? "Không chốt được báo cáo.");
      router.push(`${pathname}?${p.toString()}`); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Không chốt được."); }
    finally { setCreating(false); }
  };

  const handleExport = () => {
    if (!data) return;
    exportSectionsToExcel([
      { title: "Tổng quan", columns: [{ key: "metric", label: "Chỉ số" }, { key: "value", label: "Giá trị" }],
        rows: [
          { metric: "Kỳ báo cáo", value: data.meta.periodKey ?? periodKey },
          { metric: "Học viên đang học", value: data.dashboard.studentActive },
          { metric: "Tổng lead", value: data.dashboard.totalLeads },
          { metric: "Tỉ lệ chuyển đổi", value: `${data.dashboard.conversionRate}%` },
          { metric: "Tổng thu", value: fvnd(data.dashboard.totalThu) },
          { metric: "Tổng chi", value: fvnd(data.dashboard.totalChi) },
        ] },
      { title: "Pipeline lead", columns: [{ key: "status", label: "Trạng thái" }, { key: "count", label: "Số lượng" }],
        rows: Object.entries(data.dashboard.leadPipeline).map(([s, c]) => ({ status: LEAD_STATUS_LABEL[s as keyof typeof LEAD_STATUS_LABEL] ?? s, count: c })) },
      { title: "Công nợ", columns: [{ key: "student", label: "Học viên" }, { key: "class", label: "Lớp" }, { key: "guardian", label: "PH" }, { key: "portal", label: "Portal" }, { key: "debt", label: "Nợ" }],
        rows: data.dashboard.debtors.map((d) => ({ student: `${d.fullName} (${d.studentCode})`, class: d.className ?? "", guardian: d.guardianName ?? "", portal: d.guardianPortalEmail ?? "", debt: fvnd(d.outstanding) })) },
      { title: "Học phí theo lớp", columns: [{ key: "className", label: "Lớp" }, { key: "sessionCount", label: "Buổi" }, { key: "billed", label: "Phải thu" }, { key: "collected", label: "Đã thu" }],
        rows: data.dashboard.tuitionByClass.map((r) => ({ ...r, billed: fvnd(r.billed), collected: fvnd(r.collected) })) },
    ], `bao-cao_${data.meta.periodKey ?? periodKey}`, "BaoCao");
  };

  if (!canAccessReports) {
    return <div className="rounded-2xl border border-[#e5eaf7] bg-white p-8"><p className="text-[#94a3b8]">Không có quyền truy cập báo cáo.</p></div>;
  }

  return (
    <div className="space-y-6 pb-16">

      {/* ── Header + filters ─────────────────────────── */}
      <div className="rounded-2xl border border-[#e5eaf7] bg-gradient-to-b from-white to-[#f8faff] p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#0f1729]">Báo cáo tổng hợp</h1>
            <p className="mt-1 text-sm text-[#64748b]">Chọn kỳ, xem live hoặc bản đã chốt. Không sửa dữ liệu gốc từ đây.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleExport} disabled={!data} className="inline-flex items-center gap-2 rounded-xl border-2 border-[#e5eaf7] bg-white px-4 py-2.5 text-sm font-bold text-[#475569] hover:border-[#f97316] hover:text-[#f97316] transition disabled:opacity-40">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Xuất Excel
            </button>
            <button onClick={createSnapshot} disabled={creating} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#f97316] to-[#ea580c] px-4 py-2.5 text-sm font-bold text-white shadow hover:shadow-lg hover:-translate-y-0.5 transition disabled:opacity-60">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              {getCreateSnapshotButtonLabel("report", creating)}
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Chế độ dữ liệu</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as "live"|"snapshot")}
              className="w-full rounded-xl border border-[#e5eaf7] bg-white px-3 py-2.5 text-sm font-semibold text-[#0f1729] outline-none focus:border-[#f97316] transition">
              <option value="live">{getReportModeLabel("live")}</option>
              <option value="snapshot">{getReportModeLabel("snapshot")}</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Kỳ báo cáo</span>
            <input type="month" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)}
              className="w-full rounded-xl border border-[#e5eaf7] bg-white px-3 py-2.5 text-sm font-semibold text-[#0f1729] outline-none focus:border-[#f97316] transition" />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Tìm kiếm nhanh</span>
            <div className="flex gap-2">
              <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tên, mã HV, SĐT, phụ huynh, lớp..."
                className="flex-1 rounded-xl border border-[#e5eaf7] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#f97316] transition" />
              <button onClick={applyFilters} className="rounded-xl bg-[#f97316] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#ea580c] transition">
                Áp dụng
              </button>
            </div>
          </label>
        </div>

        {data?.meta && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${data.meta.effectiveMode === "snapshot" ? "bg-[#fef9c3] text-[#854d0e]" : "bg-[#fff7ed] text-[#c2410c]"}`}>
              {getReportEffectiveBadge(data.meta.effectiveMode, "report")}
            </span>
            <span className="inline-flex rounded-lg bg-[#f8faff] border border-[#e5eaf7] px-2.5 py-1 text-xs font-bold text-[#64748b]">Kỳ: {data.meta.periodKey ?? periodKey}</span>
            {data.meta.snapshotAt ? (
              <span className="inline-flex rounded-lg bg-[#ecfdf5] px-2.5 py-1 text-xs font-bold text-[#065f46]">{getSnapshotTimestampLabel("report", data.meta.snapshotAt)}</span>
            ) : (
              <span className="inline-flex rounded-lg bg-[#f8faff] border border-[#e5eaf7] px-2.5 py-1 text-xs text-[#94a3b8]">{getLiveFallbackLabel("report")}</span>
            )}
          </div>
        )}
        {error && <p className="mt-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] px-4 py-2 text-sm font-semibold text-[#b91c1c]">{error}</p>}
      </div>

      {loading || !data ? (
        <div className="rounded-2xl border border-[#e5eaf7] bg-white p-12 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-[#e5eaf7] border-t-[#f97316]" />
          <p className="text-sm text-[#94a3b8]">Đang tải báo cáo...</p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* ── Row 1: KPI tiles ─────────────────────── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <KpiTile label="Đang học" value={String(data.dashboard.studentActive)} sub={`${data.dashboard.studentLeft} đã nghỉ`} color="#f97316" />
            <KpiTile label="Tổng lead" value={String(data.dashboard.totalLeads)} color="#ea580c" />
            <KpiTile label="Tỉ lệ CĐ" value={`${data.dashboard.conversionRate}%`} sub="lead → HV" color="#10b981" />
            <KpiTile label="Cần cấp portal" value={String(data.dashboard.studentsWithoutPortal)} color="#f59e0b" />
            <KpiTile label="Tổng thu" value={fvnd(data.dashboard.totalThu)} color="#10b981" />
            <KpiTile label="Dư / Thâm" value={fvnd(data.dashboard.totalThu - data.dashboard.totalChi)} color={data.dashboard.totalThu - data.dashboard.totalChi >= 0 ? "#10b981" : "#ef4444"} />
          </div>

          {/* ── Row 2: Pipeline + Revenue ─────────────── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SectionCard title="Phễu tuyển sinh">
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-xl bg-[#fff7ed] border border-[#fed7aa] p-3 text-center">
                  <p className="text-2xl font-black text-[#c2410c]">{data.dashboard.totalLeads}</p>
                  <p className="text-xs font-bold text-[#f97316]">Tổng lead</p>
                </div>
                <div className="rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] p-3 text-center">
                  <p className="text-2xl font-black text-[#065f46]">{data.dashboard.conversionRate}%</p>
                  <p className="text-xs font-bold text-[#10b981]">Tỉ lệ CĐ</p>
                </div>
              </div>
              <div className="space-y-2">
                {LEAD_STATUSES.map((s) => {
                  const count = data.dashboard.leadPipeline[s] ?? 0;
                  const max = Math.max(1, ...LEAD_STATUSES.map((k) => data.dashboard.leadPipeline[k] ?? 0));
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PIPELINE_COLOR[s] }} />
                      <span className="w-36 shrink-0 text-xs font-semibold text-[#475569]">{LEAD_STATUS_LABEL[s as keyof typeof LEAD_STATUS_LABEL]}</span>
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[#f1f5f9]">
                        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(count > 0 ? 3 : 0, (count / max) * 100)}%`, backgroundColor: PIPELINE_COLOR[s] }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-sm font-black text-[#0f1729]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Doanh thu theo kỳ" action={<Link href="/tuition" className="text-sm font-bold text-[#f97316]">Mở →</Link>}>
              <div className="space-y-3">
                {data.dashboard.revenueByPeriod.map((row) => {
                  const p = pct(row.collected, row.billed);
                  return (
                    <div key={row.period} className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#0f1729]">{row.period}</span>
                        <span className={`text-xs font-bold ${p >= 90 ? "text-[#10b981]" : p >= 60 ? "text-[#f59e0b]" : "text-[#ef4444]"}`}>{p}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#e5eaf7] mb-2">
                        <div className={`h-full rounded-full ${p >= 90 ? "bg-[#10b981]" : p >= 60 ? "bg-[#f59e0b]" : "bg-[#ef4444]"}`} style={{ width: `${p}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-[#64748b]">
                        <span>Phải thu {fvnd(row.billed)}</span>
                        <span className="font-semibold text-[#0f1729]">Đã thu {fvnd(row.collected)}</span>
                      </div>
                    </div>
                  );
                })}
                {data.dashboard.revenueByPeriod.length === 0 && <p className="text-sm text-[#94a3b8]">Chưa có dữ liệu kỳ học phí.</p>}
              </div>
            </SectionCard>
          </div>

          {/* ── Row 3: Debtors + Operational alerts ────── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SectionCard title="Top công nợ" action={<Link href="/tuition" className="text-sm font-bold text-[#f97316]">Mở học phí →</Link>}>
              <div className="space-y-2">
                {data.dashboard.debtors.map((d) => (
                  <div key={d.id} className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/students/${d.id}`} className="font-bold text-[#f97316] hover:text-[#ea580c] truncate">{d.fullName}</Link>
                      <span className="text-sm font-black text-[#ef4444] whitespace-nowrap">{fvnd(d.outstanding)}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#64748b]">
                      {d.className ?? "Chưa có lớp"} · {d.guardianName ?? "Chưa có PH"} ·{" "}
                      <span className={d.guardianPortalActive ? "text-[#10b981]" : "text-[#f59e0b]"}>
                        {d.guardianPortalActive ? "Portal hoạt động" : "Chưa có portal"}
                      </span>
                    </p>
                  </div>
                ))}
                {data.dashboard.debtors.length === 0 && (
                  <div className="rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] px-4 py-3 text-sm font-semibold text-[#065f46]">✓ Không có học viên nợ học phí.</div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Cảnh báo vận hành">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "HV đã có portal PH", value: data.dashboard.portalCoverageCount, color: "#10b981", bg: "bg-[#ecfdf5] border-[#a7f3d0]" },
                  { label: "HV chưa có portal PH", value: data.dashboard.studentsWithoutPortal, color: "#f59e0b", bg: "bg-[#fef9c3] border-[#fde047]" },
                  { label: "Convert chưa có portal", value: data.dashboard.convertedStudentsWithoutPortal, color: "#ef4444", bg: "bg-[#fef2f2] border-[#fecaca]" },
                  { label: "Đạt chưa xếp lớp", value: data.dashboard.qualifiedLeadsWithoutClass, color: "#f97316", bg: "bg-[#fff7ed] border-[#fed7aa]" },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl border p-4 ${item.bg}`}>
                    <p className="text-xs font-semibold text-[#64748b] mb-1">{item.label}</p>
                    <p className="text-2xl font-black" style={{ color: item.color }}>{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl bg-[#f8faff] border border-[#e5eaf7] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-3">Dòng tiền tổng</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-[#64748b]">Tổng thu</p>
                    <p className="text-lg font-black text-[#10b981]">{fvnd(data.dashboard.totalThu)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#64748b]">Tổng chi</p>
                    <p className="text-lg font-black text-[#ef4444]">{fvnd(data.dashboard.totalChi)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#64748b]">Số dư</p>
                    <p className={`text-lg font-black ${data.dashboard.totalThu - data.dashboard.totalChi >= 0 ? "text-[#f97316]" : "text-[#f59e0b]"}`}>
                      {fvnd(data.dashboard.totalThu - data.dashboard.totalChi)}
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* ── Row 4: Tuition by class table ────────── */}
          {data.dashboard.tuitionByClass.length > 0 && (
            <SectionCard title={`Học phí theo lớp — kỳ ${data.reportHp?.periodName ?? ""}`}>
              <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f8faff]">
                    <tr>
                      {["Lớp", "Buổi", "Học phí", "Giáo trình", "Phải thu", "Đã thu", "Còn lại"].map((h) => (
                        <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#64748b] first:rounded-l-xl last:rounded-r-xl">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.dashboard.tuitionByClass.map((row) => {
                      const remaining = row.billed - row.collected;
                      return (
                        <tr key={row.className} className="border-b border-[#f0f4f8] last:border-0 hover:bg-[#f8faff] transition">
                          <td className="px-4 py-3 font-bold text-[#0f1729]">{row.className}</td>
                          <td className="px-4 py-3 text-[#64748b]">{row.sessionCount}</td>
                          <td className="px-4 py-3 text-[#475569]">{fvnd(row.tuitionTotal)}</td>
                          <td className="px-4 py-3 text-[#475569]">{fvnd(row.materialsTotal)}</td>
                          <td className="px-4 py-3 font-semibold text-[#0f1729]">{fvnd(row.billed)}</td>
                          <td className="px-4 py-3 font-semibold text-[#10b981]">{fvnd(row.collected)}</td>
                          <td className={`px-4 py-3 font-bold ${remaining > 0 ? "text-[#ef4444]" : "text-[#10b981]"}`}>{fvnd(remaining)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {data.reportHp && (
                    <tfoot className="bg-[#f8faff] font-black">
                      <tr>
                        <td className="px-4 py-3 rounded-l-xl text-[#0f1729]">Tổng cộng</td>
                        <td className="px-4 py-3 text-[#0f1729]">{data.reportHp.totals.sessionCount}</td>
                        <td className="px-4 py-3 text-[#0f1729]">{fvnd(data.reportHp.totals.tuitionAmount)}</td>
                        <td className="px-4 py-3 text-[#0f1729]">{fvnd(data.reportHp.totals.materialsAmount)}</td>
                        <td className="px-4 py-3 text-[#0f1729]">{fvnd(data.reportHp.totals.billedAmount)}</td>
                        <td className="px-4 py-3 text-[#10b981]">{fvnd(data.reportHp.totals.collectedAmount)}</td>
                        <td className="px-4 py-3 rounded-r-xl text-[#ef4444]">{fvnd(data.reportHp.totals.remainingAmount)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </SectionCard>
          )}

          {/* ── Row 5: Students by class + Payroll breakdown ── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SectionCard title="Học viên theo lớp">
              <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f8faff]">
                    <tr>
                      {["Lớp", "Đang học", "Đã nghỉ", "Tổng"].map((h) => (
                        <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#64748b]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.reportHs.classes.map((cls) => (
                      <tr key={cls.classCode} className="border-b border-[#f0f4f8] last:border-0 hover:bg-[#f8faff] transition">
                        <td className="px-4 py-3">
                          <p className="font-bold text-[#0f1729]">{cls.className}</p>
                          <p className="text-xs text-[#94a3b8]">{cls.classCode}</p>
                        </td>
                        <td className="px-4 py-3 font-bold text-[#f97316]">{cls.activeCount}</td>
                        <td className="px-4 py-3 text-[#ef4444]">{cls.leftCount}</td>
                        <td className="px-4 py-3 font-bold text-[#0f1729]">{cls.totalCount}</td>
                      </tr>
                    ))}
                    {data.reportHs.classes.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-[#94a3b8]">Chưa có dữ liệu lớp.</td></tr>
                    )}
                  </tbody>
                  <tfoot className="bg-[#f8faff] font-black">
                    <tr>
                      <td className="px-4 py-3 text-[#0f1729]">Tổng</td>
                      <td className="px-4 py-3 text-[#f97316]">{data.reportHs.activeStudents}</td>
                      <td className="px-4 py-3 text-[#ef4444]">{data.reportHs.leftStudents}</td>
                      <td className="px-4 py-3 text-[#0f1729]">{data.reportHs.totalStudents}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </SectionCard>

            <div className="space-y-5">
              {/* Payroll breakdown */}
              {data.dashboard.payrollBreakdown ? (
                <SectionCard title={`Công lương — kỳ ${data.dashboard.payrollBreakdown.periodName}`} action={<Link href="/payroll" className="text-sm font-bold text-[#f97316]">Mở →</Link>}>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Giáo viên", items: data.dashboard.payrollBreakdown.teachers, color: "#f97316" },
                      { label: "Trợ giảng", items: data.dashboard.payrollBreakdown.assistants, color: "#ea580c" },
                    ].map((g) => (
                      <div key={g.label}>
                        <p className="text-xs font-black uppercase tracking-wide mb-2" style={{ color: g.color }}>{g.label}</p>
                        <div className="space-y-1.5">
                          {g.items.map((l) => (
                            <div key={l.name} className="rounded-lg bg-[#f8faff] border border-[#e5eaf7] px-3 py-2">
                              <p className="text-xs font-bold text-[#0f1729] truncate">{l.name}</p>
                              <p className="text-[10px] text-[#64748b]">{l.hours}h · {fvnd(l.amount)}</p>
                            </div>
                          ))}
                          {g.items.length === 0 && <p className="text-xs text-[#94a3b8]">Chưa có dữ liệu.</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              ) : (
                <div className="rounded-2xl border border-[#e5eaf7] bg-[#f8faff] p-6 text-center text-sm text-[#94a3b8]">Chưa có kỳ lương nào.</div>
              )}

              {/* Materials */}
              <SectionCard title="Giáo trình & sách">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="rounded-xl bg-[#fff7ed] border border-[#fed7aa] p-3 text-center">
                    <p className="text-lg font-black text-[#c2410c]">{fvnd(data.dashboard.materialsTotal)}</p>
                    <p className="text-xs text-[#f97316]">Doanh thu sách</p>
                  </div>
                  <div className="rounded-xl bg-[#fef2f2] border border-[#fecaca] p-3 text-center">
                    <p className="text-lg font-black text-[#b91c1c]">{fvnd(data.dashboard.materialsCost)}</p>
                    <p className="text-xs text-[#ef4444]">Giá nhập</p>
                  </div>
                  <div className={`rounded-xl border p-3 text-center ${data.dashboard.materialsProfit >= 0 ? "bg-[#ecfdf5] border-[#a7f3d0]" : "bg-[#fef9c3] border-[#fde047]"}`}>
                    <p className={`text-lg font-black ${data.dashboard.materialsProfit >= 0 ? "text-[#065f46]" : "text-[#854d0e]"}`}>{fvnd(data.dashboard.materialsProfit)}</p>
                    <p className="text-xs text-[#64748b]">Lợi nhuận</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {data.dashboard.bookRanking.map((book, i) => (
                    <div key={book.name} className="flex items-center gap-3 rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#f97316] text-[10px] font-black text-white">{i + 1}</span>
                      <span className="flex-1 text-sm font-semibold text-[#0f1729] truncate">{book.name}</span>
                      <span className="text-xs font-bold text-[#64748b]">{fvnd(book.total)}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>

          {/* ── Row 6: Birthdays ─────────────────────── */}
          {data.dashboard.birthdayThisMonth.length > 0 && (
            <SectionCard title="🎂 Sinh nhật học viên tháng này">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {data.dashboard.birthdayThisMonth.map((s) => (
                  <Link key={s.id} href={`/students/${s.id}`}
                    className="flex items-center justify-between rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-3 py-2 hover:border-[#f97316] transition">
                    <span className="text-sm font-semibold text-[#f97316] truncate">{s.fullName}</span>
                    <span className="ml-2 text-xs font-bold text-[#64748b] whitespace-nowrap">
                      {new Date(s.dob!).getDate()}/{new Date(s.dob!).getMonth() + 1}
                    </span>
                  </Link>
                ))}
              </div>
            </SectionCard>
          )}

        </div>
      )}
    </div>
  );
}
