"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";

type Employee = { id: string; fullName: string; employeeCode: string };

export type CheckRow = {
  id: string;
  employee: Employee;
  session: { id: string; classId: string; sessionDate: Date | string; class: { className: string } };
  requirementText: string;
  status: string;
  scoreEvent: { points: number; type: string } | null;
  checkedAt: Date | string;
};

type TeacherTasksTableProps = {
  initialData: CheckRow[];
  employees: Employee[];
  status: string;
  employeeId: string;
};

function formatDateTime(value: Date | string) {
  return new Date(value).toLocaleString("vi-VN");
}

export default function TeacherTasksTable({ initialData, employees, status, employeeId }: TeacherTasksTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const handleFilterChange = (key: string, value: string | null) => updateParams({ [key]: value });

  const filterValues = {
    status,
    employeeId,
  };

  const columns: Column<CheckRow>[] = [
    {
      key: "employee",
      label: "Nhân sự",
      width: "220px",
      filter: {
        type: "select",
        paramKey: "employeeId",
        placeholder: "Tất cả nhân sự",
        options: employees.map((item) => ({ label: `${item.fullName} (${item.employeeCode})`, value: item.id })),
      },
      render: (value: Employee) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-bold text-white shadow-md">
            {value.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-[#0f1729]">{value.fullName}</p>
            <p className="text-xs text-[#64748b]">{value.employeeCode}</p>
          </div>
        </div>
      ),
    },
    {
      key: "session",
      label: "Buổi học",
      render: (value: CheckRow["session"]) => (
        <div>
          <Link href={`/classes/${value.classId}/sessions/${value.id}`} className="inline-flex items-center gap-2 rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-3 py-2 text-sm font-bold text-[#1d4ed8] transition hover:border-[#3b82f6] hover:bg-[#dbeafe]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {new Date(value.sessionDate).toLocaleDateString("vi-VN")}
          </Link>
          <p className="mt-2 text-xs text-[#64748b]">{value.class.className}</p>
        </div>
      ),
    },
    {
      key: "requirementText",
      label: "Yêu cầu",
      render: (value: string) => (
        <div className="max-w-xs">
          <p className="line-clamp-2 text-sm leading-relaxed text-[#0f1729]">{value}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Trạng thái",
      filter: {
        type: "select",
        paramKey: "status",
        placeholder: "Tất cả",
        options: [
          { label: "Đã nộp", value: "SUBMITTED" },
          { label: "Chưa nộp", value: "NOT_SUBMITTED" },
        ],
      },
      render: (value: string) => (
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${
            value === "SUBMITTED" ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white" : "bg-gradient-to-r from-red-500 to-rose-600 text-white"
          }`}
        >
          {value === "SUBMITTED" ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Đã nộp
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Chưa nộp
            </>
          )}
        </span>
      ),
    },
    {
      key: "scoreEvent",
      label: "Điểm trừ",
      render: (value: CheckRow["scoreEvent"]) =>
        value ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1.5 text-sm font-black text-red-700">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            -{value.points}
          </span>
        ) : (
          <span className="text-[#94a3b8]">—</span>
        ),
    },
    {
      key: "checkedAt",
      label: "Thời gian",
      render: (value: Date | string) => <p className="text-xs text-[#64748b]">{formatDateTime(value)}</p>,
    },
    {
      key: "actions",
      label: "Tác vụ",
      align: "right",
      render: (_value, row) => (
        <Link
          href={`/payroll/employees/${row.employee.id}`}
          className="inline-flex items-center gap-2 rounded-lg border border-[#e5eaf7] bg-white px-3 py-2 text-xs font-bold text-[#475569] transition hover:border-[#f97316] hover:text-[#f97316]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Lịch sử & điểm
        </Link>
      ),
    },
  ];

  return (
    <DataTableResponsive
      data={initialData}
      columns={columns}
      searchable={false}
      showCountBadge={false}
      sortable={false}
      selectable={false}
      filterValues={filterValues}
      onFilterChange={handleFilterChange}
      emptyState={{
        title: "Chưa có xác nhận nào",
        description: "Các xác nhận sẽ xuất hiện khi trợ giảng đánh dấu tại từng buổi học",
      }}
      loading={isPending}
      rowKey="id"
      className="[&_table]:min-w-[900px]"
      primaryColumn="employee"
      secondaryColumns={["status", "session"]}
    />
  );
}
