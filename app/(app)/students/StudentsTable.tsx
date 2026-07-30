"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column, Action, BulkAction } from "@/components/ui/DataTable";
import { canCreate, canUpdate, canDelete } from "@/lib/server/role-matrix";

type Student = {
  id: string;
  studentCode: string;
  fullName: string;
  phone?: string | null;
  status: string;
  branchId: string;
  enrollDate?: string | Date | null;
  _count?: {
    enrollments: number;
  };
};

type StudentsTableProps = {
  initialData: Student[];
  total: number;
  page: number;
  pageSize: number;
  userRole: string;
  searchQuery?: string;
};

export default function StudentsTable({
  initialData,
  total,
  page,
  pageSize,
  userRole,
  searchQuery = "",
}: StudentsTableProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  const columns: Column<Student>[] = [
    {
      key: "studentCode",
      label: "Mã HV",
      sortable: true,
      width: "120px",
      render: (value) => (
        <span className="font-mono text-sm font-semibold text-primary">{value}</span>
      ),
    },
    {
      key: "fullName",
      label: "Họ và tên",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-600 text-sm font-bold text-white shadow-md">
            {value.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{value}</p>
            {row.phone ? (
              <p className="text-xs font-mono text-ink-muted48">{row.phone}</p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "_count",
      label: "Lớp học",
      align: "center",
      render: (value) => (
        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {value?.enrollments || 0}
        </span>
      ),
    },
    {
      key: "enrollDate",
      label: "Ngày nhập học",
      sortable: true,
      render: (value) =>
        value ? (
          <span className="text-sm text-ink-muted64">
            {new Date(value).toLocaleDateString("vi-VN")}
          </span>
        ) : (
          <span className="text-xs text-ink-muted48">—</span>
        ),
    },
    {
      key: "status",
      label: "Trạng thái",
      align: "center",
      render: (value) => {
        const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
          ACTIVE: { label: "Đang học", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "●" },
          PAUSED: { label: "Tạm nghỉ", color: "bg-amber-100 text-amber-700 border-amber-200", icon: "●" },
          LEFT: { label: "Đã nghỉ", color: "bg-red-100 text-red-700 border-red-200", icon: "●" },
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

  const actions: Action<Student>[] = [
    {
      label: "Xem",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      onClick: (row) => router.push(`/students/${row.id}`),
      variant: "primary",
    },
  ];

  if (canUpdate("students", userRole)) {
    actions.push({
      label: "Sửa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      onClick: (row) => router.push(`/students/${row.id}/edit`),
      variant: "secondary",
    });
  }

  if (canDelete("students", userRole)) {
    actions.push({
      label: "Xóa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
      onClick: async (row) => {
        if (confirm(`Xóa học viên ${row.fullName}?`)) {
          await fetch(`/api/students/${row.id}`, { method: "DELETE" });
          router.refresh();
        }
      },
      variant: "danger",
      show: (row) => row.status !== "ACTIVE",
    });
  }

  const bulkActions: BulkAction<Student>[] = [];

  if (canDelete("students", userRole)) {
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
        label: "Chuyển cơ sở",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        ),
        onClick: async (rows) => {
          console.log("Chuyển cơ sở", rows);
        },
        variant: "secondary",
        confirmMessage: "Bạn có chắc muốn chuyển các học viên đã chọn sang cơ sở khác?",
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
          await Promise.all(rows.map((row) => fetch(`/api/students/${row.id}`, { method: "DELETE" })));
          router.refresh();
        },
        variant: "danger",
        confirmMessage: "Bạn có chắc muốn xóa các học viên đã chọn? Thao tác này không thể hoàn tác.",
      }
    );
  }

  const handleSearch = async (query: string) => {
    setLoading(true);
    const response = await fetch(`/api/students?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
    const result = await response.json();
    setData(result.items);
    setLoading(false);
    router.push(`/students?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
  };

  const handlePageChange = (newPage: number) => {
    router.push(`/students?page=${newPage}&pageSize=${pageSize}`);
  };

  const handlePageSizeChange = (newSize: number) => {
    router.push(`/students?page=1&pageSize=${newSize}`);
  };

  return (
    <DataTableResponsive
      data={data}
      columns={columns}
      actions={actions}
      bulkActions={bulkActions}
      title="Danh sách học viên"
      description="Tra cứu hồ sơ, tình trạng học và lịch sử ghi danh theo từng cơ sở."
      searchable
      searchPlaceholder="Tìm theo tên, mã học viên, số điện thoại..."
      onSearch={handleSearch}
      defaultSearchValue={searchQuery}
      sortable
      selectable={canUpdate("students", userRole)}
      pagination={{
        total,
        page,
        pageSize,
        onPageChange: handlePageChange,
        onPageSizeChange: handlePageSizeChange,
      }}
      emptyState={{
        title: "Chưa có học viên",
        description: "Bắt đầu bằng cách thêm học viên đầu tiên vào hệ thống.",
        action: canCreate("students", userRole)
          ? {
              label: "Thêm học viên",
              onClick: () => router.push("/students/new"),
            }
          : undefined,
      }}
      loading={loading}
      stickyHeader
      rowKey="id"
      onRowClick={(row) => router.push(`/students/${row.id}`)}
      mobileConfig={{
        primaryColumn: "fullName",
        secondaryColumns: ["studentCode", "status"],
      }}
    />
  );
}
