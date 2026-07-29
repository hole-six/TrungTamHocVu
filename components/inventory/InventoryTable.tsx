"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import type { Column, Action, BulkAction } from "@/components/ui/DataTable";
import { isManagementRole, isTeachingStaffRole, isFinanceRole, isFrontDeskRole } from "@/lib/client-roles";

type Book = {
  id: string;
  name: string;
  unitPrice: number;
  balance: {
    onHand: number;
    received: number;
    issued: number;
    returned: number;
    adjusted: number;
  };
};

type InventoryTableProps = {
  initialData: Book[];
  total: number;
  page: number;
  pageSize: number;
  userRole: string;
};

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

export default function InventoryTable({
  initialData,
  total,
  page,
  pageSize,
  userRole,
}: InventoryTableProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  // Define columns
  const columns: Column<Book>[] = [
    {
      key: "name",
      label: "Tên sách/giáo trình",
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-sm font-bold text-white shadow-md">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-ink">{value}</p>
        </div>
      ),
    },
    {
      key: "unitPrice",
      label: "Đơn giá",
      sortable: true,
      align: "right",
      render: (value) => (
        <span className="font-mono text-sm font-semibold text-ink">{formatVnd(value)}</span>
      ),
    },
    {
      key: "balance",
      label: "Đã nhập",
      align: "center",
      render: (value) => (
        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 11 12 6 7 11" />
            <polyline points="17 18 12 13 7 18" />
          </svg>
          {value.received + value.returned + value.adjusted}
        </span>
      ),
    },
    {
      key: "balance",
      label: "Đã xuất",
      align: "center",
      render: (value) => (
        <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-1 text-xs font-bold text-purple-700">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="7 13 12 18 17 13" />
            <polyline points="7 6 12 11 17 6" />
          </svg>
          {value.issued}
        </span>
      ),
    },
    {
      key: "balance",
      label: "Tồn kho",
      align: "center",
      sortable: true,
      render: (value) => {
        const onHand = value.onHand;
        const config =
          onHand < 0
            ? { color: "bg-red-100 text-red-700 border-red-200", icon: "❌" }
            : onHand <= 5
            ? { color: "bg-amber-100 text-amber-700 border-amber-200", icon: "⚠️" }
            : { color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "✅" };

        return (
          <span className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-sm font-bold ${config.color}`}>
            <span>{config.icon}</span>
            {onHand}
          </span>
        );
      },
    },
  ];

  // Define actions based on role
  const actions: Action<Book>[] = [
    {
      label: "Xem",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      ),
      onClick: (row) => router.push(`/inventory/${row.id}`),
      variant: "primary",
    },
  ];

  // Add actions for ACCOUNTANT, DIRECTOR, BRANCH_MANAGER
  if (isFinanceRole(userRole)) {
    actions.push(
      {
        label: "Nhập kho",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 11 12 6 7 11" />
            <polyline points="17 18 12 13 7 18" />
          </svg>
        ),
        onClick: (row) => router.push(`/inventory/${row.id}?action=receive`),
        variant: "secondary",
      },
      {
        label: "Xuất kho",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="7 13 12 18 17 13" />
            <polyline points="7 6 12 11 17 6" />
          </svg>
        ),
        onClick: (row) => router.push(`/inventory/${row.id}?action=issue`),
        variant: "secondary",
      }
    );
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
        if (confirm(`Xóa sách ${row.name}?`)) {
          await fetch(`/api/inventory/${row.id}`, { method: "DELETE" });
          router.refresh();
        }
      },
      variant: "danger",
      show: (row) => row.balance.onHand === 0, // Only if no stock
    });
  }

  // Define bulk actions
  const bulkActions: BulkAction<Book>[] = [];

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
          rows.map((row) => fetch(`/api/inventory/${row.id}`, { method: "DELETE" }))
        );
        router.refresh();
      },
      variant: "danger",
      confirmMessage: "Bạn có chắc muốn xóa đầu sách? Thao tác này không thể hoàn tác.",
    });
  }

  const handleSearch = async (query: string) => {
    setLoading(true);
    const res = await fetch(`/api/inventory?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
    const result = await res.json();
    setData(result.items);
    setLoading(false);
    router.push(`/inventory?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
  };

  const handlePageChange = (newPage: number) => {
    router.push(`/inventory?page=${newPage}&pageSize=${pageSize}`);
  };

  const handlePageSizeChange = (newSize: number) => {
    router.push(`/inventory?page=1&pageSize=${newSize}`);
  };

  return (
    <DataTable
      data={data}
      columns={columns}
      actions={actions}
      bulkActions={bulkActions}
      searchable
      searchPlaceholder="Tìm theo tên sách, giáo trình..."
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
        title: "Chưa có sách/giáo trình",
        description: "Bắt đầu bằng cách thêm sách hoặc giáo trình vào kho.",
        action: (isFinanceRole(userRole)) ? {
          label: "Thêm sách",
          onClick: () => router.push("/inventory/new"),
        } : undefined,
      }}
      loading={loading}
      stickyHeader
      rowKey="id"
      onRowClick={(row) => router.push(`/inventory/${row.id}`)}
    />
  );
}
