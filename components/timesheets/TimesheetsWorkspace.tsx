"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";
import DataTableResponsive from "@/components/ui/DataTable/DataTableResponsive";
import type { Column } from "@/components/ui/DataTable/DataTable";
import TimesheetEntryForm from "@/components/timesheets/TimesheetEntryForm";

const TIMESHEET_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="timesheet-header"]',
    title: "Chấm công dành cho công hành chính, không phải công dạy",
    description: "Giáo viên/trợ giảng lấy công dạy tự động theo phân công lớp — chỉ chấm công thêm ở đây nếu họ có làm việc hành chính ngoài giờ dạy.",
    placement: "bottom",
  },
  {
    target: '[data-tour="timesheet-filters"]',
    title: "Đổi ngày trước, tìm/lọc sau",
    description: "Bảng luôn hiển thị trạng thái chấm công của ĐÚNG ngày đang chọn ở góc trên — mọi dòng đang mở sẵn sẽ tự cập nhật theo ngày mới.",
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
    title: "Tổng hợp công tháng theo bộ lọc đang áp dụng",
    description: "Danh sách bên phải đồng bộ với ô tìm kiếm/lọc vị trí bên trái — lọc để xem tổng công tháng của đúng nhóm cần đối chiếu.",
    placement: "left",
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
  monthLabel,
  defaultDate,
  canManageEmployees,
  canDeleteTimesheet,
}: {
  employees: EmployeeRow[];
  monthLabel: string;
  defaultDate: string;
  canManageEmployees: boolean;
  canDeleteTimesheet: boolean;
}) {
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [notice, setNotice] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const activeEmployees = useMemo(() => employees.filter((item) => item.workStatus === "ACTIVE"), [employees]);

  const positionOptions = useMemo(() => {
    const set = new Set<string>();
    activeEmployees.forEach((employee) => set.add(employee.position?.trim() || "Chưa khai báo"));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [activeEmployees]);

  const entryOnSelectedDate = (employee: EmployeeRow) => employee.timesheetEntries.find((entry) => entry.workDate.slice(0, 10) === selectedDate) ?? null;

  const filteredEmployees = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return activeEmployees.filter((employee) => {
      const positionLabel = employee.position?.trim() || "Chưa khai báo";
      if (positionFilter !== "ALL" && positionLabel !== positionFilter) return false;
      if (!kw) return true;
      return employee.fullName.toLowerCase().includes(kw) || employee.employeeCode.toLowerCase().includes(kw);
    });
  }, [activeEmployees, keyword, positionFilter]);

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

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedEmployees = filteredEmployees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [keyword, positionFilter, selectedDate]);

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
        return `${Math.round(monthDays * 100) / 100} công`;
      },
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <div className="card space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">Danh sách chấm công</h2>
              <p className="mt-1 text-sm text-ink-muted48">Ngày {formatVnDate(selectedDate)} · {filteredEmployees.length} nhân viên đang hiển thị</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center" data-tour="timesheet-filters">
            <input
              className="input flex-1"
              placeholder="Tìm theo tên hoặc mã nhân viên..."
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <select className="input sm:w-56" value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)}>
              <option value="ALL">Tất cả vị trí</option>
              {positionOptions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </div>

          {notice ? <div className="alert-success">{notice}</div> : null}

          <div data-tour="timesheet-table">
            <DataTableResponsive
              data={pagedEmployees}
              columns={columns}
              rowKey="id"
              searchable={false}
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
                total: filteredEmployees.length,
                page: currentPage,
                pageSize: PAGE_SIZE,
                onPageChange: (nextPage) => setPage(nextPage),
                onPageSizeChange: () => {},
              }}
            />
          </div>
        </div>

        <div className="space-y-6" data-tour="timesheet-summary">
          <div className="card">
            <h2 className="font-display text-base font-bold tracking-tight text-ink">Tổng hợp tháng</h2>
            <p className="mt-1 text-xs text-ink-muted48">{stats.monthHours} giờ chấm công trong tháng, toàn bộ nhân viên</p>
            <div className="mt-3 space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredEmployees.map((employee) => {
                const monthDays = employee.timesheetEntries.reduce((sum, entry) => sum + (entry.days ?? 0), 0);
                const monthHours = employee.timesheetEntries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0);
                const latest = employee.timesheetEntries[0] ?? null;
                return (
                  <div key={employee.id} className="rounded-2xl border border-hairline bg-canvas-parchment/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{employee.fullName}</p>
                        <p className="mt-1 text-xs text-ink-muted48">{employee.employeeCode} · {employee.position ?? "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-ink">{Math.round(monthDays * 100) / 100} công</p>
                        <p className="mt-1 text-xs text-ink-muted48">{monthHours.toFixed(2)} giờ</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-ink-muted48">
                      {latest ? `Gần nhất: ${formatVnDate(latest.workDate)} · ${latest.hours ?? 0} giờ` : "Chưa có chấm công tháng này"}
                    </p>
                  </div>
                );
              })}
              {filteredEmployees.length === 0 ? <p className="text-sm text-ink-muted48">Không có nhân viên nào khớp bộ lọc.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
