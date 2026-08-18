"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import DataTableResponsive from "@/components/ui/DataTable/DataTableResponsive";
import type { Column } from "@/components/ui/DataTable/DataTable";
import CashTransactionExpandedDetail, { type CashTransactionForDetail } from "@/components/cashbook/CashTransactionExpandedDetail";
import { formatVnd, formatDate } from "@/lib/export-utils";

type Category = { id: string; type: string; name: string };

type CashRow = CashTransactionForDetail & {
  txnDate: string;
  handledByName: string | null;
  categoryName: string | null;
  thuAmount: number | null;
  chiAmount: number | null;
};

export default function CashbookTable({
  transactions,
  categories,
  canManageCashbook,
  currentPage,
  totalCount,
  itemsPerPage,
}: {
  transactions: CashRow[];
  categories: Category[];
  canManageCashbook: boolean;
  currentPage: number;
  totalCount: number;
  itemsPerPage: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(page));
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const columns: Column<CashRow>[] = [
    { key: "txnDate", label: "Ngày", render: (value) => formatDate(value) },
    {
      key: "type",
      label: "Loại phiếu",
      render: (value) => <span className={value === "THU" ? "badge-green" : "badge-red"}>{value === "THU" ? "Thu" : "Chi"}</span>,
    },
    { key: "categoryName", label: "Danh mục", render: (value) => value ?? "Chưa phân loại" },
    {
      key: "description",
      label: "Nội dung thu chi",
      render: (value, row) => (
        <div className="space-y-1">
          <p className="font-medium text-ink">{value ?? "Chưa có diễn giải"}</p>
          <p className="text-xs text-ink-muted48">{row.handledByName ? `Người xử lý: ${row.handledByName}` : "Chưa rõ người xử lý"}</p>
        </div>
      ),
    },
    { key: "thuAmount", label: "Thu vào", align: "right", render: (value) => (value ? <span className="font-semibold text-emerald-600">{formatVnd(value)}</span> : "—") },
    { key: "chiAmount", label: "Chi ra", align: "right", render: (value) => (value ? <span className="font-semibold text-rose-600">{formatVnd(value)}</span> : "—") },
    {
      key: "status",
      label: "Trạng thái",
      render: (value, row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="badge-gray">{value === "CONFIRMED" ? "Đã xác nhận" : value === "VOIDED" ? "Đã hủy" : "Nháp"}</span>
          {row.isDerived ? <span className="badge-purple">Tự động</span> : null}
        </div>
      ),
    },
  ];

  return (
    <DataTableResponsive
      data={transactions}
      columns={columns}
      rowKey="id"
      searchable={false}
      selectable={false}
      showCountBadge={false}
      primaryColumn="description"
      secondaryColumns={["txnDate", "type", "thuAmount", "chiAmount", "status"]}
      renderExpanded={(row) => <CashTransactionExpandedDetail transaction={row} categories={categories} canManageCashbook={canManageCashbook} />}
      emptyState={{ title: "Chưa có phiếu thu/chi nào", description: "Không có phiếu nào trong khoảng ngày đang xem." }}
      pagination={{
        total: totalCount,
        page: currentPage,
        pageSize: itemsPerPage,
        onPageChange: goToPage,
        onPageSizeChange: () => {},
      }}
    />
  );
}
