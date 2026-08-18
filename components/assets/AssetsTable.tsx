"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import DataTableResponsive from "@/components/ui/DataTable/DataTableResponsive";
import type { Column } from "@/components/ui/DataTable/DataTable";
import { ASSET_STATUS_LABEL } from "@/lib/server/asset-rules";
import { formatVnd } from "@/lib/export-utils";
import AssetEditForm from "@/components/assets/AssetEditForm";
import DeleteAssetButton from "@/components/assets/DeleteAssetButton";
import QuickMaintenanceButton from "@/components/assets/QuickMaintenanceButton";
import AssetMaintenanceCell from "@/components/assets/AssetMaintenanceCell";

type MaintenanceHistoryItem = { id: string; txnDate: string; amount: number; notes: string | null; voidedAt: string | null; voidReason: string | null };

export type AssetRow = {
  id: string;
  name: string;
  assetCode: string | null;
  category: string | null;
  room: string | null;
  quantity: number;
  unitName: string;
  unitValue: number | null;
  baseValue: number;
  maintenanceValue: number;
  totalValue: number;
  status: string;
  maintenanceIntervalMonths: number | null;
  maintenanceStatus: "OVERDUE" | "DUE_SOON" | "OK" | "NOT_SCHEDULED";
  nextMaintenanceDue: string | null;
  maintenanceHistory: MaintenanceHistoryItem[];
  notes: string | null;
};

function statusBadgeClass(status: string) {
  return status === "ACTIVE" ? "badge-green" : status === "MAINTENANCE" ? "badge-amber" : status === "BROKEN" ? "badge-red" : "badge-gray";
}

export default function AssetsTable({
  rows,
  canManageAssets,
  canRemoveAssets,
  currentPage,
  totalCount,
  pageSize,
}: {
  rows: AssetRow[];
  canManageAssets: boolean;
  canRemoveAssets: boolean;
  currentPage: number;
  totalCount: number;
  pageSize: number;
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

  const columns: Column<AssetRow>[] = [
    {
      key: "name",
      label: "Tài sản",
      render: (value, row) => (
        <div>
          <Link href={`/assets/${row.id}`} className="font-medium text-primary hover:underline">
            {value}
          </Link>
          <p className="mt-1 text-xs text-ink-muted48">{row.assetCode ?? "Chưa có mã"}</p>
        </div>
      ),
    },
    { key: "category", label: "Nhóm", render: (value) => value ?? "Chưa phân nhóm" },
    { key: "room", label: "Phòng", render: (value) => value ?? "Chưa gắn phòng" },
    { key: "quantity", label: "SL" },
    { key: "unitName", label: "ĐVT" },
    { key: "unitValue", label: "Đơn giá", render: (value) => (value != null ? formatVnd(value) : "—") },
    { key: "baseValue", label: "Giá gốc", render: (value) => <span className="font-medium text-slate-700">{formatVnd(value)}</span> },
    {
      key: "maintenanceValue",
      label: "Bảo dưỡng",
      render: (value) => <span className={value > 0 ? "font-medium text-amber-700" : "text-ink-muted48"}>{formatVnd(value)}</span>,
    },
    { key: "totalValue", label: "Tổng giá trị", render: (value) => <span className="font-medium">{formatVnd(value)}</span> },
    {
      key: "status",
      label: "Trạng thái",
      render: (value) => <span className={statusBadgeClass(value)}>{ASSET_STATUS_LABEL[value] ?? value}</span>,
    },
    {
      key: "maintenanceStatus",
      label: "Lịch bảo dưỡng",
      render: (_value, row) => (
        <AssetMaintenanceCell
          assetId={row.id}
          assetName={row.name}
          intervalMonths={row.maintenanceIntervalMonths}
          status={row.maintenanceStatus}
          nextDue={row.nextMaintenanceDue}
          history={row.maintenanceHistory}
          canVoid={canManageAssets}
        />
      ),
    },
  ];

  if (canManageAssets || canRemoveAssets) {
    columns.push({
      key: "id",
      label: "Thao tác",
      render: (_value, row) => (
        <div className="flex flex-wrap items-center gap-2">
          {canManageAssets && <QuickMaintenanceButton assetId={row.id} assetName={row.name} compact />}
          {canManageAssets && (
            <AssetEditForm
              assetId={row.id}
              compact
              initial={{
                status: row.status,
                name: row.name,
                category: row.category ?? "",
                room: row.room ?? "",
                unitName: row.unitName,
                unitValue: row.unitValue?.toString() ?? "",
                maintenanceIntervalMonths: row.maintenanceIntervalMonths?.toString() ?? "",
                notes: row.notes ?? "",
              }}
            />
          )}
          {canRemoveAssets && <DeleteAssetButton assetId={row.id} assetName={row.name} compact />}
        </div>
      ),
    });
  }

  return (
    <div data-tour="assets-table">
      <DataTableResponsive
        data={rows}
        columns={columns}
        rowKey="id"
        searchable={false}
        selectable={false}
        showCountBadge={false}
        primaryColumn="name"
        secondaryColumns={["status", "quantity", "totalValue", "maintenanceStatus"]}
        emptyState={{ title: "Không có tài sản nào", description: "Không có tài sản nào khớp bộ lọc." }}
        pagination={{
          total: totalCount,
          page: currentPage,
          pageSize,
          onPageChange: goToPage,
          onPageSizeChange: () => {},
        }}
      />
    </div>
  );
}
