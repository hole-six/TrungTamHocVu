"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column, Action, BulkAction } from "@/components/ui/DataTable";
import { canCreate, canUpdate, canDelete } from "@/lib/server/role-matrix";
import { exportToExcel, formatVnd as formatVndBase } from "@/lib/export-utils";
import { useClassDrawer } from "@/contexts/ClassDrawerContext";

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
  courseOptions?: { label: string; value: string }[];
};

const WEEKDAY_LABEL = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function formatVnd(amount: number | null | undefined) {
  return amount == null || Number.isNaN(amount) ? "—" : formatVndBase(amount);
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
  courseOptions = [],
}: ClassesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const { openDrawer } = useClassDrawer();

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  function buildParams(next: {
    q?: string;
    page?: number;
    pageSize?: number;
    status?: string;
    // Lọc theo từng cột (hàng cố định dưới header) — patch trực tiếp các paramKey bất
    // kỳ qua URL, tái dùng đúng buildParams()/router.push() sẵn có thay vì luồng fetch
    // riêng (xem DataTable.tsx ColumnFilter/onFilterChange).
    filters?: Record<string, string | null>;
  }) {
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

    if (next.filters) {
      for (const [key, value] of Object.entries(next.filters)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
    }
    return params;
  }

  const handleFilterChange = (key: string, value: string | null) => {
    const params = buildParams({ page: 1, filters: { [key]: value } });
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const filterValues = {
    classCode: searchParams.get("classCode") ?? "",
    className: searchParams.get("className") ?? "",
    courseId: searchParams.get("courseId") ?? "",
    status: statusFilter,
  };

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
      key: "classCode",
      label: "MÃ LỚP",
      sortable: true,
      filter: { type: "text", paramKey: "classCode", placeholder: "Mã lớp..." },
      render: (value, row) => (
        <div className="min-w-[120px]">
          <span className="inline-block rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary">{value}</span>
          {row.classGroup ? (
            <span className="mt-1.5 inline-block rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{row.classGroup}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "className",
      label: "TÊN LỚP",
      sortable: true,
      filter: { type: "text", paramKey: "className", placeholder: "Tên lớp..." },
      render: (value, row) => (
        <div className="min-w-[200px]">
          <p className="text-sm font-bold text-[#0f172a]">{value}</p>
          {row.isRemedial ? (
            <span className="mt-1 inline-block rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">Bổ trợ</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "course",
      label: "KHÓA HỌC",
      filter: courseOptions.length
        ? { type: "select", paramKey: "courseId", placeholder: "Tất cả", options: courseOptions }
        : undefined,
      render: (value, row) => (
        <div className="min-w-[180px]">
          <p className="text-sm font-semibold text-[#0f172a]">{value?.name ?? "—"}</p>
          {value?.code ? <p className="mt-0.5 text-xs text-slate-500">{value.code}</p> : null}
        </div>
      ),
    },
    {
      key: "scheduleRules",
      label: "LỊCH CỐ ĐỊNH",
      render: (value, row) => (
        <div className="min-w-[160px]">
          <p className="text-sm font-medium text-[#0f172a]">{formatSchedule(value)}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {row.sessionsPerWeek ?? row.scheduleRules?.length ?? 0} buổi/tuần
          </p>
        </div>
      ),
    },
    {
      key: "_count.enrollments",
      label: "SĨ SỐ",
      align: "center",
      render: (value, row) => (
        <div className="min-w-[80px] text-center">
          <p className="text-lg font-bold text-[#0f172a]">{row._count?.enrollments ?? 0}</p>
          <p className="text-xs text-slate-500">học viên</p>
        </div>
      ),
    },
    {
      key: "_count.sessions",
      label: "TIẾN ĐỘ",
      render: (value, row) => {
        const completed = row._count?.sessions ?? 0;
        const total = row.totalSessions ?? 0;
        const progress = progressPercent(completed, total);
        return (
          <div className="min-w-[140px]">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#0f172a]">
              <span>{completed}/{total || "—"}</span>
              <span className="text-slate-500">{progress}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600" 
                style={{ width: `${progress}%` }} 
              />
            </div>
          </div>
        );
      },
    },
    {
      key: "tuitionPerSession",
      label: "HỌC PHÍ/BUỔI",
      align: "right",
      render: (value) => (
        <div className="min-w-[120px] text-right">
          <p className="text-sm font-semibold text-[#0f172a]">{formatVnd(value)}</p>
        </div>
      ),
    },
    {
      key: "expectedEndDate",
      label: "DỰ KIẾN KẾT THÚC",
      align: "center",
      render: (value) => (
        <div className="min-w-[100px] text-center">
          <p className="text-sm font-medium text-[#0f172a]">{formatDate(value)}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: "TRẠNG THÁI",
      align: "center",
      filter: {
        type: "select",
        paramKey: "status",
        placeholder: "Tất cả",
        options: [
          { label: "Đang chạy", value: "ACTIVE" },
          { label: "Đã kết thúc", value: "COMPLETED" },
          { label: "Đã hủy", value: "CANCELLED" },
        ],
      },
      render: (value, row) => {
        const config = statusConfig(value);
        return (
          <div className="min-w-[120px] text-center">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${config.color}`}>
              {config.label}
            </span>
            {!row.scheduleRules?.length ? (
              <p className="mt-1 text-xs font-semibold text-rose-600">⚠️ Thiếu lịch</p>
            ) : null}
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
      onClick: (row) => openDrawer(row.id),
      variant: "primary",
    },
  ];

  if (canUpdate("schedule", userRole)) {
    actions.push({
      label: "Sửa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 2 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
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
        await fetch(`/api/classes/${row.id}`, { method: "DELETE" });
        router.refresh();
      },
      confirmTitle: "Xác nhận xóa lớp?",
      confirmMessage: "Lớp cùng lịch học, buổi học và ghi danh liên quan sẽ bị xóa. Thao tác này không thể hoàn tác.",
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
      filterValues={filterValues}
      onFilterChange={handleFilterChange}
      sortable
      selectable={canUpdate("schedule", userRole)}
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
      onRowClick={(row) => openDrawer(row.id)}
      primaryColumn="className"
      secondaryColumns={["status"]}
    />
  );
}
