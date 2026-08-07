"use client";

import { ReactNode, useMemo, useState } from "react";
import DataTableHeader from "./DataTableHeader";
import DataTableRow from "./DataTableRow";
import DataTablePagination from "./DataTablePagination";
import DataTableEmpty from "./DataTableEmpty";
import DataTableBulk from "./DataTableBulk";

export type Column<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
};

export type Action<T> = {
  label: string;
  icon?: React.ReactNode;
  onClick: (row: T) => void | Promise<void>;
  variant?: "primary" | "secondary" | "danger";
  permission?: string;
  show?: (row: T) => boolean;
};

export type BulkAction<T> = {
  label: string;
  icon?: React.ReactNode;
  onClick: (rows: T[]) => void | Promise<void>;
  variant?: "primary" | "secondary" | "danger";
  permission?: string;
  confirmMessage?: string;
};

type DataTableProps<T> = {
  data: T[];
  columns: Column<T>[];
  actions?: Action<T>[];
  bulkActions?: BulkAction<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  showCountBadge?: boolean;
  sortable?: boolean;
  selectable?: boolean;
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  };
  emptyState?: {
    title: string;
    description: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  loading?: boolean;
  stickyHeader?: boolean;
  rowKey: keyof T;
  onRowClick?: (row: T) => void;
  className?: string;
  headerActions?: ReactNode;
  filterChips?: ReactNode;
  defaultSearchValue?: string;
};

export default function DataTable<T extends Record<string, any>>({
  data,
  columns,
  actions = [],
  bulkActions = [],
  searchable = true,
  searchPlaceholder = "Tìm kiếm...",
  onSearch,
  showCountBadge = true,
  sortable = true,
  selectable = true,
  pagination,
  emptyState,
  loading = false,
  stickyHeader = true,
  rowKey,
  onRowClick,
  className = "",
  headerActions,
  filterChips,
  defaultSearchValue = "",
}: DataTableProps<T>) {
  const [selectedRows, setSelectedRows] = useState<Set<any>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(data.map((row) => row[rowKey])));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id: any, checked: boolean) => {
    const next = new Set(selectedRows);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedRows(next);
  };

  const handleSort = (columnKey: string) => {
    if (!sortable) return;

    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === bVal) return 0;
      const comparison = aVal > bVal ? 1 : -1;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection]);

  const isAllSelected = data.length > 0 && selectedRows.size === data.length;
  const isSomeSelected = selectedRows.size > 0 && selectedRows.size < data.length;

  return (
    <div data-dt="root" className={`space-y-4 ${className}`}>
      <DataTableHeader
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        onSearch={onSearch}
        totalCount={pagination?.total || data.length}
        showCountBadge={showCountBadge}
        actions={headerActions}
        filterChips={filterChips}
        defaultSearchValue={defaultSearchValue}
      />

      {selectable && selectedRows.size > 0 && bulkActions.length > 0 ? (
        <DataTableBulk
          selectedCount={selectedRows.size}
          actions={bulkActions}
          selectedRows={Array.from(selectedRows).map((id) => data.find((row) => row[rowKey] === id)!)}
          onClearSelection={() => setSelectedRows(new Set())}
        />
      ) : null}

      <div
        data-dt="table-shell"
        className="overflow-hidden rounded-[28px] border border-[#e4ebf8] bg-white shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)]"
      >
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <table data-dt="table" className="w-full">
            <thead data-dt="thead" className={`border-b border-[#e8edf5] bg-[linear-gradient(135deg,#fbfcff_0%,#f4f8ff_100%)] ${stickyHeader ? "sticky top-0 z-10" : ""}`}>
              <tr>
                {selectable ? (
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(element) => {
                        if (element) element.indeterminate = isSomeSelected;
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="h-4 w-4 rounded border-2 border-[#cbd5e1] text-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </th>
                ) : null}

                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-muted48 ${
                      column.sortable && sortable ? "cursor-pointer select-none hover:bg-[#f1f5f9]" : ""
                    } ${column.align === "center" ? "text-center" : column.align === "right" ? "text-right" : ""}`}
                    style={column.width ? { width: column.width } : undefined}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center gap-2">
                      {column.label}
                      {column.sortable && sortable ? (
                        <span className="text-ink-muted48">
                          {sortColumn === column.key ? (
                            sortDirection === "asc" ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="18 15 12 9 6 15"/>
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9"/>
                              </svg>
                            )
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="18 15 12 9 6 15"/>
                              <polyline points="6 9 12 15 18 9" opacity="0.3"/>
                            </svg>
                          )}
                        </span>
                      ) : null}
                    </div>
                  </th>
                ))}

                {actions.length > 0 ? (
                  <th className="w-[220px] px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-ink-muted48">
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>

            <tbody data-dt="tbody" className="divide-y divide-[#e8edf5]">
              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                    className="px-4 py-12 text-center"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="h-5 w-5 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"/>
                      </svg>
                      <span className="text-sm text-ink-muted48">Đang tải...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}>
                    <DataTableEmpty {...emptyState} />
                  </td>
                </tr>
              ) : (
                sortedData.map((row) => (
                  <DataTableRow
                    key={row[rowKey]}
                    row={row}
                    columns={columns}
                    actions={actions}
                    selectable={selectable}
                    selected={selectedRows.has(row[rowKey])}
                    onSelect={(checked) => handleSelectRow(row[rowKey], checked)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination && !loading && data.length > 0 ? <DataTablePagination {...pagination} /> : null}
    </div>
  );
}
