"use client";

import Link from "next/link";
import { useState } from "react";
import DataTableResponsive from "@/components/ui/DataTable/DataTableResponsive";
import type { Column } from "@/components/ui/DataTable/DataTable";
import TimesheetEntryForm from "@/components/timesheets/TimesheetEntryForm";

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

type SessionAssignmentRow = {
  id: string;
  workDate: string;
  role: string;
  classCode: string;
  className: string;
  hours: number | null;
  deductedHours: number;
  addedHours: number;
};

type EmployeeRow = {
  id: string;
  fullName: string;
  employeeCode: string;
  position: string | null;
  workStatus: string;
  timesheetEntries: Entry[];
  sessionAssignments: SessionAssignmentRow[];
};

const ROLE_LABEL: Record<string, string> = { TEACHER: "GV", ASSISTANT: "TG", ASSISTANT2: "TG2" };

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
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);

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
        rowKey="id"
        searchable={false}
        selectable={false}
        showCountBadge={false}
        primaryColumn="fullName"
        secondaryColumns={["position", "id", "timesheetEntries"]}
        emptyState={{ title: "Không có nhân viên nào", description: "Chưa có nhân sự đang làm việc." }}
        renderExpanded={(employee) => {
          const dayAssignments = employee.sessionAssignments.filter((item) => item.workDate.slice(0, 10) === selectedDate);
          return (
            <div className="space-y-4">
              <TimesheetEntryForm
                employeeId={employee.id}
                employeeName={employee.fullName}
                selectedDate={selectedDate}
                selectedDateLabel={formatVnDate(selectedDate)}
                existing={entryOnSelectedDate(employee)}
                canDeleteTimesheet={canDeleteTimesheet}
                onSaved={() => setNotice("Đã lưu chấm công.")}
              />
              {/* Buổi dạy trong ngày — gộp hiển thị cùng chấm công hành chính, đúng cấu
                  trúc sheet chấm công thật của khách (1 dòng/ngày có cả lớp/GV-TG/đi
                  muộn/thêm giờ), không đổi cách lưu dữ liệu (đọc riêng từ SessionAssignment). */}
              {dayAssignments.length > 0 ? (
                <div className="rounded-xl border border-hairline bg-white p-3">
                  <p className="mb-2 text-xs font-bold uppercase text-ink-muted48">Buổi dạy trong ngày</p>
                  <div className="space-y-1.5">
                    {dayAssignments.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="badge bg-ink/5 text-ink">{ROLE_LABEL[item.role] ?? item.role}</span>
                        <span className="font-semibold text-ink">{item.classCode} · {item.className}</span>
                        <span className="text-ink-muted48">{item.hours?.toFixed(2) ?? 0}h</span>
                        {item.deductedHours > 0 ? <span className="text-red-600">Trừ {item.deductedHours}h</span> : null}
                        {item.addedHours > 0 ? <span className="text-emerald-700">Cộng {item.addedHours}h</span> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        }}
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
