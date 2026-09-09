"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DataTableResponsive from "@/components/ui/DataTable/DataTableResponsive";
import type { Column } from "@/components/ui/DataTable/DataTable";
import TimesheetEmployeeDrawer, { type TimesheetEmployee } from "@/components/timesheets/TimesheetEmployeeDrawer";

const PAGE_SIZE = 15;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export default function TimesheetsWorkspace({
  employees,
  month,
  today,
  canEditTimesheet,
  canDeleteTimesheet,
}: {
  employees: TimesheetEmployee[];
  /** "YYYY-MM" — tháng đang xem. Chấm công đi theo tháng giống lương, để đối chiếu
   *  công/lương cùng một mốc thời gian thay vì mỗi bên một kiểu. */
  month: string;
  /** "YYYY-MM-DD" của hôm nay, tính ở server để tránh lệch máy client. */
  today: string;
  canEditTimesheet: boolean;
  canDeleteTimesheet: boolean;
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Chấm công cả tháng theo ca chuẩn (xem app/api/timesheet-entries/bulk-month).
  // Chấm theo NGOẠI LỆ: điền sẵn toàn bộ ngày công bình thường, nhân sự chỉ sửa lại
  // ngày bất thường — thay cho việc mở từng người × từng ngày × 4 ô giờ.
  async function fillMonth() {
    setBulkLoading(true);
    setBulkError(null);
    setBulkMessage(null);
    const response = await fetch("/api/timesheet-entries/bulk-month", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    const result = await response.json().catch(() => ({}));
    setBulkLoading(false);
    if (!response.ok) {
      setBulkError(result.error ?? "Không chấm công hàng loạt được.");
      return;
    }
    setBulkMessage(result.message ?? "Đã chấm công cả tháng.");
    router.refresh();
  }

  // Lọc ngay ở client: toàn bộ nhân sự của tháng đã nằm sẵn trong props (vài chục
  // người), không cần vòng đi server chỉ để tìm theo tên.
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((item) =>
      [item.fullName, item.employeeCode, item.position ?? ""].some((field) => field.toLowerCase().includes(query))
    );
  }, [employees, search]);

  const selected = employees.find((item) => item.id === openId) ?? null;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedEmployees = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const showTodayColumn = today.startsWith(month);

  const columns: Column<TimesheetEmployee>[] = [
    {
      key: "fullName",
      label: "Nhân viên",
      render: (value, row) => (
        <div>
          <p className="font-semibold text-[#0f1729]">{value}</p>
          <p className="mt-0.5 text-xs text-[#94a3b8]">
            {row.employeeCode}
            {row.position ? ` · ${row.position}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "timesheetEntries",
      label: "Công hành chính",
      render: (_value, row) => {
        const days = round2(row.timesheetEntries.reduce((sum, entry) => sum + (entry.days ?? 0), 0));
        const hours = round2(row.timesheetEntries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0));
        return row.timesheetEntries.length === 0 ? (
          <span className="text-sm text-[#94a3b8]">Chưa chấm ngày nào</span>
        ) : (
          <p className="text-sm text-[#0f1729]">
            <span className="font-semibold">{days} công</span>
            <span className="text-[#64748b]"> · {hours} giờ · {row.timesheetEntries.length} ngày</span>
          </p>
        );
      },
    },
    {
      key: "sessionAssignments",
      label: "Buổi dạy / TG",
      render: (_value, row) => {
        const hours = round2(row.sessionAssignments.reduce((sum, item) => sum + (item.hours ?? 0), 0));
        return row.sessionAssignments.length === 0 ? (
          <span className="text-sm text-[#94a3b8]">—</span>
        ) : (
          <p className="text-sm text-[#0f1729]">
            <span className="font-semibold">{row.sessionAssignments.length} buổi</span>
            <span className="text-[#64748b]"> · {hours} giờ</span>
          </p>
        );
      },
    },
    ...(showTodayColumn
      ? [
          {
            key: "id" as const,
            label: "Hôm nay",
            render: (_value: unknown, row: TimesheetEmployee) => {
              const entry = row.timesheetEntries.find((item) => item.workDate.slice(0, 10) === today);
              return entry ? (
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                  Đã chấm · {entry.hours?.toFixed(2) ?? 0}h
                </span>
              ) : (
                <span className="rounded-md border border-[#e2e8f0] bg-white px-2 py-1 text-xs font-bold text-[#94a3b8]">Chưa chấm</span>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-black tracking-tight text-[#0f1729] sm:text-2xl">Chấm công</h1>
        <input
          type="month"
          className="input w-auto text-sm"
          value={month}
          onChange={(event) => {
            if (event.target.value) router.push(`/timesheets?month=${event.target.value}`);
          }}
        />
      </div>

      {canEditTimesheet ? (
        <div className="rounded-xl border border-[#dbe7ff] bg-[#f8faff] p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#0f1729]">Chấm công nhanh cả tháng</p>
              <p className="mt-0.5 text-xs text-[#64748b]">
                Điền sẵn ngày công theo ca hành chính (08:00–12:00, 13:00–17:00) cho toàn bộ nhân sự hưởng lương tháng,
                bỏ qua Chủ nhật và ngày lễ. Ngày đã chấm trước đó được giữ nguyên — sau đó chỉ cần sửa lại ngày nghỉ/bất thường.
              </p>
            </div>
            <button type="button" onClick={fillMonth} disabled={bulkLoading} className="btn-primary shrink-0 disabled:opacity-60">
              {bulkLoading ? "Đang chấm..." : `Chấm công tháng ${month}`}
            </button>
          </div>
          {bulkMessage ? <p className="mt-2 text-sm font-semibold text-emerald-700">{bulkMessage}</p> : null}
          {bulkError ? <p className="mt-2 text-sm font-semibold text-red-600">{bulkError}</p> : null}
        </div>
      ) : null}

      <DataTableResponsive
        data={pagedEmployees}
        columns={columns}
        rowKey="id"
        searchable
        searchPlaceholder="Tìm theo tên, mã NV..."
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        selectable={false}
        showCountBadge={false}
        onRowClick={(row) => setOpenId(row.id)}
        primaryColumn="fullName"
        secondaryColumns={["timesheetEntries", "sessionAssignments"]}
        emptyState={{ title: "Không có nhân viên nào", description: "Chưa có nhân sự đang làm việc." }}
        pagination={{
          total: filtered.length,
          page: currentPage,
          pageSize: PAGE_SIZE,
          onPageChange: (nextPage) => setPage(nextPage),
          onPageSizeChange: () => {},
        }}
      />

      {selected ? (
        <TimesheetEmployeeDrawer
          open={Boolean(openId)}
          onClose={() => setOpenId(null)}
          employee={selected}
          month={month}
          canEdit={canEditTimesheet}
          canDeleteTimesheet={canDeleteTimesheet}
        />
      ) : null}
    </div>
  );
}
