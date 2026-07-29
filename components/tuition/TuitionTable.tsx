"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import type { Column, Action, BulkAction } from "@/components/ui/DataTable";
import { isManagementRole, isTeachingStaffRole, isFinanceRole, isFrontDeskRole } from "@/lib/client-roles";

type BillingPeriod = {
  id: string;
  periodName: string;
  status: string;
  charges: {
    totalAmount: number;
    allocations: {
      amount: number;
    }[];
  }[];
};

type TuitionTableProps = {
  initialData: BillingPeriod[];
  total: number;
  page: number;
  pageSize: number;
  userRole: string;
};

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

const BILLING_STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  DRAFT: { label: "Nháp", color: "bg-gray-100 text-gray-700 border-gray-200", icon: "📝" },
  FINALIZED: { label: "Đã chốt", color: "bg-blue-100 text-blue-700 border-blue-200", icon: "🔒" },
  CLOSED: { label: "Đã đóng", color: "bg-green-100 text-green-700 border-green-200", icon: "✅" },
};

export default function TuitionTable({
  initialData,
  total,
  page,
  pageSize,
  userRole,
}: TuitionTableProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  // Define columns
  const columns: Column<BillingPeriod>[] = [
    {
      key: "periodName",
      label: "Kỳ thu",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-md">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{value}</p>
            <p className="text-xs text-ink-muted48">{row.charges.length} khoản thu</p>
          </div>
        </div>
      ),
    },
    {
      key: "charges",
      label: "Tổng phải thu",
      align: "right",
      render: (charges) => {
        const total = charges.reduce((s: number, c: any) => s + c.totalAmount, 0);
        return <span className="font-mono text-sm font-semibold text-ink">{formatVnd(total)}</span>;
      },
    },
    {
      key: "charges",
      label: "Đã thu",
      align: "right",
      render: (charges) => {
        const paid = charges.reduce(
          (s: number, c: any) => s + c.allocations.reduce((sa: number, a: any) => sa + a.amount, 0),
          0
        );
        return <span className="font-mono text-sm font-semibold text-emerald-600">{formatVnd(paid)}</span>;
      },
    },
    {
      key: "charges",
      label: "Còn nợ",
      align: "right",
      render: (charges) => {
        const total = charges.reduce((s: number, c: any) => s + c.totalAmount, 0);
        const paid = charges.reduce(
          (s: number, c: any) => s + c.allocations.reduce((sa: number, a: any) => sa + a.amount, 0),
          0
        );
        const debt = total - paid;
        return (
          <span className={`font-mono text-sm font-semibold ${debt > 0 ? "text-red-600" : "text-ink-muted64"}`}>
            {formatVnd(debt)}
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Trạng thái",
      align: "center",
      render: (value) => {
        const config = BILLING_STATUS_CONFIG[value] || BILLING_STATUS_CONFIG.DRAFT;
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
  const actions: Action<BillingPeriod>[] = [
    {
      label: "Xem",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      ),
      onClick: (row) => router.push(`/tuition/${row.id}`),
      variant: "primary",
    },
  ];

  // Add finalize action for ACCOUNTANT, DIRECTOR, BRANCH_MANAGER on DRAFT periods
  if (isFinanceRole(userRole)) {
    actions.push({
      label: "Chốt kỳ",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      ),
      onClick: async (row) => {
        if (confirm(`Chốt kỳ thu ${row.periodName}? Sau khi chốt sẽ không thể sửa học phí.`)) {
          await fetch(`/api/billing-periods/${row.id}/finalize`, { method: "POST" });
          router.refresh();
        }
      },
      variant: "secondary",
      show: (row) => row.status === "DRAFT",
    });
  }

  // Add delete action only for DIRECTOR and BRANCH_MANAGER on DRAFT periods
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
        if (confirm(`Xóa kỳ thu ${row.periodName}?`)) {
          await fetch(`/api/billing-periods/${row.id}`, { method: "DELETE" });
          router.refresh();
        }
      },
      variant: "danger",
      show: (row) => row.status === "DRAFT",
    });
  }

  // Define bulk actions
  const bulkActions: BulkAction<BillingPeriod>[] = [];

  if (isFinanceRole(userRole)) {
    bulkActions.push({
      label: "Xuất báo cáo Excel",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      ),
      onClick: async (rows) => {
        console.log("Xuất báo cáo Excel", rows);
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
          rows.map((row) => fetch(`/api/billing-periods/${row.id}`, { method: "DELETE" }))
        );
        router.refresh();
      },
      variant: "danger",
      confirmMessage: "Bạn có chắc muốn xóa kỳ thu? Thao tác này không thể hoàn tác.",
    });
  }

  const handleSearch = async (query: string) => {
    setLoading(true);
    const res = await fetch(`/api/billing-periods?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
    const result = await res.json();
    setData(result.items);
    setLoading(false);
    router.push(`/tuition?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
  };

  const handlePageChange = (newPage: number) => {
    router.push(`/tuition?page=${newPage}&pageSize=${pageSize}`);
  };

  const handlePageSizeChange = (newSize: number) => {
    router.push(`/tuition?page=1&pageSize=${newSize}`);
  };

  return (
    <DataTable
      data={data}
      columns={columns}
      actions={actions}
      bulkActions={bulkActions}
      searchable
      searchPlaceholder="Tìm theo tên kỳ thu..."
      onSearch={handleSearch}
      sortable
      selectable={isFinanceRole(userRole)}
      pagination={{
        total,
        page,
        pageSize,
        onPageChange: handlePageChange,
        onPageSizeChange: handlePageSizeChange,
      }}
      emptyState={{
        title: "Chưa có kỳ thu",
        description: "Bắt đầu bằng cách tạo kỳ thu đầu tiên để quản lý học phí.",
        action: (isFinanceRole(userRole)) ? {
          label: "Tạo kỳ thu",
          onClick: () => router.push("/tuition/new"),
        } : undefined,
      }}
      loading={loading}
      stickyHeader
      rowKey="id"
      onRowClick={(row) => router.push(`/tuition/${row.id}`)}
    />
  );
}
