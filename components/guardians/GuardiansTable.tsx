"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import type { Column, Action, BulkAction } from "@/components/ui/DataTable";
import { isManagementRole, isTeachingStaffRole, isFinanceRole, isFrontDeskRole } from "@/lib/client-roles";

type Guardian = {
  id: string;
  fullName: string;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  _count?: {
    leads: number;
    students: number;
  };
};

type GuardiansTableProps = {
  initialData: Guardian[];
  total: number;
  page: number;
  pageSize: number;
  userRole: string;
};

export default function GuardiansTable({
  initialData,
  total,
  page,
  pageSize,
  userRole,
}: GuardiansTableProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  // Define columns
  const columns: Column<Guardian>[] = [
    {
      key: "fullName",
      label: "Họ và tên",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-sm font-bold text-white shadow-md">
            {value.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{value}</p>
            {row.phone && (
              <p className="text-xs font-mono text-ink-muted48">{row.phone}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      render: (value) =>
        value ? (
          <span className="text-sm text-ink-muted64">{value}</span>
        ) : (
          <span className="text-xs text-ink-muted48">—</span>
        ),
    },
    {
      key: "address",
      label: "Địa chỉ",
      render: (value) =>
        value ? (
          <span className="text-sm text-ink-muted64 line-clamp-2">{value}</span>
        ) : (
          <span className="text-xs text-ink-muted48">—</span>
        ),
    },
    {
      key: "_count",
      label: "Lead",
      align: "center",
      render: (value) => (
        <span className="inline-flex items-center gap-1 rounded-lg bg-pink-50 px-2 py-1 text-xs font-bold text-pink-700">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          {value?.leads || 0}
        </span>
      ),
    },
    {
      key: "_count",
      label: "Học viên",
      align: "center",
      render: (value) => (
        <span className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
          {value?.students || 0}
        </span>
      ),
    },
  ];

  // Define actions based on role
  const actions: Action<Guardian>[] = [
    {
      label: "Xem",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      ),
      onClick: (row) => router.push(`/guardians/${row.id}`),
      variant: "primary",
    },
  ];

  // Add edit action for non-teacher roles
  if (!isTeachingStaffRole(userRole)) {
    actions.push({
      label: "Sửa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      ),
      onClick: (row) => router.push(`/guardians/${row.id}`),
      variant: "secondary",
    });
  }

  // Add delete action only for DIRECTOR and BRANCH_MANAGER
  if (isManagementRole(userRole)) {
    actions.push({
      label: "Xóa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      ),
      onClick: async (row) => {
        if (confirm(`Xóa phụ huynh ${row.fullName}?`)) {
          await fetch(`/api/guardians/${row.id}`, { method: "DELETE" });
          router.refresh();
        }
      },
      variant: "danger",
      show: (row) => (row._count?.leads || 0) === 0 && (row._count?.students || 0) === 0, // Only if no related records
    });
  }

  // Define bulk actions
  const bulkActions: BulkAction<Guardian>[] = [];

  if (isFrontDeskRole(userRole)) {
    bulkActions.push({
      label: "Xuất Excel",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      ),
      onClick: async (rows) => {
        console.log("Xuất Excel", rows);
        // TODO: Implement export
      },
      variant: "primary",
    });
  }

  if (isManagementRole(userRole)) {
    bulkActions.push({
      label: "Xóa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      ),
      onClick: async (rows) => {
        await Promise.all(
          rows.map((row) => fetch(`/api/guardians/${row.id}`, { method: "DELETE" }))
        );
        router.refresh();
      },
      variant: "danger",
      confirmMessage: "Bạn có chắc muốn xóa phụ huynh? Thao tác này không thể hoàn tác.",
    });
  }

  const handleSearch = async (query: string) => {
    setLoading(true);
    const res = await fetch(`/api/guardians?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
    const result = await res.json();
    setData(result.items);
    setLoading(false);
    router.push(`/guardians?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
  };

  const handlePageChange = (newPage: number) => {
    router.push(`/guardians?page=${newPage}&pageSize=${pageSize}`);
  };

  const handlePageSizeChange = (newSize: number) => {
    router.push(`/guardians?page=1&pageSize=${newSize}`);
  };

  return (
    <DataTable
      data={data}
      columns={columns}
      actions={actions}
      bulkActions={bulkActions}
      searchable
      searchPlaceholder="Tìm theo tên, số điện thoại, email..."
      onSearch={handleSearch}
      sortable
      selectable={!isTeachingStaffRole(userRole)}
      pagination={{
        total,
        page,
        pageSize,
        onPageChange: handlePageChange,
        onPageSizeChange: handlePageSizeChange,
      }}
      emptyState={{
        title: "Chưa có phụ huynh",
        description: "Phụ huynh thường được tạo tự động khi thêm lead hoặc học viên.",
        action: !isTeachingStaffRole(userRole) ? {
          label: "Thêm phụ huynh",
          onClick: () => router.push("/guardians/new"),
        } : undefined,
      }}
      loading={loading}
      stickyHeader
      rowKey="id"
      onRowClick={(row) => router.push(`/guardians/${row.id}`)}
    />
  );
}
