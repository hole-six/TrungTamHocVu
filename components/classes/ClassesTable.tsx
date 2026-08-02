"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column, Action, BulkAction } from "@/components/ui/DataTable";
import { canCreate, canUpdate, canDelete } from "@/lib/server/role-matrix";
import { exportToExcel } from "@/lib/export-utils";

type ScheduleRule = {
  weekday: number;
  startTime: string;
  endTime: string;
  room?: string | null;
};

type UpcomingSession = {
  id: string;
  sessionDate: string | Date;
  startTime?: string | null;
  endTime?: string | null;
  room?: string | null;
  status: string;
};

type Class = {
  id: string;
  classCode: string;
  className: string;
  classGroup?: string | null;
  isRemedial?: boolean;
  status: string;
  startDate?: string | Date | null;
  expectedEndDate?: string | Date | null;
  totalSessions?: number | null;
  tuitionPerSession?: number | null;
  sessionsPerWeek?: number | null;
  course?: {
    code?: string;
    name: string;
  } | null;
  scheduleRules?: ScheduleRule[];
  sessions?: UpcomingSession[];
  _count?: {
    enrollments: number;
    sessions: number;
  };
};

type ClassesTableProps = {
  initialData: Class[];
  total: number;
  page: number;
  pageSize: number;
  userRole: string;
  searchQuery?: string;
  statusFilter?: string;
  statusOptions?: { key: string; label: string; count: number }[];
};

const WEEKDAY_LABEL = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function formatVnd(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(amount)) return "—";
  return `${amount.toLocaleString("vi-VN")}đ`;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
}

function formatSchedule(rules?: ScheduleRule[]) {
  if (!rules || rules.length === 0) return "Chưa có lịch cố định";
  return rules
    .slice(0, 3)
    .map((rule) => `${WEEKDAY_LABEL[rule.weekday] || rule.weekday} ${rule.startTime}-${rule.endTime}`)
    .join(" · ");
}

function formatUpcomingSession(session?: UpcomingSession | null) {
  if (!session) return "Chưa có buổi kế tiếp";
  return `${formatDate(session.sessionDate)} · ${session.startTime ?? "--:--"}${session.room ? ` · ${session.room}` : ""}`;
}

function statusConfig(status: string) {
  if (status === "ACTIVE") {
    return { label: "Đang chạy", color: "bg-[#ebf8f1] text-[#159d65] border-[#cdeedb]" };
  }
  if (status === "COMPLETED") {
    return { label: "Đã kết thúc", color: "bg-[#eef5ff] text-[#1f6feb] border-[#d7e7ff]" };
  }
  if (status === "CANCELLED") {
    return { label: "Đã hủy", color: "bg-[#fff1f2] text-[#e11d48] border-[#ffd7df]" };
  }
  return { label: status, color: "bg-slate-100 text-slate-700 border-slate-200" };
}

function progressPercent(completed: number, total: number | null | undefined) {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
}

export default function ClassesTable({
  initialData,
  total,
  page,
  pageSize,
  userRole,
  searchQuery = "",
  statusFilter = "",
  statusOptions = [],
}: ClassesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  function buildParams(next: { q?: string; page?: number; pageSize?: number; status?: string }) {
    const params = new URLSearchParams(searchParams.toString());

    const query = next.q ?? searchQuery;
    const nextPage = next.page ?? page;
    const nextPageSize = next.pageSize ?? pageSize;
    const nextStatus = next.status ?? statusFilter;

    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");

    if (nextStatus) params.set("status", nextStatus);
    else params.delete("status");

    params.set("page", String(nextPage));
    params.set("pageSize", String(nextPageSize));
    return params;
  }

  const exportRows = (rows: Class[]) => {
    exportToExcel(
      rows.map((row) => ({
        classCode: row.classCode,
        className: row.className,
        classGroup: row.classGroup ?? "",
        courseName: row.course?.name ?? "",
        schedule: formatSchedule(row.scheduleRules),
        nextSession: formatUpcomingSession(row.sessions?.[0] ?? null),
        enrollmentCount: row._count?.enrollments ?? 0,
        completedSessions: row._count?.sessions ?? 0,
        totalSessions: row.totalSessions ?? 0,
        tuitionPerSession: row.tuitionPerSession ?? 0,
        expectedEndDate: formatDate(row.expectedEndDate),
        status: statusConfig(row.status).label,
      })),
      [
        { key: "classCode", label: "Mã lớp" },
        { key: "className", label: "Tên lớp" },
        { key: "classGroup", label: "Nhóm lớp" },
        { key: "courseName", label: "Khóa học" },
        { key: "schedule", label: "Lịch cố định" },
        { key: "nextSession", label: "Buổi kế tiếp" },
        { key: "enrollmentCount", label: "Sĩ số active" },
        { key: "completedSessions", label: "Buổi đã học" },
        { key: "totalSessions", label: "Tổng số buổi" },
        { key: "tuitionPerSession", label: "Học phí / buổi" },
        { key: "expectedEndDate", label: "Ngày kết thúc dự kiến" },
        { key: "status", label: "Trạng thái" },
      ],
      "danh_sach_lop_hoc",
    );
  };

  const columns: Column<Class>[] = [
    {
      key: "className",
      label: "Lớp học",
      sortable: true,
      render: (value, row) => (
        <div className="min-w-[260px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/8 px-3 py-1 text-xs font-bold text-primary">{row.classCode}</span>
            {row.classGroup ? <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-semibold text-ink-muted80">{row.classGroup}</span> : null}
            {row.isRemedial ? <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">🎯 Khóa bổ trợ</span> : null}
          </div>
          <p className="mt-2 text-[15px] font-extrabold leading-6 text-ink">{value}</p>
          <p className="mt-1 text-xs text-ink-muted48">
            {row.course ? `[${row.course.code ?? "Khóa"}] ${row.course.name}` : "Chưa gắn khóa chuẩn"}
          </p>
          <p className="mt-2 text-xs text-ink-muted48">
            Khai giảng {formatDate(row.startDate)} · Dự kiến kết thúc {formatDate(row.expectedEndDate)}
          </p>
        </div>
      ),
    },
    {
      key: "scheduleRules",
      label: "Lịch & tiến độ",
      render: (value, row) => {
        const completed = row._count?.sessions ?? 0;
        const totalSessions = row.totalSessions ?? null;
        const progress = progressPercent(completed, totalSessions);
        const nextSession = row.sessions?.[0] ?? null;
        return (
          <div className="min-w-[280px] space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Lịch cố định</p>
              <p className="mt-1 text-sm font-medium text-ink">{formatSchedule(value)}</p>
              <p className="mt-1 text-xs text-ink-muted48">
                {row.sessionsPerWeek ?? row.scheduleRules?.length ?? 0} buổi/tuần
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold uppercase tracking-[0.16em] text-ink-muted48">Tiến độ</span>
                <span className="font-semibold text-ink">
                  {completed}/{totalSessions ?? "—"} buổi
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#eef3fb]">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#0ea5e9_0%,#2563eb_100%)]" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-xs text-ink-muted48">Buổi kế tiếp: {formatUpcomingSession(nextSession)}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "_count",
      label: "Vận hành & học phí",
      render: (value, row) => (
        <div className="grid min-w-[220px] gap-2 text-sm">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f7faff] px-3 py-2.5">
            <span className="text-ink-muted48">Sĩ số active</span>
            <span className="font-semibold text-ink">{value?.enrollments ?? 0} học viên</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f7faff] px-3 py-2.5">
            <span className="text-ink-muted48">Học phí / buổi</span>
            <span className="font-semibold text-ink">{formatVnd(row.tuitionPerSession)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#edf5ff] px-3 py-2.5">
            <span className="text-ink-muted48">Tạm tính toàn khóa</span>
            <span className="font-semibold text-primary">
              {row.tuitionPerSession != null && row.totalSessions != null ? formatVnd(row.tuitionPerSession * row.totalSessions) : "—"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Trạng thái",
      align: "center",
      render: (value, row) => {
        const config = statusConfig(value);
        const nextSession = row.sessions?.[0] ?? null;
        return (
          <div className="space-y-2 text-center">
            <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold ${config.color}`}>
              {config.label}
            </span>
            <p className="text-xs text-ink-muted48">{nextSession ? `Buổi tới ${formatDate(nextSession.sessionDate)}` : "Chưa có buổi tới"}</p>
            {!row.scheduleRules?.length ? <p className="text-xs font-semibold text-rose-600">Thiếu lịch chuẩn</p> : null}
          </div>
        );
      },
    },
  ];

  const actions: Action<Class>[] = [
    {
      label: "Xem",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      onClick: (row) => router.push(`/classes/${row.id}`),
      variant: "primary",
    },
  ];

  if (canUpdate("schedule", userRole)) {
    actions.push({
      label: "Sửa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      onClick: (row) => router.push(`/classes/${row.id}`),
      variant: "secondary",
    });
  }

  if (canDelete("schedule", userRole)) {
    actions.push({
      label: "Xóa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
      onClick: async (row) => {
        if (confirm(`Xóa lớp ${row.className}?`)) {
          await fetch(`/api/classes/${row.id}`, { method: "DELETE" });
          router.refresh();
        }
      },
      variant: "danger",
      show: (row) => row.status !== "ACTIVE",
    });
  }

  const bulkActions: BulkAction<Class>[] = [];

  if (canDelete("schedule", userRole)) {
    bulkActions.push(
      {
        label: "Xuất Excel",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        ),
        onClick: async (rows) => {
          exportRows(rows);
        },
        variant: "primary",
      },
      {
        label: "Kết thúc lớp",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        ),
        onClick: async (rows) => {
          await Promise.all(
            rows.map((row) =>
              fetch(`/api/classes/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "COMPLETED" }),
              }),
            ),
          );
          router.refresh();
        },
        variant: "secondary",
        confirmMessage: "Bạn có chắc muốn kết thúc các lớp đã chọn?",
      },
      {
        label: "Xóa",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        ),
        onClick: async (rows) => {
          await Promise.all(rows.map((row) => fetch(`/api/classes/${row.id}`, { method: "DELETE" })));
          router.refresh();
        },
        variant: "danger",
        confirmMessage: "Bạn có chắc muốn xóa các lớp đã chọn? Thao tác này không thể hoàn tác.",
      },
    );
  }

  const handleSearch = async (query: string) => {
    setLoading(true);
    const params = buildParams({ q: query, page: 1 });
    const response = await fetch(`/api/classes?${params.toString()}`);
    const result = await response.json().catch(() => ({ items: [] }));
    setData(Array.isArray(result.items) ? result.items : []);
    setLoading(false);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = buildParams({ page: newPage });
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handlePageSizeChange = (newSize: number) => {
    const params = buildParams({ page: 1, pageSize: newSize });
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const filterChips = statusOptions.map((option) => {
    const isActive = (statusFilter || "") === option.key;
    return (
      <button
        key={option.key || "all"}
        type="button"
        onClick={() => {
          const params = buildParams({ status: option.key, page: 1 });
          startTransition(() => {
            router.push(`${pathname}?${params.toString()}`);
          });
        }}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
          isActive
            ? "border-[#1f6feb] bg-[linear-gradient(135deg,#1f6feb,#2f80ed)] text-white shadow-[0_10px_20px_-12px_rgba(31,111,235,0.8)]"
            : "border-[#dbe7ff] bg-white text-ink hover:border-primary/40 hover:bg-[#f8fbff] hover:text-primary"
        }`}
      >
        <span>{option.label}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? "bg-white/20 text-white" : "bg-[#f3f7ff] text-primary"}`}>
          {option.count}
        </span>
      </button>
    );
  });

  return (
    <DataTableResponsive
      data={data}
      columns={columns}
      actions={actions}
      bulkActions={bulkActions}
      searchable
      searchPlaceholder="Tìm theo tên lớp, mã lớp..."
      onSearch={handleSearch}
      defaultSearchValue={searchQuery}
      showCountBadge={false}
      filterChips={filterChips}
      sortable
      selectable={canUpdate("schedule", userRole)}
      className="
        [&_[data-dt='header']]:rounded-[28px]
        [&_[data-dt='header']]:border-[#dce6f5]
        [&_[data-dt='header']]:bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)]
        [&_[data-dt='header']]:px-5
        [&_[data-dt='header']]:py-3.5
        [&_[data-dt='table-shell']]:rounded-[30px]
        [&_[data-dt='table-shell']]:border-[#dce6f5]
        [&_[data-dt='table-shell']]:shadow-[0_30px_80px_-52px_rgba(15,23,42,0.45)]
        [&_[data-dt='thead']]:bg-[linear-gradient(180deg,#fbfdff_0%,#f3f8ff_100%)]
        [&_[data-dt='thead']_th]:px-5
        [&_[data-dt='thead']_th]:py-4
        [&_[data-dt='thead']_th]:text-[11px]
        [&_[data-dt='thead']_th]:font-extrabold
        [&_[data-dt='thead']_th]:tracking-[0.22em]
        [&_[data-dt='tbody']_[data-dt='row']]:hover:bg-[#fbfdff]
        [&_[data-dt='tbody']_[data-dt='row']_td]:px-5
        [&_[data-dt='tbody']_[data-dt='row']_td]:py-5
        [&_[data-dt='actions-cell']_[data-dt-action]]:min-w-[86px]
        [&_[data-dt='actions-cell']_[data-dt-action]]:justify-center
        [&_[data-dt='actions-cell']_[data-dt-action]]:rounded-[14px]
        [&_[data-dt='actions-cell']_[data-dt-action]]:px-3.5
        [&_[data-dt='actions-cell']_[data-dt-action]]:py-2.5
        [&_[data-dt='actions-cell']_[data-dt-action]]:text-[12px]
        [&_[data-dt='actions-cell']_[data-dt-action]]:font-bold
      "
      pagination={{
        total,
        page,
        pageSize,
        onPageChange: handlePageChange,
        onPageSizeChange: handlePageSizeChange,
      }}
      emptyState={{
        title: "Chưa có lớp học",
        description: "Bắt đầu bằng cách thêm lớp học đầu tiên và gắn lịch chuẩn cho lớp.",
        action: canCreate("schedule", userRole)
          ? {
              label: "Thêm lớp học",
              onClick: () => router.push("/classes/new"),
            }
          : undefined,
      }}
      loading={loading || isPending}
      stickyHeader
      rowKey="id"
      onRowClick={(row) => router.push(`/classes/${row.id}`)}
      mobileConfig={{
        primaryColumn: "className",
        secondaryColumns: ["status"],
      }}
    />
  );
}
