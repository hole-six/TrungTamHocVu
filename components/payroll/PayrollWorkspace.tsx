"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import NewEmployeeForm from "@/components/payroll/NewEmployeeForm";
import NewPayrollRunForm from "@/components/payroll/NewPayrollRunForm";
import PayrollExportButton from "@/components/payroll/PayrollExportButton";
import PayrollRateCsvTools from "@/components/payroll/PayrollRateCsvTools";
import PayrollEmployeeDrawer from "@/components/payroll/PayrollEmployeeDrawer";
import PayrollMonthDrawer from "@/components/payroll/PayrollMonthDrawer";
import DataTableResponsive from "@/components/ui/DataTable/DataTableResponsive";
import type { Column, Action } from "@/components/ui/DataTable/DataTable";
import { ACTION_CLASS } from "@/components/ui/DetailDrawerParts";
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
  const [monthDrawerOpen, setMonthDrawerOpen] = useState(false);

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

  // Giữ nguyên đủ các trường — PayrollExportButton dùng cả tiền dạy/TG/công hành chính
  // để ghi dòng tổng hợp trong file xuất, không chỉ vài số hiển thị trên đầu trang.
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
      },
    );
  }, [rows]);

  const needsAttentionCount = totals.missingRateCount + totals.missingBankCount;
  const selectedRow = selectedEmployeeId ? rows.find((row) => row.id === selectedEmployeeId) ?? null : null;
  const canEditPayrollLine = Boolean(run && permissions.canManagePayrollRuns && ["DRAFT", "CALCULATED", "REVIEWED", "REOPENED"].includes(run.status));

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
        <div>
          <button type="button" onClick={() => openEmployee(row.id)} className="text-left font-semibold text-[#0f1729] hover:underline">
            {row.fullName}
          </button>
          <p className="mt-0.5 text-xs text-[#94a3b8]">
            {row.employeeCode}
            {row.position ? ` · ${row.position}` : ""}
            {row.workStatus !== "ACTIVE" ? " · Đã nghỉ" : ""}
          </p>
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
          <p className="text-sm text-[#475569]">{parts.join(" · ")}</p>
        ) : (
          <span className="text-sm text-[#94a3b8]">Chưa có công</span>
        );
      },
    },
    {
      key: "bonus",
      label: "Cộng / Trừ khác",
      align: "center",
      filter: { type: "numberRange", paramKeyFrom: "bonusFrom", paramKeyTo: "bonusTo", placeholder: "đ thưởng" },
      render: (_value, row) => {
        const totalAdd =
          row.otAmount + row.kpiBonus + row.assistantRatingBonus + row.parkingAllowance + row.supportAllowance + row.bonus + row.holidayBonus;
        const totalDeduct = row.socialInsuranceDeduction + row.utilityDeduction + row.otherDeduction + row.penalty;
        return totalAdd > 0 || totalDeduct > 0 ? (
          <div className="text-xs">
            {totalAdd > 0 ? <div className="font-bold text-emerald-700">+ {formatVnd(totalAdd)}</div> : null}
            {totalDeduct > 0 ? <div className="font-bold text-rose-700">- {formatVnd(totalDeduct)}</div> : null}
          </div>
        ) : (
          <span className="text-xs text-[#94a3b8]">—</span>
        );
      },
    },
    {
      key: "totalAmount",
      label: "Tổng lương",
      align: "right",
      filter: { type: "numberRange", paramKeyFrom: "totalAmountFrom", paramKeyTo: "totalAmountTo", placeholder: "đ" },
      render: (_value, row) => (
        <div>
          <div className="text-base font-black text-[#0f1729]">{formatVnd(row.totalAmount)}</div>
          <div className="mt-0.5 text-xs text-[#94a3b8]">{row.lineId ? "Đã tính lương" : "Xem trước"}</div>
        </div>
      ),
    },
    {
      key: "hasRateIssue",
      label: "Cần xử lý",
      filter: {
        type: "select",
        paramKey: "hasRateIssue",
        placeholder: "Tất cả",
        options: [
          { label: "Thiếu đơn giá/thông tin", value: "YES" },
          { label: "Đủ dữ liệu", value: "NO" },
        ],
      },
      render: (_value, row) => (
        <div className="flex flex-col items-start gap-1">
          {row.hasRateIssue ? <span className="text-xs font-bold text-rose-700">Thiếu đơn giá</span> : null}
          {!row.hasBankInfo ? <span className="text-xs font-bold text-amber-700">Thiếu CK</span> : null}
          {row.lineId && row.hasMismatch ? <span className="text-xs font-bold text-amber-700">Lệch dữ liệu</span> : null}
          {!row.hasRateIssue && row.hasBankInfo && !(row.lineId && row.hasMismatch) ? <span className="text-xs text-[#94a3b8]">—</span> : null}
        </div>
      ),
    },
  ];

  const actions: Action<PayrollEmployeeRow>[] = [{ label: "Mở", onClick: (row) => openEmployee(row.id) }];

  const filterChips: { key: FilterMode; label: string; count: number }[] = [
    { key: "all", label: "Tất cả", count: rows.length },
    { key: "missing-rate", label: "Thiếu đơn giá", count: totals.missingRateCount },
    { key: "missing-bank", label: "Thiếu chuyển khoản", count: totals.missingBankCount },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-black tracking-tight text-[#0f1729] sm:text-2xl">Lương</h1>
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
          {run && permissions.canManagePayrollRuns ? (
            <button type="button" onClick={() => setMonthDrawerOpen(true)} className={ACTION_CLASS}>
              Xử lý lương tháng
            </button>
          ) : null}
          {!run && permissions.canManagePayrollRuns ? <NewPayrollRunForm defaultPeriod={period} /> : null}
          <PayrollExportButton period={period} rows={rows} runStatus={run?.status ?? null} totals={totals} />
          {/* In 1 phát ra PDF: bảng công + lương, thấy rõ tiền của TỪNG loại công
              (giờ dạy / giờ trợ giảng / ngày công hành chính) chứ không chỉ tổng. */}
          {run ? (
            <Link href={`/payroll/print?period=${period}`} target="_blank" className={ACTION_CLASS}>
              In bảng công &amp; lương (PDF)
            </Link>
          ) : null}
          {permissions.canManageEmployees ? <NewEmployeeForm /> : null}
          {permissions.canManageEmployees ? <PayrollRateCsvTools items={rows} /> : null}
        </div>
      </div>

      {/* Số liệu tháng — 1 khung duy nhất chia cột, thay cho 3 ô thống kê riêng lẻ trước đây */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-[#e5eaf7] bg-white px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Tổng lương tháng {period}</p>
          <p className="mt-0.5 text-2xl font-black text-[#0f1729]">{formatVnd(totals.totalPayroll)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Công đã ghi nhận</p>
          <p className="mt-0.5 text-2xl font-black text-[#0f1729]">{formatNumber(totals.sessionCount)} buổi</p>
          <p className="text-xs text-[#94a3b8]">{formatNumber(totals.totalStaffDays)} công hành chính</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Cần xử lý</p>
          <p className={`mt-0.5 text-2xl font-black ${needsAttentionCount > 0 ? "text-amber-700" : "text-[#0f1729]"}`}>
            {needsAttentionCount > 0 ? `${formatNumber(needsAttentionCount)} nhân sự` : "Không có"}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Trạng thái</p>
          <p className="mt-0.5 text-2xl font-black text-[#0f1729]">
            {run ? PAYROLL_RUN_STATUS_LABEL[run.status] ?? run.status : "Chưa chốt"}
          </p>
          <p className="text-xs text-[#94a3b8]">
            {run ? `${formatNumber(run.lineCount)} người đã có dòng lương` : "Bảng dưới đang là số xem trước"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filterChips.map((chip) => (
          <Link
            key={chip.key}
            href={pageHref({ filter: chip.key })}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
              initialFilter === chip.key
                ? "bg-[#0f1729] text-white"
                : "border border-[#e2e8f0] bg-white text-[#475569] hover:border-[#94a3b8]"
            }`}
          >
            {chip.label} ({formatNumber(chip.count)})
          </Link>
        ))}
      </div>

      <DataTableResponsive
        data={pagedRows}
        columns={columns}
        actions={actions}
        rowKey="id"
        searchable
        searchPlaceholder="Tìm theo mã, tên..."
        onSearch={handleSearch}
        defaultSearchValue={search}
        filterValues={{
          position,
          bonusFrom: searchParams.get("bonusFrom") ?? "",
          bonusTo: searchParams.get("bonusTo") ?? "",
          totalAmountFrom: searchParams.get("totalAmountFrom") ?? "",
          totalAmountTo: searchParams.get("totalAmountTo") ?? "",
          hasRateIssue: searchParams.get("hasRateIssue") ?? "",
        }}
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

      {run && permissions.canManagePayrollRuns ? (
        <PayrollMonthDrawer
          open={monthDrawerOpen}
          onClose={() => setMonthDrawerOpen(false)}
          period={period}
          runId={run.id}
          status={run.status}
          lineCount={run.lineCount}
          checklist={checklist}
          eligibleEmployees={eligibleEmployees}
        />
      ) : null}

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
            totalAmount: selectedRow.totalAmount,
            month: period,
            workSummary:
              [
                selectedRow.teachingHours > 0 ? `Dạy ${formatNumber(selectedRow.teachingHours)}h` : null,
                selectedRow.assistantHours > 0 ? `TG ${formatNumber(selectedRow.assistantHours)}h` : null,
                selectedRow.staffDays > 0 ? `HC ${formatNumber(selectedRow.staffDays)} công` : null,
              ]
                .filter(Boolean)
                .join(" · ") || null,
          }}
          profile={{
            id: selectedRow.id,
            employeeCode: selectedRow.employeeCode,
            fullName: selectedRow.fullName,
            position: selectedRow.position,
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
          payrollLine={
            selectedRow.lineId
              ? {
                  id: selectedRow.lineId,
                  otHours: selectedRow.otHours,
                  otAmount: selectedRow.otAmount,
                  kpiBonus: selectedRow.kpiBonus,
                  assistantRatingBonus: selectedRow.assistantRatingBonus,
                  parkingAllowance: selectedRow.parkingAllowance,
                  supportAllowance: selectedRow.supportAllowance,
                  bonus: selectedRow.bonus,
                  penalty: selectedRow.penalty,
                  socialInsuranceDeduction: selectedRow.socialInsuranceDeduction,
                  utilityDeduction: selectedRow.utilityDeduction,
                  holidayBonus: selectedRow.holidayBonus,
                  otherDeduction: selectedRow.otherDeduction,
                  notes: selectedRow.notes,
                }
              : null
          }
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
