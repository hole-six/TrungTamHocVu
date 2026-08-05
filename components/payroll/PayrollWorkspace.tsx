"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import NewEmployeeForm from "@/components/payroll/NewEmployeeForm";
import NewPayrollRunForm from "@/components/payroll/NewPayrollRunForm";
import PayrollExportButton from "@/components/payroll/PayrollExportButton";
import PayrollRunActions from "@/components/payroll/PayrollRunActions";
import AddPayrollLineForm from "@/components/payroll/AddPayrollLineForm";
import PayrollRateCsvTools from "@/components/payroll/PayrollRateCsvTools";
import PayrollEmployeeDrawer from "@/components/payroll/PayrollEmployeeDrawer";
import { PAYROLL_RUN_STATUS_LABEL } from "@/lib/server/payroll-rules";
import type { PayrollEmployeeRow } from "@/lib/server/payroll-row-builder";

type FilterMode = "all" | "missing-bank" | "ready-bank" | "missing-rate";

const PAGE_SIZE = 15;

type RunSummary = { id: string; periodName: string; status: string; lineCount: number } | null;

type Checklist = { items: { key: string; label: string; done: boolean; help: string }[]; isReady: boolean } | null;

function formatVnd(value: number) {
  return `${value.toLocaleString("vi-VN")}₫`;
}

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

function getContractTone(status: string | null) {
  if (!status || status === "Chưa có info") return "border-slate-200 bg-slate-50 text-slate-700";
  if (status.includes("Đã hết hạn")) return "border-rose-200 bg-rose-50 text-rose-700";
  if (status.includes("Sắp")) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getRunTone(status: string) {
  if (status === "PAID") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "LOCKED") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "APPROVED") return "border-violet-200 bg-violet-50 text-violet-700";
  if (status === "REVIEWED") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "CALCULATED") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function PayrollWorkspace({
  rows,
  period,
  run,
  branches,
  eligibleEmployees,
  checklist,
  initialEmployeeId,
  initialFilter,
  permissions,
}: {
  rows: PayrollEmployeeRow[];
  period: string;
  run: RunSummary;
  branches: { id: string; name: string }[];
  eligibleEmployees: { id: string; fullName: string }[];
  checklist: Checklist;
  initialEmployeeId: string | null;
  initialFilter: FilterMode;
  permissions: { canManageEmployees: boolean; canManagePayrollRuns: boolean; canCreateTimesheet: boolean };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(initialEmployeeId);
  const [drawerOpen, setDrawerOpen] = useState(Boolean(initialEmployeeId));

  function pageHref(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams?.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    return `/payroll?${params.toString()}`;
  }

  function openEmployee(id: string) {
    setSelectedEmployeeId(id);
    setDrawerOpen(true);
    router.replace(pageHref({ employeeId: id }), { scroll: false });
  }

  function closeDrawer() {
    setDrawerOpen(false);
    router.replace(pageHref({ employeeId: null }), { scroll: false });
  }

  const positionOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.position).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "vi")),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (initialFilter === "missing-bank" && row.hasBankInfo) return false;
      if (initialFilter === "ready-bank" && !row.hasBankInfo) return false;
      if (initialFilter === "missing-rate" && !row.hasRateIssue) return false;
      if (positionFilter && row.position !== positionFilter) return false;
      if (!normalizedQuery) return true;
      return (
        row.fullName.toLowerCase().includes(normalizedQuery) ||
        row.employeeCode.toLowerCase().includes(normalizedQuery) ||
        (row.position ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [rows, query, initialFilter, positionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function updateSearch(value: string) {
    setQuery(value);
    setPage(1);
  }

  function updatePositionFilter(value: string) {
    setPositionFilter(value);
    setPage(1);
  }

  useEffect(() => {
    setPage(1);
  }, [period, initialFilter]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.totalTeachingHours += row.teachingHours;
        acc.totalTeachingAmount += row.teachingAmount;
        acc.totalAssistantHours += row.assistantHours;
        acc.totalAssistantAmount += row.assistantAmount;
        acc.totalStaffDays += row.staffDays;
        acc.totalStaffHours += row.staffHours;
        acc.totalStaffAmount += row.baseSalaryAmount;
        acc.totalPayroll += row.totalAmount;
        acc.sessionCount += row.sessionCount;
        acc.timesheetEntryCount += row.timesheetEntryCount;
        if (row.hasRateIssue) acc.missingRateCount += 1;
        if (!row.hasBankInfo) acc.missingBankCount += 1;
        if (row.contractStatus && row.contractStatus !== "Chưa có info") acc.contractAttentionCount += 1;
        return acc;
      },
      {
        totalTeachingHours: 0,
        totalTeachingAmount: 0,
        totalAssistantHours: 0,
        totalAssistantAmount: 0,
        totalStaffDays: 0,
        totalStaffHours: 0,
        totalStaffAmount: 0,
        totalPayroll: 0,
        sessionCount: 0,
        timesheetEntryCount: 0,
        missingRateCount: 0,
        missingBankCount: 0,
        contractAttentionCount: 0,
      },
    );
  }, [rows]);

  const reviewCount = totals.missingRateCount + totals.contractAttentionCount;

  const selectedRow = selectedEmployeeId ? rows.find((row) => row.id === selectedEmployeeId) ?? null : null;
  const canEditPayrollLine = Boolean(run && permissions.canManagePayrollRuns && ["DRAFT", "CALCULATED", "REVIEWED"].includes(run.status));

  return (
    <div className="min-h-screen space-y-6 pb-20">
      <section className="rounded-[28px] border-2 border-[#fed7aa] bg-gradient-to-r from-[#fff7ed] via-white to-[#fff7ed] px-6 py-6 shadow-sm">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center rounded-full border border-[#fdba74] bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#c2410c]">
                Payroll
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-[#111827]">Bảng nhân sự & lương theo tháng</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6b7280]">
                  Toàn bộ nhân sự, đơn giá, chuyển khoản, dữ liệu công và dòng lương của tháng nằm trong đúng 1 bảng. Bấm
                  &quot;Sửa&quot; ở bất kỳ dòng nào để chỉnh mọi thứ trong 1 khung.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-3">
              {!run && permissions.canManagePayrollRuns ? <NewPayrollRunForm defaultPeriod={period} /> : null}
              <PayrollExportButton period={period} rows={rows} runStatus={run?.status ?? null} totals={totals} />
              {permissions.canManageEmployees ? <NewEmployeeForm /> : null}
              {permissions.canManageEmployees ? <PayrollRateCsvTools items={rows} /> : null}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-[#fed7aa] bg-white/80 px-5 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-[#111827]">Tháng lương:</span>
                <input
                  type="month"
                  className="input w-auto"
                  value={period}
                  onChange={(event) => {
                    if (event.target.value) router.push(pageHref({ period: event.target.value, employeeId: null }));
                  }}
                />
                <span className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-sm font-medium text-[#6b7280]">
                  {formatNumber(totals.sessionCount)} buổi
                </span>
                <span className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-sm font-medium text-[#6b7280]">
                  {formatNumber(totals.timesheetEntryCount)} ngày HC
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="w-full sm:w-64">
                  <input
                    className="input"
                    placeholder="Tìm theo mã, tên hoặc vị trí..."
                    value={query}
                    onChange={(event) => updateSearch(event.target.value)}
                  />
                </label>
                <label className="w-full sm:w-56">
                  <select className="input" value={positionFilter} onChange={(event) => updatePositionFilter(event.target.value)}>
                    <option value="">Tất cả vai trò</option>
                    {positionOptions.map((position) => (
                      <option key={position} value={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Tổng payroll</p>
                <p className="mt-2 text-2xl font-black text-[#111827]">{formatVnd(totals.totalPayroll)}</p>
                <p className="mt-1 text-xs text-[#6b7280]">Dạy + trợ giảng + hành chính</p>
              </div>
              <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Giờ giảng dạy</p>
                <p className="mt-2 text-2xl font-black text-[#111827]">{formatNumber(totals.totalTeachingHours + totals.totalAssistantHours)}</p>
                <p className="mt-1 text-xs text-[#6b7280]">
                  Dạy {formatNumber(totals.totalTeachingHours)} · TG {formatNumber(totals.totalAssistantHours)}
                </p>
              </div>
              <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Công hành chính</p>
                <p className="mt-2 text-2xl font-black text-[#111827]">{formatNumber(totals.totalStaffDays)}</p>
                <p className="mt-1 text-xs text-[#6b7280]">{formatNumber(totals.totalStaffHours)} giờ chấm công</p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 ${reviewCount > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Trạng thái dữ liệu</p>
                <p className={`mt-2 text-2xl font-black ${reviewCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {reviewCount > 0 ? `${formatNumber(reviewCount)} lỗi cần xem` : "Sẵn sàng"}
                </p>
                <p className={`mt-1 text-xs ${reviewCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {reviewCount > 0 ? "Cần sửa trước khi chốt" : "Có thể tiếp tục xử lý kỳ lương"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {run ? (
        <section className="rounded-2xl border-2 border-[#e5e7eb] bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Kỳ lương {run.periodName}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1.5 text-sm font-bold ${getRunTone(run.status)}`}>
                  {PAYROLL_RUN_STATUS_LABEL[run.status] ?? run.status}
                </span>
                <span className="rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 py-1.5 text-sm font-bold text-[#c2410c]">
                  {formatNumber(run.lineCount)} người đã có dòng lương
                </span>
                {checklist ? (
                  <span
                    className={`rounded-full border px-3 py-1.5 text-sm font-bold ${
                      checklist.isReady ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    Checklist chốt kỳ: {checklist.isReady ? "Đạt" : "Chưa đạt"}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {permissions.canManagePayrollRuns ? (
            <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <PayrollRunActions runId={run.id} status={run.status} checklistReady={checklist?.isReady ?? true} />
              <div className="space-y-4">
                {checklist ? (
                  <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-5 shadow-sm">
                    <h3 className="text-sm font-black text-[#111827]">Checklist chốt kỳ</h3>
                    <div className="mt-3 space-y-2 text-sm">
                      {checklist.items.map((item) => (
                        <div
                          key={item.key}
                          className={`rounded-xl border px-4 py-3 ${item.done ? "border-emerald-100 bg-emerald-50/60" : "border-amber-200 bg-amber-50"}`}
                        >
                          <p className={`font-bold ${item.done ? "text-emerald-700" : "text-amber-800"}`}>
                            {item.done ? "✓" : "•"} {item.label}
                          </p>
                          <p className="mt-1 text-xs text-[#6b7280]">{item.help}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {eligibleEmployees.length > 0 ? <AddPayrollLineForm payrollRunId={run.id} employeeOptions={eligibleEmployees} /> : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border-2 border-dashed border-[#e5e7eb] bg-white px-6 py-8 text-center text-sm text-[#6b7280] shadow-sm">
          Tháng {period} chưa có kỳ lương chính thức — bảng dưới đây đang hiển thị số liệu xem trước tính trực tiếp từ dữ liệu
          buổi dạy/trợ giảng/chấm công. Tạo kỳ lương ở góc trên để chốt số liệu chính thức.
        </section>
      )}

      <section className="flex flex-wrap gap-2">
        <Link
          href={pageHref({ filter: "all" })}
          className={`rounded-full border px-4 py-2 text-sm font-bold ${initialFilter === "all" ? "border-[#fed7aa] bg-[#fff7ed] text-[#ea580c]" : "border-[#e5e7eb] bg-white text-[#6b7280]"}`}
        >
          Tất cả ({formatNumber(rows.length)})
        </Link>
        <Link
          href={pageHref({ filter: "missing-rate" })}
          className={`rounded-full border px-4 py-2 text-sm font-bold ${initialFilter === "missing-rate" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-[#e5e7eb] bg-white text-[#6b7280]"}`}
        >
          Thiếu đơn giá ({formatNumber(totals.missingRateCount)})
        </Link>
        <Link
          href={pageHref({ filter: "missing-bank" })}
          className={`rounded-full border px-4 py-2 text-sm font-bold ${initialFilter === "missing-bank" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-[#e5e7eb] bg-white text-[#6b7280]"}`}
        >
          Thiếu chuyển khoản ({formatNumber(totals.missingBankCount)})
        </Link>
        <Link
          href={pageHref({ filter: "ready-bank" })}
          className={`rounded-full border px-4 py-2 text-sm font-bold ${initialFilter === "ready-bank" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#e5e7eb] bg-white text-[#6b7280]"}`}
        >
          Đủ thông tin chuyển khoản
        </Link>
      </section>

      <section className="overflow-hidden rounded-2xl border-2 border-[#e5e7eb] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#f3f4f6] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-xl font-black text-[#111827]">Bảng nhân sự payroll</h2>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 py-1.5 text-sm font-bold text-[#c2410c]">
              {formatNumber(filteredRows.length)} nhân sự
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700">
              {formatVnd(filteredRows.reduce((sum, row) => sum + row.totalAmount, 0))}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1700px]">
            <thead className="bg-[#fafafa]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Nhân sự</th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Trạng thái</th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Dạy</th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Trợ giảng</th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Hành chính</th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Thưởng / Phạt</th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">% Thưởng TG</th>
                <th className="px-4 py-4 text-right text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Tổng lương</th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Đơn giá</th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Chuyển khoản</th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Cảnh báo</th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Ghi chú</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {pagedRows.map((row) => {
                const isSelected = row.id === selectedEmployeeId;
                return (
                  <tr
                    key={row.id}
                    className={`transition ${isSelected ? "bg-orange-50/70" : row.hasRateIssue ? "bg-red-50/40 hover:bg-red-50/70" : "hover:bg-[#fafafa]"}`}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] text-sm font-black text-white">
                          {row.fullName.charAt(0)}
                        </div>
                        <div>
                          <button type="button" onClick={() => openEmployee(row.id)} className="text-left font-bold text-[#111827] transition hover:text-[#ea580c]">
                            {row.fullName}
                          </button>
                          <p className="mt-0.5 text-xs text-[#6b7280]">
                            {row.employeeCode} · {row.position ?? "Chưa cấu hình vị trí"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex flex-col items-start gap-1.5">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${
                            row.workStatus === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-700"
                          }`}
                        >
                          {row.workStatus === "ACTIVE" ? "Đang làm" : "Đã nghỉ"}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getContractTone(row.contractStatus)}`}>
                          {row.contractStatus || "HĐ ổn"}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${
                            row.lineId ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-600"
                          }`}
                        >
                          {row.lineId ? "Đã tính lương" : "Xem trước"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <div className="text-sm font-bold text-[#111827]">{formatNumber(row.teachingHours)}</div>
                      <div className="mt-1 text-xs text-[#6b7280]">{formatVnd(row.teachingAmount)}</div>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <div className="text-sm font-bold text-[#111827]">{formatNumber(row.assistantHours)}</div>
                      <div className="mt-1 text-xs text-[#6b7280]">{formatVnd(row.assistantAmount)}</div>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <div className="text-sm font-bold text-[#111827]">{formatNumber(row.staffDays)} công</div>
                      <div className="mt-1 text-xs text-[#6b7280]">
                        {formatVnd(row.baseSalaryAmount)} · {formatNumber(row.staffHours)} giờ
                      </div>
                    </td>
                    <td className="px-4 py-5 text-center text-xs">
                      <div className="font-bold text-emerald-700">+ {formatVnd(row.bonus)}</div>
                      <div className="font-bold text-rose-700">- {formatVnd(row.penalty)}</div>
                    </td>
                    <td className="px-4 py-5 text-center">
                      {row.assistantHours > 0 && Object.keys(row.assistantBonusByBranch).length > 0 ? (
                        <div className="space-y-1">
                          {Object.entries(row.assistantBonusByBranch).map(([branchId, percent]) => (
                            <div key={branchId} className="text-xs font-semibold text-[#111827]">
                              {percent != null ? `${(percent * 100).toFixed(0)}%` : "Chưa nhập"}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-[#9ca3af]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-5 text-right">
                      <div className="text-lg font-black text-[#ea580c]">{formatVnd(row.totalAmount)}</div>
                      <div className="mt-1 text-xs text-[#6b7280]">{formatNumber(row.sessionCount)} buổi</div>
                    </td>
                    <td className="px-4 py-5">
                      <div className="space-y-1.5 text-xs">
                        {row.teachingHours > 0 ? (
                          <div className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 font-semibold text-blue-700">
                            Dạy: {row.teachingHourlyRate != null ? `${formatVnd(row.teachingHourlyRate)}/${row.payMode === "SESSION" ? "ca" : "giờ"}` : "Thiếu"}
                          </div>
                        ) : null}
                        {row.assistantHours > 0 ? (
                          <div className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 font-semibold text-violet-700">
                            TG: {row.assistantHourlyRate != null ? `${formatVnd(row.assistantHourlyRate)}/${row.payMode === "SESSION" ? "ca" : "giờ"}` : "Thiếu"}
                          </div>
                        ) : null}
                        {row.staffDays > 0 ? (
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-700">
                            HC: {row.staffDailyRate != null ? `${formatVnd(row.staffDailyRate)}/công` : "Thiếu"}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <div className="space-y-1 text-xs">
                        <div className="font-semibold text-[#111827]">{row.bankName ?? "Chưa có ngân hàng"}</div>
                        <div className="text-[#6b7280]">{row.bankAccountNumber ?? "Chưa có số tài khoản"}</div>
                        <div className="text-[#6b7280]">{row.bankAccountHolder ?? "Chưa có chủ tài khoản"}</div>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex flex-col items-start gap-1.5">
                        {row.hasRateIssue ? <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">Thiếu đơn giá</span> : null}
                        {!row.hasBankInfo ? <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Thiếu CK</span> : null}
                        {row.lineId && row.hasMismatch ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Lệch dữ liệu</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="max-w-[160px] px-4 py-5 text-xs text-[#6b7280]">
                      <p className="truncate" title={row.notes ?? ""}>
                        {row.notes || "—"}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <button
                        type="button"
                        onClick={() => openEmployee(row.id)}
                        className="inline-flex items-center justify-center rounded-xl bg-[#ea580c] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#c2410c]"
                      >
                        Sửa
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-16 text-center text-sm font-medium text-[#6b7280]">
                    Không có nhân sự nào khớp bộ lọc trong tháng {period}.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {filteredRows.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-[#f3f4f6] px-6 py-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-[#6b7280]">
              Trang {currentPage}/{totalPages} · Hiển thị {pagedRows.length} trên tổng {formatNumber(filteredRows.length)} nhân sự
            </p>
            <div className="pagination">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage <= 1}
                className="pagination-item disabled:pointer-events-none disabled:opacity-50"
              >
                Trước
              </button>
              <span className="pagination-item-active">{currentPage}</span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage >= totalPages}
                className="pagination-item disabled:pointer-events-none disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {selectedRow ? (
        <PayrollEmployeeDrawer
          open={drawerOpen}
          onClose={closeDrawer}
          headerSummary={{
            fullName: selectedRow.fullName,
            employeeCode: selectedRow.employeeCode,
            position: selectedRow.position,
            contractStatus: selectedRow.contractStatus,
            sourceLabel: selectedRow.lineId ? "Đã tính lương" : "Xem trước (chưa tính lương)",
          }}
          profile={{
            id: selectedRow.id,
            dob: selectedRow.dob ? new Date(selectedRow.dob).toISOString() : null,
            phone: selectedRow.phone,
            email: selectedRow.email,
            hometown: selectedRow.hometown,
            permanentAddress: selectedRow.permanentAddress,
            idNumber: selectedRow.idNumber,
            idIssueDate: selectedRow.idIssueDate ? new Date(selectedRow.idIssueDate).toISOString() : null,
            idIssuePlace: selectedRow.idIssuePlace,
            resignDate: selectedRow.resignDate ? new Date(selectedRow.resignDate).toISOString() : null,
            payMode: selectedRow.payMode,
            teachingHourlyRate: selectedRow.teachingHourlyRate,
            assistantHourlyRate: selectedRow.assistantHourlyRate,
            staffDailyRate: selectedRow.staffDailyRate,
            bankName: selectedRow.bankName,
            bankAccountNumber: selectedRow.bankAccountNumber,
            bankAccountHolder: selectedRow.bankAccountHolder,
          }}
          canEditProfile={permissions.canManageEmployees || permissions.canManagePayrollRuns}
          canAddTimesheet={permissions.canCreateTimesheet}
          payrollLine={selectedRow.lineId ? { id: selectedRow.lineId, bonus: selectedRow.bonus, penalty: selectedRow.penalty, notes: selectedRow.notes } : null}
          canEditPayrollLine={canEditPayrollLine}
          assistant={
            permissions.canManagePayrollRuns
              ? { employeeId: selectedRow.id, month: period, branches, bonusByBranch: selectedRow.assistantBonusByBranch }
              : null
          }
        />
      ) : null}
    </div>
  );
}
