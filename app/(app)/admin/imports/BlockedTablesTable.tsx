"use client";

import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";

export type BlockedTableRow = {
  table: string;
  rowCount: number;
  missingKeyCounts: Record<string, number>;
};

function formatMissingKeys(missingKeyCounts: Record<string, number>) {
  return Object.entries(missingKeyCounts)
    .slice(0, 3)
    .map(([key, count]) => `${key}: ${count}`)
    .join(" · ");
}

export default function BlockedTablesTable({ data }: { data: BlockedTableRow[] }) {
  const columns: Column<BlockedTableRow>[] = [
    { key: "table", label: "Bảng", render: (value: string) => <span className="font-medium text-ink">{value}</span> },
    { key: "rowCount", label: "Số dòng", render: (value: number) => <span className="text-ink-muted80">{value}</span> },
    {
      key: "missingKeyCounts",
      label: "Thiếu khóa chính",
      render: (value: Record<string, number>) => <span className="text-xs text-ink-muted64">{formatMissingKeys(value)}</span>,
    },
  ];

  return (
    <DataTableResponsive
      data={data}
      columns={columns}
      searchable={false}
      showCountBadge={false}
      sortable={false}
      selectable={false}
      emptyState={{ title: "Không có bảng bị chặn", description: "Không có bảng nào đang bị chặn import." }}
      rowKey="table"
      primaryColumn="table"
      secondaryColumns={["rowCount"]}
    />
  );
}
