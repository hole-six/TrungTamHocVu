"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";

export type ImportJobRow = {
  id: string;
  createdAt: Date | string;
  targetEntity: string;
  branch: { code: string; name: string } | null;
  status: string;
  successRows: number;
  totalRows: number;
  errorRows: number;
};

type ImportJobsTableProps = {
  initialData: ImportJobRow[];
  total: number;
  page: number;
  pageSize: number;
  statusFilter: string;
  statusLabels: Record<string, string>;
  branches: { id: string; code: string; name: string }[];
};

function formatDateTime(value: Date | string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN");
}

export default function ImportJobsTable({ initialData, total, page, pageSize, statusFilter, statusLabels, branches }: ImportJobsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const handleFilterChange = (key: string, value: string | null, extra?: Record<string, string | null>) =>
    updateParams({ [key]: value, ...extra, page: "1" });

  const filterValues = {
    status: statusFilter,
    createdAtFrom: searchParams.get("createdAtFrom") ?? "",
    createdAtTo: searchParams.get("createdAtTo") ?? "",
    targetEntity: searchParams.get("targetEntity") ?? "",
    branchId: searchParams.get("branchId") ?? "",
    successRowsFrom: searchParams.get("successRowsFrom") ?? "",
    successRowsTo: searchParams.get("successRowsTo") ?? "",
    errorRowsFrom: searchParams.get("errorRowsFrom") ?? "",
    errorRowsTo: searchParams.get("errorRowsTo") ?? "",
  };

  const columns: Column<ImportJobRow>[] = [
    {
      key: "createdAt",
      label: "Thời gian",
      filter: { type: "dateRange", paramKeyFrom: "createdAtFrom", paramKeyTo: "createdAtTo" },
      render: (value: Date | string) => <span className="text-ink-muted80">{formatDateTime(value)}</span>,
    },
    {
      key: "targetEntity",
      label: "Đối tượng",
      filter: { type: "text", paramKey: "targetEntity", placeholder: "Tìm đối tượng..." },
      render: (value: string) => <span className="font-medium text-ink">{value}</span>,
    },
    {
      key: "branch",
      label: "Chi nhánh",
      filter: {
        type: "select",
        paramKey: "branchId",
        placeholder: "Tất cả chi nhánh",
        options: branches.map((item) => ({ label: `${item.code} · ${item.name}`, value: item.id })),
      },
      render: (value: ImportJobRow["branch"]) => (
        <span className="text-ink-muted80">
          {value?.code} · {value?.name}
        </span>
      ),
    },
    {
      key: "status",
      label: "Trạng thái",
      filter: {
        type: "select",
        paramKey: "status",
        placeholder: "Tất cả trạng thái",
        options: Object.entries(statusLabels).map(([value, label]) => ({ label, value })),
      },
      render: (value: string) => (
        <span
          className={`inline-flex rounded-lg px-2 py-1 text-xs font-bold ${
            value === "IMPORTED" ? "bg-emerald-100 text-emerald-700" : value === "FAILED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {statusLabels[value] ?? value}
        </span>
      ),
    },
    {
      key: "successRows",
      label: "Đã nhập OK",
      filter: { type: "numberRange", paramKeyFrom: "successRowsFrom", paramKeyTo: "successRowsTo", placeholder: "dòng" },
      render: (_value, row) => (
        <span className="text-ink-muted80">
          {row.successRows}/{row.totalRows} OK
        </span>
      ),
    },
    {
      key: "errorRows",
      label: "Lỗi",
      filter: { type: "numberRange", paramKeyFrom: "errorRowsFrom", paramKeyTo: "errorRowsTo", placeholder: "dòng" },
      render: (value: number) => <span className="text-ink-muted80">{value} lỗi</span>,
    },
  ];

  return (
    <DataTableResponsive
      data={initialData}
      columns={columns}
      searchable={false}
      showCountBadge={false}
      sortable={false}
      selectable={false}
      filterValues={filterValues}
      onFilterChange={handleFilterChange}
      pagination={{
        total,
        page,
        pageSize,
        onPageChange: (newPage) => updateParams({ page: String(newPage) }),
        onPageSizeChange: (newSize) => updateParams({ page: "1", pageSize: String(newSize) }),
      }}
      emptyState={{ title: "Chưa có ImportJob nào", description: "Chưa có ImportJob nào được ghi nhận." }}
      loading={isPending}
      rowKey="id"
      primaryColumn="targetEntity"
      secondaryColumns={["status", "createdAt"]}
    />
  );
}
