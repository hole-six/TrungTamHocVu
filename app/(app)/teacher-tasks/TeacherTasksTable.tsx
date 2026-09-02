"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

type Employee = { id: string; fullName: string; employeeCode: string };
type ClassOption = { id: string; className: string; classCode: string };

export type CheckRow = {
  id: string;
  employee: Employee;
  session: { id: string; classId: string; sessionDate: Date | string; class: { className: string } };
  requirementText: string;
  initialStatus: string;
  status: string;
  reason: string | null;
  scoreDecision: string;
  scoreEvent: { points: number; type: string } | null;
  checkedAt: Date | string;
};

type TeacherTasksTableProps = {
  initialData: CheckRow[];
  employees: Employee[];
  classes: ClassOption[];
  status: string;
  employeeId: string;
  searchQuery: string;
  total: number;
  page: number;
  pageSize: number;
  canDecide: boolean;
};

const SCORE_DECISION_OPTIONS: { value: string; label: string }[] = [
  { value: "PENDING", label: "Chờ quyết định" },
  { value: "DEDUCTED", label: "Trừ điểm" },
  { value: "WAIVED", label: "Bỏ qua" },
];

function formatDateTime(value: Date | string) {
  return new Date(value).toLocaleString("vi-VN");
}

export default function TeacherTasksTable({
  initialData,
  employees,
  classes,
  status,
  employeeId,
  searchQuery,
  total,
  page,
  pageSize,
  canDecide,
}: TeacherTasksTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    // Đổi bất kỳ bộ lọc/tìm kiếm nào cũng phải quay về trang 1 — giữ nguyên page cũ
    // dễ ra trang trống nếu kết quả lọc mới có ít hơn.
    if (!("page" in patch)) next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const handleFilterChange = (key: string, value: string | null, extra?: Record<string, string | null>) =>
    updateParams({ [key]: value, ...extra });

  const handleSearch = (query: string) => updateParams({ q: query || null });

  const filterValues = {
    status,
    employeeId,
    classId: searchParams.get("classId") ?? "",
    sessionFrom: searchParams.get("sessionFrom") ?? "",
    sessionTo: searchParams.get("sessionTo") ?? "",
    requirementText: searchParams.get("requirementText") ?? "",
    reason: searchParams.get("reason") ?? "",
    scoreDecision: searchParams.get("scoreDecision") ?? "",
    checkedAtFrom: searchParams.get("checkedAtFrom") ?? "",
    checkedAtTo: searchParams.get("checkedAtTo") ?? "",
  };

  async function patchCheck(sessionId: string, body: Record<string, string>) {
    setSavingId(sessionId);
    await fetch(`/api/sessions/${sessionId}/requirement-check`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSavingId(null);
    router.refresh();
  }

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
      label: "Lớp",
      filter: {
        type: "select",
        paramKey: "classId",
        placeholder: "Tất cả lớp",
        options: classes.map((item) => ({ label: `${item.classCode} - ${item.className}`, value: item.id })),
      },
      render: (value: CheckRow["session"]) => <p className="text-sm font-semibold text-[#0f1729]">{value.class.className}</p>,
    },
    {
      key: "sessionDate",
      label: "Buổi học",
      filter: { type: "dateRange", paramKeyFrom: "sessionFrom", paramKeyTo: "sessionTo" },
      render: (_value, row) => (
        <Link href={`/classes/${row.session.classId}/sessions/${row.session.id}`} className="inline-flex items-center gap-2 rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-3 py-2 text-sm font-bold text-[#1d4ed8] transition hover:border-[#3b82f6] hover:bg-[#dbeafe]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {new Date(row.session.sessionDate).toLocaleDateString("vi-VN")}
        </Link>
      ),
    },
    {
      key: "requirementText",
      label: "Yêu cầu",
      filter: { type: "text", paramKey: "requirementText", placeholder: "Tìm yêu cầu..." },
      render: (value: string) => (
        <div className="max-w-xs">
          <p className="line-clamp-2 text-sm leading-relaxed text-[#0f1729]">{value}</p>
        </div>
      ),
    },
    {
      key: "reason",
      label: "Ghi chú",
      filter: { type: "text", paramKey: "reason", placeholder: "Tìm ghi chú..." },
      render: (value: string | null) => (
        <div className="max-w-xs">
          {value ? <p className="line-clamp-2 text-sm leading-relaxed text-[#64748b]">{value}</p> : <span className="text-[#94a3b8]">—</span>}
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
      render: (value: string, row) => (
        <div className="space-y-1">
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
          {row.initialStatus === "NOT_SUBMITTED" && row.status === "SUBMITTED" ? (
            <span className="block w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Nộp muộn</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "scoreDecision",
      label: "Quyết định điểm",
      filter: { type: "select", paramKey: "scoreDecision", placeholder: "Tất cả", options: SCORE_DECISION_OPTIONS.map((o) => ({ label: o.label, value: o.value })) },
      render: (value: string, row) =>
        canDecide ? (
          <div className="flex flex-wrap gap-1">
            {SCORE_DECISION_OPTIONS.map((option) =>
              option.value === "DEDUCTED" ? (
                <ConfirmActionButton
                  key={option.value}
                  title="Xác nhận trừ điểm tích cực?"
                  description={`Sẽ trừ 1 điểm tích cực của ${row.employee.fullName} cho buổi ${new Date(row.session.sessionDate).toLocaleDateString("vi-VN")}.`}
                  confirmLabel="Trừ điểm"
                  tone="danger"
                  disabled={savingId === row.session.id || value === option.value}
                  className={`rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
                    value === option.value ? "border-rose-400 bg-rose-100 text-rose-700" : "border-[#e5e7eb] bg-white text-[#64748b] hover:border-rose-300"
                  }`}
                  onConfirm={() => patchCheck(row.session.id, { scoreDecision: option.value })}
                >
                  {option.label}
                </ConfirmActionButton>
              ) : (
                <button
                  key={option.value}
                  type="button"
                  disabled={savingId === row.session.id || value === option.value}
                  onClick={() => patchCheck(row.session.id, { scoreDecision: option.value })}
                  className={`rounded-lg border px-2 py-1 text-[11px] font-bold transition disabled:cursor-default ${
                    value === option.value ? "border-primary bg-primary/10 text-primary" : "border-[#e5e7eb] bg-white text-[#64748b] hover:border-primary/40"
                  }`}
                >
                  {option.label}
                </button>
              ),
            )}
          </div>
        ) : row.scoreEvent ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1.5 text-sm font-black text-red-700">-{row.scoreEvent.points}</span>
        ) : (
          <span className="text-[#94a3b8]">{SCORE_DECISION_OPTIONS.find((o) => o.value === value)?.label ?? "—"}</span>
        ),
    },
    {
      key: "checkedAt",
      label: "Thời gian",
      filter: { type: "dateRange", paramKeyFrom: "checkedAtFrom", paramKeyTo: "checkedAtTo" },
      render: (value: Date | string) => <p className="text-xs text-[#64748b]">{formatDateTime(value)}</p>,
    },
    {
      key: "actions",
      label: "Tác vụ",
      align: "right",
      render: (_value, row) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canDecide && row.status === "NOT_SUBMITTED" ? (
            <ConfirmActionButton
              title="Chuyển thành đã nộp?"
              description="Dùng khi nhân sự đã nộp bổ sung sau ngày buổi học. Hệ thống vẫn giữ dấu vết đây là nộp muộn."
              confirmLabel="Chuyển thành Đã nộp"
              disabled={savingId === row.session.id}
              className="status-action"
              onConfirm={() => patchCheck(row.session.id, { status: "SUBMITTED" })}
            >
              Chuyển thành Đã nộp
            </ConfirmActionButton>
          ) : null}
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
        </div>
      ),
    },
  ];

  return (
    <DataTableResponsive
      data={initialData}
      columns={columns}
      searchable
      searchPlaceholder="Tìm theo tên/mã nhân sự, tên lớp, yêu cầu..."
      onSearch={handleSearch}
      defaultSearchValue={searchQuery}
      showCountBadge={false}
      sortable={false}
      selectable={false}
      filterValues={filterValues}
      onFilterChange={handleFilterChange}
      pagination={{
        total,
        page,
        pageSize,
        onPageChange: (nextPage) => updateParams({ page: String(nextPage) }),
        onPageSizeChange: (nextSize) => updateParams({ page: "1", pageSize: String(nextSize) }),
      }}
      emptyState={{
        title: "Chưa có xác nhận nào",
        description: "Các xác nhận sẽ xuất hiện khi trợ giảng đánh dấu tại từng buổi học",
      }}
      loading={isPending}
      rowKey="id"
      className="[&_table]:min-w-[1100px]"
      primaryColumn="employee"
      secondaryColumns={["status", "session", "sessionDate"]}
    />
  );
}
