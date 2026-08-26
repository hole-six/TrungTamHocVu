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
import DataTableResponsive from "@/components/ui/DataTable/DataTableResponsive";
import type { Column, Action } from "@/components/ui/DataTable/DataTable";
import { PAYROLL_RUN_STATUS_LABEL } from "@/lib/server/payroll-rules";
import type { PayrollEmployeeRow } from "@/lib/server/payroll-row-builder";
import { formatVnd } from "@/lib/export-utils";

type FilterMode = "all" | "missing-bank" | "ready-bank" | "missing-rate";

const PAGE_SIZE = 15;

type RunSummary = { id: string; periodName: string; status: string; lineCount: number } | null;

type Checklist = { items: { key: string; label: string; done: boolean; help: string }[]; isReady: boolean } | null;

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
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
  tableRows,
  period,
  run,
  branches,
  eligibleEmployees,
  checklist,
  initialEmployeeId,
  initialFilter,
  permissions,
  positionOptions,
  search,
  position,
}: {
  rows: PayrollEmployeeRow[];
  /** Danh sách nhân sự đã lọc theo `search`/`position` ở server (Prisma `where`) — dùng để
   * hiển thị bảng. `rows` (đầy đủ, không lọc search/position) vẫn giữ nguyên để tính
   * totals/badge/eligibleEmployees cho đúng toàn chi nhánh, không co lại theo ô tìm kiếm. */
  tableRows: PayrollEmployeeRow[];
  period: string;
  run: RunSummary;
  branches: { id: string; name: string }[];
  eligibleEmployees: { id: string; fullName: string }[];
  checklist: Checklist;
  initialEmployeeId: string | null;
  initialFilter: FilterMode;
  permissions: { canManageEmployees: boolean; canManagePayrollRuns: boolean; canCreateTimesheet: boolean };
  positionOptions: string[];
  search: string;
  position: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(initialEmployeeId);
  const [drawerOpen, setDrawerOpen] = useState(Boolean(initialEmployeeId));
  const [showRunPanel, setShowRunPanel] = useState(false);

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

  // `search`/`position` đã được lọc ở server (Prisma `where` trong buildPayrollEmployeeRows)
  // — chỉ còn chip trạng thái (`initialFilter`) là lọc thêm ở client, giữ nguyên hành vi cũ.
  const chipFilteredRows = useMemo(() => {
    return tableRows.filter((row) => {
      if (initialFilter === "missing-bank" && row.hasBankInfo) return false;
      if (initialFilter === "ready-bank" && !row.hasBankInfo) return false;
      if (initialFilter === "missing-rate" && !row.hasRateIssue) return false;
      return true;
    });
  }, [tableRows, initialFilter]);

  const totalPages = Math.max(1, Math.ceil(chipFilteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = chipFilteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function updateParams(patch: Record<string, string | null>) {
    router.push(pageHref(patch));
  }

  const handleSearch = (value: string) => updateParams({ search: value || null });
  const handleFilterChange = (key: string, value: string | null, extra?: Record<string, string | null>) =>
    updateParams({ [key]: value, ...extra });

  useEffect(() => {
    setPage(1);
  }, [period, initialFilter, tableRows]);

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

  const needsAttentionCount = totals.missingRateCount + totals.missingBankCount;
  const selectedRow = selectedEmployeeId ? rows.find((row) => row.id === selectedEmployeeId) ?? null : null;
  const canEditPayrollLine = Boolean(run && permissions.canManagePayrollRuns && ["DRAFT", "CALCULATED", "REVIEWED"].includes(run.status));

  const columns: Column<PayrollEmployeeRow>[] = [
    {
      key: "fullName",
      label: "Nhân sự",
      filter: {
        type: "select",
        paramKey: "position",
        placeholder: "Tất cả vai trò",
        options: positionOptions.map((value) => ({ label: value, value })),
      },
      render: (_value, row) => (
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
              {row.workStatus !== "ACTIVE" ? " · Đã nghỉ" : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "teachingHours",
      label: "Công trong tháng",
      render: (_value, row) => {
        const parts = [
          row.teachingHours > 0 ? `Dạy ${formatNumber(row.teachingHours)}` : null,
          row.assistantHours > 0 ? `TG ${formatNumber(row.assistantHours)}` : null,
          row.staffDays > 0 ? `HC ${formatNumber(row.staffDays)} công` : null,
        ].filter(Boolean);
        return parts.length > 0 ? (
          <p className="text-sm text-[#374151]">{parts.join(" · ")}</p>
        ) : (
          <span className="text-xs text-[#9ca3af]">Chưa có công</span>
        );
      },
    },
    {
      key: "bonus",
      label: "Thưởng / Phạt",
      align: "center",
      render: (_value, row) =>
        row.bonus > 0 || row.penalty > 0 ? (
          <div className="text-xs">
            {row.bonus > 0 ? <div className="font-bold text-emerald-700">+ {formatVnd(row.bonus)}</div> : null}
            {row.penalty > 0 ? <div className="font-bold text-rose-700">- {formatVnd(row.penalty)}</div> : null}
          </div>
        ) : (
          <span className="text-xs text-[#9ca3af]">—</span>
        ),
    },
    {
      key: "totalAmount",
      label: "Tổng lương",
      align: "right",
      render: (_value, row) => (
        <div>
          <div className="text-lg font-black text-[#ea580c]">{formatVnd(row.totalAmount)}</div>
          <div className="mt-1 text-xs text-[#6b7280]">{row.lineId ? "Đã tính lương" : "Xem trước"}</div>
        </div>
      ),
    },
    {
      key: "hasRateIssue",
      label: "Cần xử lý",
      render: (_value, row) => (
        <div className="flex flex-col items-start gap-1.5">
          {row.hasRateIssue ? <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">Thiếu đơn giá</span> : null}
          {!row.hasBankInfo ? <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Thiếu CK</span> : null}
          {row.lineId && row.hasMismatch ? <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Lệch dữ liệu</span> : null}
          {!row.hasRateIssue && row.hasBankInfo && !(row.lineId && row.hasMismatch) ? <span className="text-xs text-[#9ca3af]">—</span> : null}
        </div>
      ),
    },
  ];

  const actions: Action<PayrollEmployeeRow>[] = [
    { label: "Sửa", onClick: (row) => openEmployee(row.id), variant: "primary" },
  ];

  return (
    <div className="min-h-screen space-y-4 pb-20 sm:space-y-5">
      <section className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-4 shadow-sm sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-black tracking-tight text-[#111827] sm:text-2xl">Lương & nhân sự</h1>
            <input
              type="month"
              className="input w-auto text-sm"
              value={period}
              onChange={(event) => {
                if (event.target.value) router.push(pageHref({ period: event.target.value, employeeId: null }));
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!run && permissions.canManagePayrollRuns ? <NewPayrollRunForm defaultPeriod={period} /> : null}
            <PayrollExportButton period={period} rows={rows} runStatus={run?.status ?? null} totals={totals} />
            {permissions.canManageEmployees ? <NewEmployeeForm /> : null}
            {permissions.canManageEmployees ? <PayrollRateCsvTools items={rows} /> : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="rounded-xl border border-[#e5e7eb] bg-[#fbfbfc] px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9ca3af]">Tổng payroll tháng này</p>
            <p className="mt-1 text-2xl font-black text-[#111827]">{formatVnd(totals.totalPayroll)}</p>
          </div>
          <div className="rounded-xl border border-[#e5e7eb] bg-[#fbfbfc] px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9ca3af]">Công đã ghi nhận</p>
            <p className="mt-1 text-2xl font-black text-[#111827]">{formatNumber(totals.sessionCount)} buổi</p>
            <p className="mt-0.5 text-xs text-[#6b7280]">{formatNumber(totals.totalStaffDays)} công hành chính</p>
          </div>
          <div className={`rounded-xl border px-4 py-3 ${needsAttentionCount > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9ca3af]">Cần xử lý</p>
            <p className={`mt-1 text-2xl font-black ${needsAttentionCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
              {needsAttentionCount > 0 ? `${formatNumber(needsAttentionCount)} nhân sự` : "Không có"}
            </p>
          </div>
        </div>
      </section>

      {run ? (
        <section className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-4 shadow-sm sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#9ca3af]">Kỳ lương {run.periodName}</span>
              <span className={`rounded-full border px-3 py-1 text-sm font-bold ${getRunTone(run.status)}`}>
                {PAYROLL_RUN_STATUS_LABEL[run.status] ?? run.status}
              </span>
              <span className="rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 py-1 text-sm font-bold text-[#c2410c]">
                {formatNumber(run.lineCount)} người đã có dòng lương
              </span>
              {checklist ? (
                <span
                  className={`rounded-full border px-3 py-1 text-sm font-bold ${
                    checklist.isReady ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  Checklist: {checklist.isReady ? "Đạt" : "Chưa đạt"}
                </span>
              ) : null}
            </div>
            {permissions.canManagePayrollRuns ? (
              <button type="button" onClick={() => setShowRunPanel((current) => !current)} className="btn-ghost-sm">
                {showRunPanel ? "Thu gọn" : "Xử lý kỳ lương"}
              </button>
            ) : null}
          </div>

          {permissions.canManagePayrollRuns && showRunPanel ? (
            <div className="mt-4 grid grid-cols-1 gap-5 border-t border-[#f3f4f6] pt-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <PayrollRunActions runId={run.id} status={run.status} checklistReady={checklist?.isReady ?? true} />
              <div className="space-y-4">
                {checklist ? (
                  <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-4">
                    <h3 className="text-sm font-black text-[#111827]">Checklist chốt kỳ</h3>
                    <div className="mt-3 space-y-2 text-sm">
                      {checklist.items.map((item) => (
                        <div key={item.key} className={`rounded-xl border px-3 py-2.5 ${item.done ? "border-emerald-100 bg-emerald-50/60" : "border-amber-200 bg-amber-50"}`}>
                          <p className={`font-bold ${item.done ? "text-emerald-700" : "text-amber-800"}`}>
                            {item.done ? "✓" : "•"} {item.label}
                          </p>
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
        <section className="rounded-2xl border border-dashed border-[#e5e7eb] bg-white px-6 py-5 text-center text-sm text-[#6b7280] shadow-sm">
          Tháng {period} chưa có kỳ lương chính thức — bảng dưới đây đang là số xem trước. Bấm &quot;Tạo kỳ lương&quot; ở trên để chốt số liệu.
        </section>
      )}

      <section className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={pageHref({ filter: "all" })}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${initialFilter === "all" ? "border-[#fed7aa] bg-[#fff7ed] text-[#ea580c]" : "border-[#e5e7eb] bg-white text-[#6b7280]"}`}
          >
            Tất cả ({formatNumber(rows.length)})
          </Link>
          <Link
            href={pageHref({ filter: "missing-rate" })}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${initialFilter === "missing-rate" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-[#e5e7eb] bg-white text-[#6b7280]"}`}
          >
            Thiếu đơn giá ({formatNumber(totals.missingRateCount)})
          </Link>
          <Link
            href={pageHref({ filter: "missing-bank" })}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${initialFilter === "missing-bank" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-[#e5e7eb] bg-white text-[#6b7280]"}`}
          >
            Thiếu chuyển khoản ({formatNumber(totals.missingBankCount)})
          </Link>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
        <DataTableResponsive
          data={pagedRows}
          columns={columns}
          actions={actions}
          rowKey="id"
          searchable
          searchPlaceholder="Tìm theo mã, tên..."
          onSearch={handleSearch}
          defaultSearchValue={search}
          filterValues={{ position }}
          onFilterChange={handleFilterChange}
          selectable={false}
          showCountBadge={false}
          primaryColumn="fullName"
          secondaryColumns={["totalAmount", "hasRateIssue"]}
          emptyState={{ title: "Không có nhân sự nào", description: `Không có nhân sự nào khớp bộ lọc trong tháng ${period}.` }}
          pagination={{
            total: chipFilteredRows.length,
            page: currentPage,
            pageSize: PAGE_SIZE,
            onPageChange: (nextPage) => setPage(nextPage),
            onPageSizeChange: () => {},
          }}
        />
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
