"use client";

import { useMemo, useState } from "react";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";

export type RemediationFileRow = {
  table: string;
  file: string;
  status: string;
};

export default function RemediationFilesTable({ data }: { data: RemediationFileRow[] }) {
  const [fileFilter, setFileFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const statusOptions = useMemo(
    () => Array.from(new Set(data.map((row) => row.status))).sort((a, b) => a.localeCompare(b, "vi")),
    [data],
  );

  const handleFilterChange = (key: string, value: string | null) => {
    if (key === "file") setFileFilter(value ?? "");
    else if (key === "status") setStatusFilter(value ?? "");
  };

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (fileFilter && !row.file.toLowerCase().includes(fileFilter.toLowerCase()) && !row.table.toLowerCase().includes(fileFilter.toLowerCase())) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      return true;
    });
  }, [data, fileFilter, statusFilter]);

  const columns: Column<RemediationFileRow>[] = [
    { key: "table", label: "Bảng", render: (value: string) => <span className="font-medium text-ink">{value}</span> },
    {
      key: "file",
      label: "File",
      filter: { type: "text", paramKey: "file", placeholder: "Tìm bảng/file..." },
      render: (value: string) => <span className="text-ink-muted80">{value}</span>,
    },
    {
      key: "status",
      label: "Trạng thái",
      filter: {
        type: "select",
        paramKey: "status",
        placeholder: "Tất cả trạng thái",
        options: statusOptions.map((value) => ({ label: value, value })),
      },
      render: (value: string) => <span className="text-ink-muted80">{value}</span>,
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
      filterValues={{ file: fileFilter, status: statusFilter }}
      onFilterChange={handleFilterChange}
      emptyState={{ title: "Chưa có file remediation", description: "Chưa có file remediation nào được sinh ra." }}
      rowKey="file"
      primaryColumn="table"
      secondaryColumns={["status"]}
    />
  );
}
