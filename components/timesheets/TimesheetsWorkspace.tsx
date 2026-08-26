"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";
import DataTableResponsive from "@/components/ui/DataTable/DataTableResponsive";
import type { Column, Action } from "@/components/ui/DataTable/DataTable";
import TimesheetEntryForm from "@/components/timesheets/TimesheetEntryForm";

const DEFAULT_CHECKIN_TIMES = { checkInAm: "08:00", checkOutAm: "12:00", checkInPm: "13:30", checkOutPm: "17:30" };

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TIMESHEET_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="timesheet-header"]',
    title: "Chấm công dành cho công hành chính, không phải công dạy",
    description: "Giáo viên/trợ giảng lấy công dạy tự động theo phân công lớp — chỉ chấm công thêm ở đây nếu họ có làm việc hành chính ngoài giờ dạy.",
    placement: "bottom",
  },
  {
    target: '[data-tour="timesheet-table"]',
    title: "Bấm \"Xem thêm\" để mở form giờ của từng nhân viên",
    description: "Chỉ dòng đang mở mới hiện 4 ô giờ — có thể mở nhiều dòng cùng lúc nếu cần đối chiếu vài người liền nhau.",
    placement: "top",
  },
  {
    target: '[data-tour="timesheet-summary"]',
    title: "Cột \"Công tháng\" đã gộp cả công + giờ + lần chấm gần nhất",
    description: "Không cần dò thêm bảng nào khác — mỗi dòng nhân viên đã có đủ tổng công tháng theo đúng bộ lọc đang áp dụng.",
    placement: "top",
  },
];

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
  tableEmployees,
  monthLabel,
  defaultDate,
  canManageEmployees,
  canDeleteTimesheet,
  positionOptions,
  search,
  position,
}: {
  employees: EmployeeRow[];
  /** Nhân sự ACTIVE đã lọc theo `search`/`position` ở server (Prisma `where`) — dùng để
   * hiển thị bảng. `employees` (đầy đủ mọi workStatus, không lọc search/position) vẫn
   * giữ nguyên để tính KPI/tổng và danh sách vị trí cho ô lọc. */
  tableEmployees: EmployeeRow[];
  monthLabel: string;
  defaultDate: string;
  canManageEmployees: boolean;
  canDeleteTimesheet: boolean;
  positionOptions: string[];
  search: string;
  position: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const activeEmployees = useMemo(() => employees.filter((item) => item.workStatus === "ACTIVE"), [employees]);

  const entryOnSelectedDate = (employee: EmployeeRow) => employee.timesheetEntries.find((entry) => entry.workDate.slice(0, 10) === selectedDate) ?? null;

  const stats = useMemo(() => {
    const entriesToday = employees.filter((employee) => employee.timesheetEntries.some((entry) => entry.workDate.slice(0, 10) === selectedDate));
    const monthDays = employees.reduce((sum, employee) => sum + employee.timesheetEntries.reduce((entrySum, entry) => entrySum + (entry.days ?? 0), 0), 0);
    const monthHours = employees.reduce((sum, employee) => sum + employee.timesheetEntries.reduce((entrySum, entry) => entrySum + (entry.hours ?? 0), 0), 0);
    return {
      activeCount: activeEmployees.length,
      checkedTodayCount: entriesToday.length,
      monthDays: Math.round(monthDays * 100) / 100,
      monthHours: Math.round(monthHours * 100) / 100,
    };
  }, [activeEmployees.length, employees, selectedDate]);

  const totalPages = Math.max(1, Math.ceil(tableEmployees.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedEmployees = tableEmployees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [tableEmployees, selectedDate]);

  function loadDate(date: string) {
    setSelectedDate(date);
    setNotice(null);
  }

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams?.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    router.push(`/timesheets?${params.toString()}`);
  }

  const handleSearch = (value: string) => updateParams({ search: value || null });
  const handleFilterChange = (key: string, value: string | null, extra?: Record<string, string | null>) =>
    updateParams({ [key]: value, ...extra });

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
    {
      key: "position",
      label: "Vị trí",
      filter: {
        type: "select",
        paramKey: "position",
        placeholder: "Tất cả vị trí",
        options: positionOptions.map((value) => ({ label: value, value })),
      },
      render: (value) => value ?? "—",
    },
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
        const latest = row.timesheetEntries[0] ?? null;
        return (
          <div>
            <p className="font-semibold text-ink">
              {Math.round(monthDays * 100) / 100} công · {Math.round(monthHours * 100) / 100} giờ
            </p>
            <p className="mt-0.5 text-xs text-ink-muted48">
              {latest ? `Gần nhất: ${formatVnDate(latest.workDate)} · ${latest.hours ?? 0}h` : "Chưa có chấm công tháng này"}
            </p>
          </div>
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
    <div className="space-y-6">
      <div className="card space-y-5" data-tour="timesheet-header">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Chấm công ngày</h1>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 font-medium text-sky-700">Tháng {monthLabel}</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700">Đang làm {stats.activeCount}</span>
              <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 font-medium text-violet-700">Đã chấm hôm nay {stats.checkedTodayCount}</span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-medium text-amber-700">Công tháng {stats.monthDays}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SpotlightTour steps={TIMESHEET_TOUR_STEPS} />
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
      </div>

      <div className="card space-y-4" data-tour="timesheet-summary">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">Danh sách chấm công</h2>
            <p className="mt-1 text-sm text-ink-muted48">
              Ngày {formatVnDate(selectedDate)} · {tableEmployees.length} nhân viên đang hiển thị · cột &quot;Công tháng&quot; đã gồm cả công/giờ/lần chấm gần nhất
            </p>
          </div>
        </div>

        {notice ? <div className="alert-success">{notice}</div> : null}

        <div data-tour="timesheet-table">
          <DataTableResponsive
            data={pagedEmployees}
            columns={columns}
            actions={actions}
            rowKey="id"
            searchable
            searchPlaceholder="Tìm theo tên hoặc mã nhân viên..."
            onSearch={handleSearch}
            defaultSearchValue={search}
            filterValues={{ position }}
            onFilterChange={handleFilterChange}
            selectable={false}
            showCountBadge={false}
            primaryColumn="fullName"
            secondaryColumns={["position", "id", "timesheetEntries"]}
            emptyState={{ title: "Không có nhân viên nào", description: "Không có nhân viên nào khớp bộ lọc hiện tại." }}
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
              total: tableEmployees.length,
              page: currentPage,
              pageSize: PAGE_SIZE,
              onPageChange: (nextPage) => setPage(nextPage),
              onPageSizeChange: () => {},
            }}
          />
        </div>
      </div>
    </div>
  );
}
