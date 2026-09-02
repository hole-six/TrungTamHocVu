"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import DataTableResponsive from "@/components/ui/DataTable/DataTableResponsive";
import type { Column, Action } from "@/components/ui/DataTable/DataTable";
import TimesheetEntryForm from "@/components/timesheets/TimesheetEntryForm";

const DEFAULT_CHECKIN_TIMES = { checkInAm: "08:00", checkOutAm: "12:00", checkInPm: "13:30", checkOutPm: "17:30" };

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Entry = {
  id: string;
  workDate: string;
  checkInAm: string | null;
  checkOutAm: string | null;
  checkInPm: string | null;
  checkOutPm: string | null;
  hours: number | null;
  days: number | null;
  notes: string | null;
};

type EmployeeRow = {
  id: string;
  fullName: string;
  employeeCode: string;
  position: string | null;
  workStatus: string;
  timesheetEntries: Entry[];
};

const PAGE_SIZE = 15;

function formatVnDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function TimesheetsWorkspace({
  employees,
  defaultDate,
  canManageEmployees,
  canDeleteTimesheet,
}: {
  employees: EmployeeRow[];
  defaultDate: string;
  canManageEmployees: boolean;
  canDeleteTimesheet: boolean;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const today = todayYmd();

  async function quickCheckInToday(employee: EmployeeRow) {
    setNotice(null);
    const response = await fetch("/api/timesheet-entries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: employee.id, workDate: today, ...DEFAULT_CHECKIN_TIMES, notes: "" }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(result.error ?? "Không thể chấm công hôm nay.");
      return;
    }
    setNotice(`Đã chấm công hôm nay cho ${employee.fullName}.`);
    router.refresh();
  }

  const entryOnSelectedDate = (employee: EmployeeRow) => employee.timesheetEntries.find((entry) => entry.workDate.slice(0, 10) === selectedDate) ?? null;

  const totalPages = Math.max(1, Math.ceil(employees.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedEmployees = employees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function loadDate(date: string) {
    setSelectedDate(date);
    setNotice(null);
  }

  const columns: Column<EmployeeRow>[] = [
    {
      key: "fullName",
      label: "Nhân viên",
      render: (value, row) => (
        <div>
          <p className="font-medium text-ink">{value}</p>
          <p className="mt-0.5 text-xs text-ink-muted48">{row.employeeCode}</p>
        </div>
      ),
    },
    { key: "position", label: "Vị trí", render: (value) => value ?? "—" },
    {
      key: "id",
      label: `Ngày ${formatVnDate(selectedDate)}`,
      render: (_value, row) => {
        const existing = entryOnSelectedDate(row);
        return existing ? (
          <span className="badge bg-emerald-100 text-emerald-700">Đã chấm · {existing.hours?.toFixed(2) ?? 0}h</span>
        ) : (
          <span className="badge bg-ink/5 text-ink-muted64">Chưa chấm</span>
        );
      },
    },
    {
      key: "timesheetEntries",
      label: "Công tháng",
      render: (_value, row) => {
        const monthDays = row.timesheetEntries.reduce((sum, entry) => sum + (entry.days ?? 0), 0);
        const monthHours = row.timesheetEntries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0);
        return (
          <p className="font-semibold text-ink">
            {Math.round(monthDays * 100) / 100} công · {Math.round(monthHours * 100) / 100} giờ
          </p>
        );
      },
    },
  ];

  const actions: Action<EmployeeRow>[] = [
    {
      label: "Chấm công hôm nay",
      variant: "primary",
      show: (row) => !row.timesheetEntries.some((entry) => entry.workDate.slice(0, 10) === today),
      onClick: (row) => quickCheckInToday(row),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Chấm công ngày</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="space-y-2">
            <span className="label">Ngày chấm công</span>
            <input type="date" className="input min-w-[220px]" value={selectedDate} onChange={(event) => loadDate(event.target.value)} />
          </label>
          {canManageEmployees ? (
            <Link href="/payroll" className="btn-ghost">
              Nhân sự
            </Link>
          ) : null}
        </div>
      </div>

      {notice ? <div className="alert-success">{notice}</div> : null}

      <DataTableResponsive
        data={pagedEmployees}
        columns={columns}
        actions={actions}
        rowKey="id"
        searchable={false}
        selectable={false}
        showCountBadge={false}
        primaryColumn="fullName"
        secondaryColumns={["position", "id", "timesheetEntries"]}
        emptyState={{ title: "Không có nhân viên nào", description: "Chưa có nhân sự đang làm việc." }}
        renderExpanded={(employee) => (
          <TimesheetEntryForm
            employeeId={employee.id}
            employeeName={employee.fullName}
            selectedDate={selectedDate}
            selectedDateLabel={formatVnDate(selectedDate)}
            existing={entryOnSelectedDate(employee)}
            canDeleteTimesheet={canDeleteTimesheet}
            onSaved={() => setNotice("Đã lưu chấm công.")}
          />
        )}
        pagination={{
          total: employees.length,
          page: currentPage,
          pageSize: PAGE_SIZE,
          onPageChange: (nextPage) => setPage(nextPage),
          onPageSizeChange: () => {},
        }}
      />
    </div>
  );
}
