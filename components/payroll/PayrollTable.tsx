"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import type { Column, Action, BulkAction } from "@/components/ui/DataTable";
import { isManagementRole, isFinanceRole } from "@/lib/client-roles";
import { exportToExcel } from "@/lib/export-utils";

type PayrollRun = {
  id: string;
  periodName: string;
  status: string;
  _count: {
    lines: number;
  };
  lines: {
    totalAmount: number;
  }[];
};

type PayrollTableProps = {
  initialData: PayrollRun[];
  total: number;
  page: number;
  pageSize: number;
  userRole: string;
};

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

const PAYROLL_STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  DRAFT: { label: "Nháp", color: "bg-gray-100 text-gray-700 border-gray-200", icon: "📝" },
  COMPUTED: { label: "Đã tính", color: "bg-blue-100 text-blue-700 border-blue-200", icon: "🧮" },
  APPROVED: { label: "Đã duyệt", color: "bg-green-100 text-green-700 border-green-200", icon: "✅" },
  PAID: { label: "Đã trả", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "💰" },
};

export default function PayrollTable({
  initialData,
  total,
  page,
  pageSize,
  userRole,
}: PayrollTableProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  const exportRows = (rows: PayrollRun[]) => {
    exportToExcel(
      rows.map((row) => ({
        periodName: row.periodName,
        employeeCount: row._count.lines,
        totalAmount: row.lines.reduce((sum, line) => sum + line.totalAmount, 0),
        status: PAYROLL_STATUS_CONFIG[row.status]?.label ?? row.status,
      })),
      [
        { key: "periodName", label: "Kỳ lương" },
        { key: "employeeCount", label: "Số nhân viên" },
        { key: "totalAmount", label: "Tổng lương", format: (value) => formatVnd(Number(value ?? 0)) },
        { key: "status", label: "Trạng thái" },
      ],
      "ky_luong"
    );
  };

  const columns: Column<PayrollRun>[] = [
    {
      key: "periodName",
      label: "Kỳ lương",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-md">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{value}</p>
            <p className="text-xs text-ink-muted48">{row._count.lines} nhân viên</p>
          </div>
        </div>
      ),
    },
    {
      key: "lines",
      label: "Tổng lương",
      align: "right",
      render: (lines) => {
        const totalAmount = lines.reduce((sum: number, line: { totalAmount: number }) => sum + line.totalAmount, 0);
        return <span className="font-mono text-sm font-semibold text-ink">{formatVnd(totalAmount)}</span>;
      },
    },
    {
      key: "_count",
      label: "Số nhân viên",
      align: "center",
      render: (value) => (
        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {value.lines}
        </span>
      ),
    },
    {
      key: "status",
      label: "Trạng thái",
      align: "center",
      render: (value) => {
        const config = PAYROLL_STATUS_CONFIG[value] || PAYROLL_STATUS_CONFIG.DRAFT;
        return (
          <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold ${config.color}`}>
            <span>{config.icon}</span>
            {config.label}
          </span>
        );
      },
    },
  ];

  const actions: Action<PayrollRun>[] = [
    {
      label: "Xem",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      onClick: (row) => router.push(`/payroll/${row.id}`),
      variant: "primary",
    },
  ];

  if (isFinanceRole(userRole)) {
    actions.push({
      label: "Tính lương",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>
      ),
      onClick: async (row) => {
        if (confirm(`Tính lương cho kỳ ${row.periodName}?`)) {
          await fetch(`/api/payroll-runs/${row.id}/compute`, { method: "POST" });
          router.refresh();
        }
      },
      variant: "secondary",
      show: (row) => row.status === "DRAFT",
    });

    actions.push({
      label: "Duyệt",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
      onClick: async (row) => {
        if (confirm(`Duyệt lương cho kỳ ${row.periodName}?`)) {
          await fetch(`/api/payroll-runs/${row.id}/approve`, { method: "POST" });
          router.refresh();
        }
      },
      variant: "secondary",
      show: (row) => row.status === "COMPUTED",
    });
  }

  if (isManagementRole(userRole)) {
    actions.push({
      label: "Xóa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
      onClick: async (row) => {
        if (confirm(`Xóa kỳ lương ${row.periodName}?`)) {
          await fetch(`/api/payroll-runs/${row.id}`, { method: "DELETE" });
          router.refresh();
        }
      },
      variant: "danger",
      show: (row) => row.status === "DRAFT",
    });
  }

  const bulkActions: BulkAction<PayrollRun>[] = [];

  if (isFinanceRole(userRole)) {
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

  if (isManagementRole(userRole)) {
    bulkActions.push({
      label: "Xóa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
      onClick: async (rows) => {
        await Promise.all(rows.map((row) => fetch(`/api/payroll-runs/${row.id}`, { method: "DELETE" })));
        router.refresh();
      },
      variant: "danger",
      confirmMessage: "Bạn có chắc muốn xóa kỳ lương? Thao tác này không thể hoàn tác.",
    });
  }

  const handleSearch = async (query: string) => {
    setLoading(true);
    const res = await fetch(`/api/payroll-runs?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
    const result = await res.json();
    setData(result.items);
    setLoading(false);
    router.push(`/payroll?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
  };

  const handlePageChange = (newPage: number) => {
    router.push(`/payroll?page=${newPage}&pageSize=${pageSize}`);
  };

  const handlePageSizeChange = (newSize: number) => {
    router.push(`/payroll?page=1&pageSize=${newSize}`);
  };

  return (
    <DataTable
      data={data}
      columns={columns}
      actions={actions}
      bulkActions={bulkActions}
      searchable
      searchPlaceholder="Tìm theo tên kỳ lương..."
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
        title: "Chưa có kỳ lương",
        description: "Bắt đầu bằng cách tạo kỳ lương đầu tiên để quản lý bảng lương.",
        action: isFinanceRole(userRole)
          ? {
              label: "Tạo kỳ lương",
              onClick: () => router.push("/payroll/new"),
            }
          : undefined,
      }}
      loading={loading}
      stickyHeader
      rowKey="id"
      onRowClick={(row) => router.push(`/payroll/${row.id}`)}
    />
  );
}
