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
  categoryOptions,
}: {
  rows: AssetRow[];
  canManageAssets: boolean;
  canRemoveAssets: boolean;
  currentPage: number;
  totalCount: number;
  pageSize: number;
  categoryOptions: string[];
}) {
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

  function goToPage(page: number) {
    updateParams({ page: String(page) });
  }

  const filterValues = {
    name: searchParams.get("name") ?? "",
    category: searchParams.get("category") ?? "",
    status: searchParams.get("status") ?? "",
    room: searchParams.get("room") ?? "",
    qtyFrom: searchParams.get("qtyFrom") ?? "",
    qtyTo: searchParams.get("qtyTo") ?? "",
    unitValueFrom: searchParams.get("unitValueFrom") ?? "",
    unitValueTo: searchParams.get("unitValueTo") ?? "",
    baseValueFrom: searchParams.get("baseValueFrom") ?? "",
    baseValueTo: searchParams.get("baseValueTo") ?? "",
    maintenanceFrom: searchParams.get("maintenanceFrom") ?? "",
    maintenanceTo: searchParams.get("maintenanceTo") ?? "",
    totalValueFrom: searchParams.get("totalValueFrom") ?? "",
    totalValueTo: searchParams.get("totalValueTo") ?? "",
    maintenanceStatus: searchParams.get("maintenanceStatus") ?? "",
  };
  const handleFilterChange = (key: string, value: string | null) => updateParams({ [key]: value, page: "1" });

  const columns: Column<AssetRow>[] = [
    {
      key: "name",
      label: "Tài sản",
      filter: { type: "text", paramKey: "name", placeholder: "Tên/mã tài sản..." },
      render: (value, row) => (
        <div>
          <Link href={`/assets/${row.id}`} className="font-medium text-primary hover:underline">
            {value}
          </Link>
          <p className="mt-1 text-xs text-ink-muted48">{row.assetCode ?? "Chưa có mã"}</p>
        </div>
      ),
    },
    {
      key: "category",
      label: "Nhóm",
      filter: {
        type: "select",
        paramKey: "category",
        placeholder: "Tất cả",
        options: categoryOptions.map((category) => ({ label: category, value: category })),
      },
      render: (value) => value ?? "Chưa phân nhóm",
    },
    {
      key: "room",
      label: "Phòng",
      filter: { type: "text", paramKey: "room", placeholder: "Tên phòng..." },
      render: (value) => value ?? "Chưa gắn phòng",
    },
    { key: "quantity", label: "SL", filter: { type: "numberRange", paramKeyFrom: "qtyFrom", paramKeyTo: "qtyTo" } },
    { key: "unitName", label: "ĐVT" },
    {
      key: "unitValue",
      label: "Đơn giá",
      filter: { type: "numberRange", paramKeyFrom: "unitValueFrom", paramKeyTo: "unitValueTo", placeholder: "đ" },
      render: (value) => (value != null ? formatVnd(value) : "—"),
    },
    {
      key: "baseValue",
      label: "Giá gốc",
      filter: { type: "numberRange", paramKeyFrom: "baseValueFrom", paramKeyTo: "baseValueTo", placeholder: "đ" },
      render: (value) => <span className="font-medium text-slate-700">{formatVnd(value)}</span>,
    },
    {
      key: "maintenanceValue",
      label: "Bảo dưỡng",
      filter: { type: "numberRange", paramKeyFrom: "maintenanceFrom", paramKeyTo: "maintenanceTo", placeholder: "đ" },
      render: (value) => <span className={value > 0 ? "font-medium text-amber-700" : "text-ink-muted48"}>{formatVnd(value)}</span>,
    },
    {
      key: "totalValue",
      label: "Tổng giá trị",
      filter: { type: "numberRange", paramKeyFrom: "totalValueFrom", paramKeyTo: "totalValueTo", placeholder: "đ" },
      render: (value) => <span className="font-medium">{formatVnd(value)}</span>,
    },
    {
      key: "status",
      label: "Trạng thái",
      filter: {
        type: "select",
        paramKey: "status",
        placeholder: "Tất cả",
        options: Object.entries(ASSET_STATUS_LABEL).map(([value, label]) => ({ label, value })),
      },
      render: (value) => <span className={statusBadgeClass(value)}>{ASSET_STATUS_LABEL[value] ?? value}</span>,
    },
    {
      key: "maintenanceStatus",
      label: "Lịch bảo dưỡng",
      filter: {
        type: "select",
        paramKey: "maintenanceStatus",
        placeholder: "Tất cả",
        options: [
          { label: "Quá hạn", value: "OVERDUE" },
          { label: "Sắp đến hạn", value: "DUE_SOON" },
          { label: "Đang ổn", value: "OK" },
          { label: "Chưa đặt lịch", value: "NOT_SCHEDULED" },
        ],
      },
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
          {canManageAssets && <QuickMaintenanceButton assetId={row.id} assetName={row.name} history={row.maintenanceHistory} compact />}
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
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        loading={isPending}
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
