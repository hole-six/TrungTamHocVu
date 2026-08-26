"use client";

import { ReactNode, useMemo, useState } from "react";
import DataTableHeader from "./DataTableHeader";
import DataTableRow from "./DataTableRow";
import DataTableFilterRow from "./DataTableFilterRow";
import DataTablePagination from "./DataTablePagination";
import DataTableEmpty from "./DataTableEmpty";
import DataTableBulk from "./DataTableBulk";

// Lọc theo TỪNG CỘT (hàng cố định dưới header, backend — patch qua URL searchParams,
// tái dùng đúng updateParams() mà mỗi XxxTable.tsx đã có sẵn cho search/pagination,
// không phát minh luồng fetch thứ 2). Khác `sortable` — sort vẫn client-side như cũ.
export type ColumnFilter =
  | { type: "text"; paramKey: string; placeholder?: string }
  | { type: "select"; paramKey: string; options: { label: string; value: string }[]; placeholder?: string }
  | { type: "dateRange"; paramKeyFrom: string; paramKeyTo: string }
  | { type: "numberRange"; paramKeyFrom: string; paramKeyTo: string; placeholder?: string };

export type Column<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  filter?: ColumnFilter;
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
  /** Nếu có, bấm nút này sẽ mở hộp thoại xác nhận với nội dung này trước khi gọi onClick. */
  confirmMessage?: string;
  confirmTitle?: string;
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
  /** Giá trị lọc theo cột hiện tại, keyed theo paramKey/paramKeyFrom/paramKeyTo của Column.filter. */
  filterValues?: Record<string, string>;
  /** Bắn ra khi 1 ô lọc cột đổi giá trị — value=null nghĩa là xóa param đó. */
  onFilterChange?: (paramKey: string, value: string | null, extra?: Record<string, string | null>) => void;
  /**
   * Nếu có, mỗi dòng có nút "Xem thêm" mở ra 1 dòng phụ bên dưới chứa nội dung này
   * (dùng cho các bảng cần hiện chi tiết/sửa-tại-chỗ mà không hợp để tách thành cột,
   * vd sổ quỹ — sửa thông tin phiếu, hủy phiếu ngay trong dòng thay vì phải mở trang khác).
   */
  renderExpanded?: (row: T) => ReactNode;
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
  filterValues = {},
  onFilterChange,
  renderExpanded,
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

  // Không render cả khối header nếu không có gì để hiện trong đó — tránh 1 thanh
  // trống vô nghĩa khi trang đã có sẵn ô tìm kiếm/bộ lọc riêng bên ngoài bảng
  // (searchable=false + showCountBadge=false + không headerActions/filterChips).
  const showHeaderShell = searchable || showCountBadge || !!filterChips || !!headerActions;

  return (
    <div data-dt="root" className={`space-y-4 ${className}`}>
      {showHeaderShell ? (
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
      ) : null}

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
        className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-white shadow-sm"
      >
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <table data-dt="table" className="w-full bg-white">
            <thead data-dt="thead" className={`border-b border-[#e5e7eb] bg-white ${stickyHeader ? "sticky top-0 z-10" : ""}`}>
              <tr>
                {selectable ? (
                  <th className="w-12 px-6 py-3 bg-white">
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
                    className={`px-6 py-3 text-left text-xs font-bold uppercase tracking-normal text-[#111827] bg-white ${
                      column.sortable && sortable ? "cursor-pointer select-none hover:bg-[#fafafa]" : ""
                    } ${column.align === "center" ? "text-center" : column.align === "right" ? "text-right" : ""}`}
                    style={column.width ? { width: column.width } : undefined}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center gap-2">
                      {column.label}
                      {column.sortable && sortable ? (
                        <span className="text-[#111827]">
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

                {actions.length > 0 || renderExpanded ? (
                  <th className="w-[220px] px-6 py-3 text-right text-xs font-bold uppercase tracking-normal text-[#111827] bg-white">
                    Actions
                  </th>
                ) : null}
              </tr>

              {columns.some((column) => column.filter) ? (
                <DataTableFilterRow
                  columns={columns}
                  values={filterValues}
                  onChange={onFilterChange}
                  selectable={selectable}
                  hasActionsColumn={actions.length > 0 || !!renderExpanded}
                />
              ) : null}
            </thead>

            <tbody data-dt="tbody" className="divide-y divide-[#f3f4f6] bg-white">
              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 || renderExpanded ? 1 : 0)}
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
                  <td colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 || renderExpanded ? 1 : 0)}>
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
                    renderExpanded={renderExpanded}
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
