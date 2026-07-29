"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import type { Column, Action, BulkAction } from "@/components/ui/DataTable";
import { isManagementRole, isFinanceRole } from "@/lib/client-roles";

type CashTransaction = {
  id: string;
  txnDate: Date;
  type: "THU" | "CHI";
  amount: number;
  description?: string;
  status: string;
  category?: {
    name: string;
  };
};

type CashbookTableProps = {
  initialData: CashTransaction[];
  total: number;
  page: number;
  pageSize: number;
  userRole: string;
};

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("vi-VN");
}

const CASH_TXN_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  THU: { label: "Thu", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "💰" },
  CHI: { label: "Chi", color: "bg-red-100 text-red-700 border-red-200", icon: "💸" },
};

const CASH_STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  CONFIRMED: { label: "Đã xác nhận", color: "bg-blue-100 text-blue-700 border-blue-200", icon: "✅" },
  VOIDED: { label: "Đã hủy", color: "bg-gray-100 text-gray-700 border-gray-200", icon: "❌" },
};

export default function CashbookTable({
  initialData,
  total,
  page,
  pageSize,
  userRole,
}: CashbookTableProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  // Define columns
  const columns: Column<CashTransaction>[] = [
    {
      key: "txnDate",
      label: "Ngày",
      sortable: true,
      width: "120px",
      render: (value) => (
        <span className="font-mono text-sm text-ink-muted64">{formatDate(value)}</span>
      ),
    },
    {
      key: "type",
      label: "Loại",
      align: "center",
      width: "100px",
      render: (value) => {
        const config = CASH_TXN_TYPE_CONFIG[value];
        return (
          <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold ${config.color}`}>
            <span>{config.icon}</span>
            {config.label}
          </span>
        );
      },
    },
    {
      key: "category",
      label: "Danh mục",
      render: (value) => (
        <span className="text-sm text-ink-muted80">{value?.name || "—"}</span>
      ),
    },
    {
      key: "description",
      label: "Diễn giải",
      render: (value) => (
        <span className="text-sm text-ink line-clamp-2">{value || "—"}</span>
      ),
    },
    {
      key: "amount",
      label: "Số tiền",
      sortable: true,
      align: "right",
      render: (value, row) => (
        <span className={`font-mono text-sm font-semibold ${row.type === "THU" ? "text-emerald-600" : "text-red-600"}`}>
          {row.type === "THU" ? "+" : "-"}{formatVnd(value)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Trạng thái",
      align: "center",
      width: "140px",
      render: (value) => {
        const config = CASH_STATUS_CONFIG[value] || CASH_STATUS_CONFIG.CONFIRMED;
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
  const actions: Action<CashTransaction>[] = [
    {
      label: "Xem",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      ),
      onClick: (row) => router.push(`/cashbook/${row.id}`),
      variant: "primary",
    },
  ];

  // Add void action for ACCOUNTANT, DIRECTOR, BRANCH_MANAGER on CONFIRMED transactions
  if (isFinanceRole(userRole)) {
    actions.push({
      label: "Hủy phiếu",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
      ),
      onClick: async (row) => {
        if (confirm(`Hủy phiếu ${row.type === "THU" ? "thu" : "chi"} ${formatVnd(row.amount)}?`)) {
          await fetch(`/api/cash-transactions/${row.id}/void`, { method: "POST" });
          router.refresh();
        }
      },
      variant: "danger",
      show: (row) => row.status === "CONFIRMED",
    });
  }

  // Add delete action only for DIRECTOR and BRANCH_MANAGER on VOIDED transactions
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
        if (confirm(`Xóa phiếu ${row.type === "THU" ? "thu" : "chi"}?`)) {
          await fetch(`/api/cash-transactions/${row.id}`, { method: "DELETE" });
          router.refresh();
        }
      },
      variant: "danger",
      show: (row) => row.status === "VOIDED",
    });
  }

  // Define bulk actions
  const bulkActions: BulkAction<CashTransaction>[] = [];

  if (isFinanceRole(userRole)) {
    bulkActions.push(
      {
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
      },
      {
        label: "Hủy phiếu hàng loạt",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
          </svg>
        ),
        onClick: async (rows) => {
          await Promise.all(
            rows.map((row) => fetch(`/api/cash-transactions/${row.id}/void`, { method: "POST" }))
          );
          router.refresh();
        },
        variant: "secondary",
        confirmMessage: "Bạn có chắc muốn hủy phiếu thu/chi?",
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
          rows.map((row) => fetch(`/api/cash-transactions/${row.id}`, { method: "DELETE" }))
        );
        router.refresh();
      },
      variant: "danger",
      confirmMessage: "Bạn có chắc muốn xóa phiếu thu/chi? Thao tác này không thể hoàn tác.",
    });
  }

  const handleSearch = async (query: string) => {
    setLoading(true);
    const res = await fetch(`/api/cash-transactions?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
    const result = await res.json();
    setData(result.items);
    setLoading(false);
    router.push(`/cashbook?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
  };

  const handlePageChange = (newPage: number) => {
    router.push(`/cashbook?page=${newPage}&pageSize=${pageSize}`);
  };

  const handlePageSizeChange = (newSize: number) => {
    router.push(`/cashbook?page=1&pageSize=${newSize}`);
  };

  return (
    <DataTable
      data={data}
      columns={columns}
      actions={actions}
      bulkActions={bulkActions}
      searchable
      searchPlaceholder="Tìm theo diễn giải, danh mục..."
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
        title: "Chưa có phiếu thu/chi",
        description: "Bắt đầu bằng cách tạo phiếu thu hoặc phiếu chi đầu tiên.",
        action: (isFinanceRole(userRole)) ? {
          label: "Thêm phiếu thu/chi",
          onClick: () => router.push("/cashbook/new"),
        } : undefined,
      }}
      loading={loading}
      stickyHeader
      rowKey="id"
      onRowClick={(row) => router.push(`/cashbook/${row.id}`)}
    />
  );
}
