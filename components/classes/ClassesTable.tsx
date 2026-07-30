"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column, Action, BulkAction } from "@/components/ui/DataTable";
import { canCreate, canUpdate, canDelete } from "@/lib/server/role-matrix";

type Class = {
  id: string;
  classCode: string;
  className: string;
  status: string;
  course?: {
    name: string;
  } | null;
  totalSessions?: number | null;
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
};

export default function ClassesTable({
  initialData,
  total,
  page,
  pageSize,
  userRole,
  searchQuery = "",
}: ClassesTableProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  const columns: Column<Class>[] = [
    {
      key: "classCode",
      label: "Mã lớp",
      sortable: true,
      width: "120px",
      render: (value) => (
        <span className="font-mono text-sm font-semibold text-primary">{value}</span>
      ),
    },
    {
      key: "className",
      label: "Tên lớp",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-md">
            {value.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{value}</p>
            {row.course ? (
              <p className="text-xs text-ink-muted48">{row.course.name}</p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "_count",
      label: "Sĩ số",
      align: "center",
      render: (value) => (
        <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-1 text-xs font-bold text-purple-700">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {value?.enrollments || 0}
        </span>
      ),
    },
    {
      key: "_count",
      label: "Buổi học",
      align: "center",
      render: (value, row) => (
        <div className="flex items-center justify-center gap-1">
          <span className="text-sm font-semibold text-ink">{value?.sessions || 0}</span>
          {row.totalSessions ? (
            <span className="text-xs text-ink-muted48">/ {row.totalSessions}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      label: "Trạng thái",
      align: "center",
      render: (value) => {
        const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
          ACTIVE: { label: "Đang hoạt động", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "●" },
          COMPLETED: { label: "Đã kết thúc", color: "bg-blue-100 text-blue-700 border-blue-200", icon: "●" },
          CANCELLED: { label: "Đã hủy", color: "bg-red-100 text-red-700 border-red-200", icon: "●" },
        };
        const config = statusConfig[value] || statusConfig.ACTIVE;
        return (
          <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold ${config.color}`}>
            <span>{config.icon}</span>
            {config.label}
          </span>
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
      onClick: (row) => router.push(`/classes/${row.id}/edit`),
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
          console.log("Xuất Excel", rows);
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
              })
            )
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
      }
    );
  }

  const handleSearch = async (query: string) => {
    setLoading(true);
    const response = await fetch(`/api/classes?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
    const result = await response.json();
    setData(result.items);
    setLoading(false);
    router.push(`/classes?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
  };

  const handlePageChange = (newPage: number) => {
    router.push(`/classes?page=${newPage}&pageSize=${pageSize}`);
  };

  const handlePageSizeChange = (newSize: number) => {
    router.push(`/classes?page=1&pageSize=${newSize}`);
  };

  return (
    <DataTableResponsive
      data={data}
      columns={columns}
      actions={actions}
      bulkActions={bulkActions}
      title="Danh sách lớp học"
      description="Theo dõi sĩ số, số buổi và trạng thái vận hành của từng lớp."
      searchable
      searchPlaceholder="Tìm theo tên lớp, mã lớp..."
      onSearch={handleSearch}
      defaultSearchValue={searchQuery}
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
        description: "Bắt đầu bằng cách thêm lớp học đầu tiên vào hệ thống.",
        action: canCreate("schedule", userRole)
          ? {
              label: "Thêm lớp học",
              onClick: () => router.push("/classes/new"),
            }
          : undefined,
      }}
      loading={loading}
      stickyHeader
      rowKey="id"
      onRowClick={(row) => router.push(`/classes/${row.id}`)}
      mobileConfig={{
        primaryColumn: "className",
        secondaryColumns: ["classCode", "status"],
      }}
    />
  );
}
