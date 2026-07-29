"use client";

import { useState } from "react";
import { Column, Action } from "./DataTable";

type DataTableMobileProps<T> = {
  data: T[];
  columns: Column<T>[];
  actions?: Action<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
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
  rowKey: keyof T;
  onRowClick?: (row: T) => void;
  primaryColumn: string; // Key of the main column to display prominently
  secondaryColumns?: string[]; // Keys of columns to show below primary
  className?: string;
};

export default function DataTableMobile<T extends Record<string, any>>({
  data,
  columns,
  actions = [],
  searchable = true,
  searchPlaceholder = "Tìm kiếm...",
  onSearch,
  pagination,
  emptyState,
  loading = false,
  rowKey,
  onRowClick,
  primaryColumn,
  secondaryColumns = [],
  className = "",
}: DataTableMobileProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<any>>(new Set());

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

  const toggleRowExpand = (id: any) => {
    const newExpanded = new Set(expandedRows);
    if (expandedRows.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getPrimaryColumn = () => columns.find((col) => col.key === primaryColumn);
  const getSecondaryColumns = () =>
    columns.filter((col) => secondaryColumns.includes(col.key));
  const getOtherColumns = () =>
    columns.filter(
      (col) => col.key !== primaryColumn && !secondaryColumns.includes(col.key)
    );

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search bar */}
      {searchable && (
        <div className="relative">
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="input pl-10"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5"
            style={{ color: "var(--text-muted)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border p-4 animate-pulse"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-primary)",
              }}
            >
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && data.length === 0 && (
        <div
          className="rounded-xl border p-8 text-center"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-primary)",
          }}
        >
          <div className="mx-auto h-12 w-12 mb-3" style={{ color: "var(--text-disabled)" }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
            {emptyState?.title || "Không có dữ liệu"}
          </p>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            {emptyState?.description || "Chưa có dữ liệu nào được thêm"}
          </p>
          {emptyState?.action && (
            <button onClick={emptyState.action.onClick} className="btn-primary-sm">
              {emptyState.action.label}
            </button>
          )}
        </div>
      )}

      {/* Card list */}
      {!loading && data.length > 0 && (
        <div className="space-y-3">
          {data.map((row) => {
            const isExpanded = expandedRows.has(row[rowKey]);
            const primaryCol = getPrimaryColumn();
            const secondaryCols = getSecondaryColumns();
            const otherCols = getOtherColumns();
            const hasMore = otherCols.length > 0;

            return (
              <div
                key={row[rowKey]}
                className="rounded-xl border overflow-hidden transition-all duration-200"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-primary)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {/* Main content - always visible */}
                <div
                  className="p-4"
                  onClick={() => onRowClick?.(row)}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {/* Primary value */}
                  {primaryCol && (
                    <div className="mb-2">
                      <div className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                        {primaryCol.render
                          ? primaryCol.render(row[primaryCol.key], row)
                          : row[primaryCol.key]}
                      </div>
                    </div>
                  )}

                  {/* Secondary values */}
                  {secondaryCols.length > 0 && (
                    <div className="space-y-1">
                      {secondaryCols.map((col) => (
                        <div key={col.key} className="flex items-center gap-2">
                          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                            {col.label}:
                          </span>
                          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                            {col.render ? col.render(row[col.key], row) : row[col.key]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Expand/Collapse button */}
                  {hasMore && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRowExpand(row[rowKey]);
                      }}
                      className="mt-3 flex items-center gap-1 text-xs font-medium text-primary"
                    >
                      <span>{isExpanded ? "Thu gọn" : "Xem thêm"}</span>
                      <svg
                        className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Expanded content */}
                {isExpanded && hasMore && (
                  <div
                    className="border-t px-4 py-3 space-y-2"
                    style={{ borderColor: "var(--border-primary)" }}
                  >
                    {otherCols.map((col) => (
                      <div key={col.key} className="flex items-start justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide shrink-0" style={{ color: "var(--text-muted)" }}>
                          {col.label}
                        </span>
                        <span className="text-sm text-right" style={{ color: "var(--text-secondary)" }}>
                          {col.render ? col.render(row[col.key], row) : row[col.key] || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                {actions.length > 0 && (
                  <div
                    className="border-t px-4 py-2 flex items-center gap-2"
                    style={{ borderColor: "var(--border-primary)", backgroundColor: "var(--bg-muted)" }}
                  >
                    {actions
                      .filter((action) => !action.show || action.show(row))
                      .map((action, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            action.onClick(row);
                          }}
                          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                            action.variant === "danger"
                              ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
                              : action.variant === "primary"
                              ? "bg-primary text-white hover:bg-primary-focus"
                              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          }`}
                        >
                          {action.icon && <span className="w-4 h-4">{action.icon}</span>}
                          <span>{action.label}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && !loading && data.length > 0 && (
        <div className="flex items-center justify-between px-2 py-3">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Trang {pagination.page} / {Math.ceil(pagination.total / pagination.pageSize)}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="btn-ghost-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
              className="btn-ghost-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
