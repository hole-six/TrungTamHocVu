"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DataTableResponsive from "@/components/ui/DataTable/DataTableResponsive";
import type { Column, Action, BulkAction } from "@/components/ui/DataTable";
import { canCreate, canUpdate, canDelete, canApprove } from "@/lib/server/role-matrix";
import { exportToExcel } from "@/lib/export-utils";
import { BILLING_PERIOD_STATUS_LABEL } from "@/lib/server/tuition-rules";

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
  DRAFT: { label: BILLING_PERIOD_STATUS_LABEL.DRAFT, color: "bg-gray-100 text-gray-700 border-gray-200", icon: "📝" },
  GENERATED: { label: BILLING_PERIOD_STATUS_LABEL.GENERATED, color: "bg-amber-100 text-amber-700 border-amber-200", icon: "🧮" },
  REVIEWED: { label: BILLING_PERIOD_STATUS_LABEL.REVIEWED, color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: "🔍" },
  POSTED: { label: BILLING_PERIOD_STATUS_LABEL.POSTED, color: "bg-blue-100 text-blue-700 border-blue-200", icon: "🔒" },
  CLOSED: { label: BILLING_PERIOD_STATUS_LABEL.CLOSED, color: "bg-green-100 text-green-700 border-green-200", icon: "✅" },
  REOPENED: { label: BILLING_PERIOD_STATUS_LABEL.REOPENED, color: "bg-orange-100 text-orange-700 border-orange-200", icon: "🔓" },
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

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const exportRows = (rows: BillingPeriod[]) => {
    exportToExcel(
      rows.map((row) => {
        const totalAmount = row.charges.reduce((sum, charge) => sum + charge.totalAmount, 0);
        const paidAmount = row.charges.reduce(
          (sum, charge) => sum + charge.allocations.reduce((allocationSum, allocation) => allocationSum + allocation.amount, 0),
          0
        );

        return {
          periodName: row.periodName,
          chargeCount: row.charges.length,
          totalAmount,
          paidAmount,
          outstandingAmount: totalAmount - paidAmount,
          status: BILLING_STATUS_CONFIG[row.status]?.label ?? row.status,
        };
      }),
      [
        { key: "periodName", label: "Kỳ thu" },
        { key: "chargeCount", label: "Số khoản thu" },
        { key: "totalAmount", label: "Tổng phải thu", format: (value) => formatVnd(Number(value ?? 0)) },
        { key: "paidAmount", label: "Đã thu", format: (value) => formatVnd(Number(value ?? 0)) },
        { key: "outstandingAmount", label: "Còn nợ", format: (value) => formatVnd(Number(value ?? 0)) },
        { key: "status", label: "Trạng thái" },
      ],
      "tong_hop_hoc_phi"
    );
  };

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
        const totalAmount = charges.reduce((sum: number, charge: { totalAmount: number }) => sum + charge.totalAmount, 0);
        return <span className="font-mono text-sm font-semibold text-ink">{formatVnd(totalAmount)}</span>;
      },
    },
    {
      key: "charges",
      label: "Đã thu",
      align: "right",
      render: (charges) => {
        const paidAmount = charges.reduce(
          (sum: number, charge: { allocations: { amount: number }[] }) =>
            sum + charge.allocations.reduce((allocationSum: number, allocation: { amount: number }) => allocationSum + allocation.amount, 0),
          0
        );
        return <span className="font-mono text-sm font-semibold text-emerald-600">{formatVnd(paidAmount)}</span>;
      },
    },
    {
      key: "charges",
      label: "Còn nợ",
      align: "right",
      render: (charges) => {
        const totalAmount = charges.reduce((sum: number, charge: { totalAmount: number }) => sum + charge.totalAmount, 0);
        const paidAmount = charges.reduce(
          (sum: number, charge: { allocations: { amount: number }[] }) =>
            sum + charge.allocations.reduce((allocationSum: number, allocation: { amount: number }) => allocationSum + allocation.amount, 0),
          0
        );
        const debt = totalAmount - paidAmount;
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

  const actions: Action<BillingPeriod>[] = [
    {
      label: "Xuất phiếu PDF",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9V2h12v7" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <path d="M6 14h12v8H6z" />
        </svg>
      ),
      onClick: (row) => { window.open(`/invoices/batch/${row.id}`, "_blank", "noopener,noreferrer"); },
      variant: "secondary",
      show: (row) => row.charges.length > 0,
    },
    {
      label: "Xem",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      onClick: (row) => router.push(`/tuition/${row.id}`),
      variant: "primary",
    },
  ];

  if (canDelete("tuition", userRole)) {
    actions.push({
      label: "Xóa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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

  const bulkActions: BulkAction<BillingPeriod>[] = [];

  if (canApprove("tuition", userRole)) {
    bulkActions.push({
      label: "Xuất báo cáo Excel",
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
    });
  }

  if (canDelete("tuition", userRole)) {
    bulkActions.push({
      label: "Xóa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
      onClick: async (rows) => {
        await Promise.all(rows.map((row) => fetch(`/api/billing-periods/${row.id}`, { method: "DELETE" })));
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
    <DataTableResponsive
      data={data}
      columns={columns}
      actions={actions}
      bulkActions={bulkActions}
      searchable
      searchPlaceholder="Tìm theo tên kỳ thu..."
      onSearch={handleSearch}
      sortable
      selectable={canUpdate("tuition", userRole)}
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
        action: canCreate("tuition", userRole)
          ? {
              label: "Tạo kỳ thu",
              onClick: () => router.push("/tuition/new"),
            }
          : undefined,
      }}
      loading={loading}
      stickyHeader
      rowKey="id"
      onRowClick={(row) => router.push(`/tuition/${row.id}`)}
      primaryColumn="periodName"
      secondaryColumns={["status"]}
    />
  );
}
