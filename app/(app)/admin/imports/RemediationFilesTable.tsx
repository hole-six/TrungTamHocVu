"use client";

import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";

export type RemediationFileRow = {
  table: string;
  file: string;
  status: string;
};

export default function RemediationFilesTable({ data }: { data: RemediationFileRow[] }) {
  const columns: Column<RemediationFileRow>[] = [
    { key: "table", label: "Bảng", render: (value: string) => <span className="font-medium text-ink">{value}</span> },
    { key: "file", label: "File", render: (value: string) => <span className="text-ink-muted80">{value}</span> },
    { key: "status", label: "Trạng thái", render: (value: string) => <span className="text-ink-muted80">{value}</span> },
  ];

  return (
    <DataTableResponsive
      data={data}
      columns={columns}
      searchable={false}
      showCountBadge={false}
      sortable={false}
      selectable={false}
      emptyState={{ title: "Chưa có file remediation", description: "Chưa có file remediation nào được sinh ra." }}
      rowKey="file"
      primaryColumn="table"
      secondaryColumns={["status"]}
    />
  );
}
