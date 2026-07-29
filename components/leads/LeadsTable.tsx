"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import type { Column, Action, BulkAction } from "@/components/ui/DataTable";
import { isManagementRole, isTeachingStaffRole, isFinanceRole, isFrontDeskRole } from "@/lib/client-roles";

type Lead = {
  id: string;
  leadCode: string;
  fullName: string;
  phone?: string | null;
  status: string;
  dob?: string | Date | null;
  guardianName?: string | null;
  source?: string | null;
};

type LeadsTableProps = {
  initialData: Lead[];
  total: number;
  page: number;
  pageSize: number;
  userRole: string;
};

const LEAD_STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  NEW: { label: "Mới", color: "bg-blue-100 text-blue-700 border-blue-200", icon: "🆕" },
  CONTACTED: { label: "Đã liên hệ", color: "bg-cyan-100 text-cyan-700 border-cyan-200", icon: "📞" },
  SCHEDULED_TEST: { label: "Đã hẹn test", color: "bg-purple-100 text-purple-700 border-purple-200", icon: "📅" },
  TESTED: { label: "Đã test", color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: "📝" },
  AWAITING_START: { label: "Chờ khai giảng", color: "bg-amber-100 text-amber-700 border-amber-200", icon: "⏰" },
  ENROLLED: { label: "Đã nhập học", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "✅" },
  LOST: { label: "Thất bại", color: "bg-red-100 text-red-700 border-red-200", icon: "❌" },
};

function calculateAge(dob?: string): number | null {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export default function LeadsTable({
  initialData,
  total,
  page,
  pageSize,
  userRole,
}: LeadsTableProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  // Define columns
  const columns: Column<Lead>[] = [
    {
      key: "leadCode",
      label: "Mã Lead",
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
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-600 text-sm font-bold text-white shadow-md">
            {value.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{value}</p>
            {row.guardianName && (
              <p className="text-xs text-ink-muted48">PH: {row.guardianName}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "dob",
      label: "Tuổi",
      align: "center",
      render: (value) => {
        const age = calculateAge(value);
        return age ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">
            {age} tuổi
          </span>
        ) : (
          <span className="text-xs text-ink-muted48">—</span>
        );
      },
    },
    {
      key: "phone",
      label: "Số điện thoại",
      render: (value) =>
        value ? (
          <span className="font-mono text-sm text-ink-muted64">{value}</span>
        ) : (
          <span className="text-xs text-ink-muted48">—</span>
        ),
    },
    {
      key: "source",
      label: "Nguồn",
      render: (value) =>
        value ? (
          <span className="text-sm text-ink-muted64">{value}</span>
        ) : (
          <span className="text-xs text-ink-muted48">—</span>
        ),
    },
    {
      key: "status",
      label: "Trạng thái",
      align: "center",
      render: (value) => {
        const config = LEAD_STATUS_CONFIG[value] || LEAD_STATUS_CONFIG.NEW;
        return (
          <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold ${config.color}`}>
            <span>{config.icon}</span>
            {config.label}
          </span>
        );
      },
    },
  ];

  // Define actions based on role
  const actions: Action<Lead>[] = [
    {
      label: "Xem",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      ),
      onClick: (row) => router.push(`/leads/${row.id}`),
      variant: "primary",
    },
    {
      label: "Sửa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      ),
      onClick: (row) => router.push(`/leads/${row.id}/edit`),
      variant: "secondary",
    },
  ];

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
        if (confirm(`Xóa lead ${row.fullName}?`)) {
          await fetch(`/api/leads/${row.id}`, { method: "DELETE" });
          router.refresh();
        }
      },
      variant: "danger",
    });
  }

  // Define bulk actions
  const bulkActions: BulkAction<Lead>[] = [];

  if (isFrontDeskRole(userRole)) {
    bulkActions.push(
      {
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
      },
      {
        label: "Đánh dấu đã liên hệ",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        ),
        onClick: async (rows) => {
          await Promise.all(
            rows.map((row) =>
              fetch(`/api/leads/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "CONTACTED" }),
              })
            )
          );
          router.refresh();
        },
        variant: "secondary",
        confirmMessage: "Bạn có chắc muốn đánh dấu lead là đã liên hệ?",
      }
    );
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
          rows.map((row) => fetch(`/api/leads/${row.id}`, { method: "DELETE" }))
        );
        router.refresh();
      },
      variant: "danger",
      confirmMessage: "Bạn có chắc muốn xóa lead? Thao tác này không thể hoàn tác.",
    });
  }

  const handleSearch = async (query: string) => {
    setLoading(true);
    const res = await fetch(`/api/leads?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
    const result = await res.json();
    setData(result.items);
    setLoading(false);
    router.push(`/leads?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
  };

  const handlePageChange = (newPage: number) => {
    router.push(`/leads?page=${newPage}&pageSize=${pageSize}`);
  };

  const handlePageSizeChange = (newSize: number) => {
    router.push(`/leads?page=1&pageSize=${newSize}`);
  };

  return (
    <DataTable
      data={data}
      columns={columns}
      actions={actions}
      bulkActions={bulkActions}
      searchable
      searchPlaceholder="Tìm theo tên, mã lead, số điện thoại..."
      onSearch={handleSearch}
      sortable
      selectable
      pagination={{
        total,
        page,
        pageSize,
        onPageChange: handlePageChange,
        onPageSizeChange: handlePageSizeChange,
      }}
      emptyState={{
        title: "Chưa có lead",
        description: "Bắt đầu bằng cách thêm lead đầu tiên vào hệ thống CRM.",
        action: {
          label: "Thêm lead",
          onClick: () => router.push("/leads/new"),
        },
      }}
      loading={loading}
      stickyHeader
      rowKey="id"
      onRowClick={(row) => router.push(`/leads/${row.id}`)}
    />
  );
}
