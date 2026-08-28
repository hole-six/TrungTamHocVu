"use client";

import { useMemo, useState } from "react";
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
  const [tableFilter, setTableFilter] = useState("");
  const [rowCountFrom, setRowCountFrom] = useState("");
  const [rowCountTo, setRowCountTo] = useState("");

  const handleFilterChange = (key: string, value: string | null) => {
    if (key === "table") setTableFilter(value ?? "");
    else if (key === "rowCountFrom") setRowCountFrom(value ?? "");
    else if (key === "rowCountTo") setRowCountTo(value ?? "");
  };

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (tableFilter && !row.table.toLowerCase().includes(tableFilter.toLowerCase())) return false;
      if (rowCountFrom && row.rowCount < Number(rowCountFrom)) return false;
      if (rowCountTo && row.rowCount > Number(rowCountTo)) return false;
      return true;
    });
  }, [data, tableFilter, rowCountFrom, rowCountTo]);

  const columns: Column<BlockedTableRow>[] = [
    {
      key: "table",
      label: "Bảng",
      filter: { type: "text", paramKey: "table", placeholder: "Tìm tên bảng..." },
      render: (value: string) => <span className="font-medium text-ink">{value}</span>,
    },
    {
      key: "rowCount",
      label: "Số dòng",
      filter: { type: "numberRange", paramKeyFrom: "rowCountFrom", paramKeyTo: "rowCountTo" },
      render: (value: number) => <span className="text-ink-muted80">{value}</span>,
    },
    {
      key: "missingKeyCounts",
      label: "Thiếu khóa chính",
      render: (value: Record<string, number>) => <span className="text-xs text-ink-muted64">{formatMissingKeys(value)}</span>,
    },
  ];

  return (
    <DataTableResponsive
      data={filteredData}
      columns={columns}
      searchable={false}
      showCountBadge={false}
      sortable={false}
      selectable={false}
      filterValues={{ table: tableFilter, rowCountFrom, rowCountTo }}
      onFilterChange={handleFilterChange}
      emptyState={{ title: "Không có bảng bị chặn", description: "Không có bảng nào đang bị chặn import." }}
      rowKey="table"
      primaryColumn="table"
      secondaryColumns={["rowCount"]}
    />
  );
}
