"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Column, Action } from "./DataTable";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

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
  primaryColumn: string;
  secondaryColumns?: string[];
  className?: string;
  defaultSearchValue?: string;
  /** Xem mô tả ở DataTable.tsx — cùng 1 nội dung được dùng cho cả bản desktop lẫn mobile. */
  renderExpanded?: (row: T) => ReactNode;
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
  defaultSearchValue = "",
  renderExpanded,
}: DataTableMobileProps<T>) {
  const [searchQuery, setSearchQuery] = useState(defaultSearchValue);
  const [expandedRows, setExpandedRows] = useState<Set<any>>(new Set());
  const [pendingAction, setPendingAction] = useState<{ row: T; action: Action<T> } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  async function handleActionClick(row: T, action: Action<T>) {
    if (action.confirmMessage) {
      setPendingAction({ row, action });
      return;
    }
    await action.onClick(row);
  }

  async function handleConfirm() {
    if (!pendingAction) return;
    setConfirmLoading(true);
    try {
      await pendingAction.action.onClick(pendingAction.row);
      setPendingAction(null);
    } finally {
      setConfirmLoading(false);
    }
  }

  useEffect(() => {
    setSearchQuery(defaultSearchValue);
  }, [defaultSearchValue]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

  const toggleRowExpand = (id: any) => {
    const next = new Set(expandedRows);
    if (expandedRows.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedRows(next);
  };

  const getPrimaryColumn = () => columns.find((column) => column.key === primaryColumn);
  const getSecondaryColumns = () => columns.filter((column) => secondaryColumns.includes(column.key));
  const getOtherColumns = () =>
    columns.filter((column) => column.key !== primaryColumn && !secondaryColumns.includes(column.key));

  return (
    <div className={`space-y-3 ${className}`}>
      {searchable ? (
        <div className="relative">
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(event) => handleSearch(event.target.value)}
            className="input pl-10"
          />
          <svg
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2"
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
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="animate-pulse rounded-xl border p-4"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-primary)",
              }}
            >
              <div className="mb-2 h-5 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && data.length === 0 ? (
        <div
          className="rounded-xl border p-8 text-center"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-primary)",
          }}
        >
          <div className="mx-auto mb-3 h-12 w-12" style={{ color: "var(--text-disabled)" }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="mb-1 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            {emptyState?.title || "Không có dữ liệu"}
          </p>
          <p className="mb-4 text-xs" style={{ color: "var(--text-muted)" }}>
            {emptyState?.description || "Chưa có dữ liệu nào được thêm"}
          </p>
          {emptyState?.action ? (
            <button onClick={emptyState.action.onClick} className="btn-primary-sm" type="button">
              {emptyState.action.label}
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && data.length > 0 ? (
        <div className="space-y-3">
          {data.map((row) => {
            const isExpanded = expandedRows.has(row[rowKey]);
            const primary = getPrimaryColumn();
            const secondary = getSecondaryColumns();
            const other = getOtherColumns();
            const hasMore = other.length > 0 || !!renderExpanded;

            return (
              <div
                key={row[rowKey]}
                className="overflow-hidden rounded-xl border transition-all duration-200"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-primary)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div
                  className="p-4"
                  onClick={() => onRowClick?.(row)}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {primary ? (
                    <div className="mb-2">
                      <div className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                        {primary.render ? primary.render(row[primary.key], row) : row[primary.key]}
                      </div>
                    </div>
                  ) : null}

                  {secondary.length > 0 ? (
                    <div className="space-y-1">
                      {secondary.map((column) => (
                        <div key={column.key} className="flex items-center gap-2">
                          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                            {column.label}:
                          </span>
                          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                            {column.render ? column.render(row[column.key], row) : row[column.key]}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {hasMore ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
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
                  ) : null}
                </div>

                {isExpanded && renderExpanded ? (
                  <div className="border-t px-4 py-3" style={{ borderColor: "var(--border-primary)" }}>
                    {renderExpanded(row)}
                  </div>
                ) : isExpanded && hasMore ? (
                  <div className="space-y-2 border-t px-4 py-3" style={{ borderColor: "var(--border-primary)" }}>
                    {other.map((column) => (
                      <div key={column.key} className="flex items-start justify-between gap-3">
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                          {column.label}
                        </span>
                        <span className="text-right text-sm" style={{ color: "var(--text-secondary)" }}>
                          {column.render ? column.render(row[column.key], row) : row[column.key] || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {actions.length > 0 ? (
                  <div
                    className="flex items-center gap-2 border-t px-4 py-2"
                    style={{ borderColor: "var(--border-primary)", backgroundColor: "var(--bg-muted)" }}
                  >
                    {actions
                      .filter((action) => !action.show || action.show(row))
                      .map((action, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleActionClick(row, action);
                          }}
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                            action.variant === "danger"
                              ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
                              : action.variant === "primary"
                                ? "bg-primary text-white hover:bg-primary-focus"
                                : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                          }`}
                        >
                          {action.icon ? <span className="h-4 w-4">{action.icon}</span> : null}
                          <span>{action.label}</span>
                        </button>
                      ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {pagination && !loading && data.length > 0 ? (
        <div className="flex items-center justify-between px-2 py-3">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Trang {pagination.page} / {Math.ceil(pagination.total / pagination.pageSize)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="btn-ghost-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
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
      ) : null}

      <ConfirmDialog
        open={!!pendingAction}
        title={pendingAction?.action.confirmTitle || "Xác nhận thao tác"}
        description={pendingAction?.action.confirmMessage}
        confirmLabel={pendingAction?.action.label}
        tone={pendingAction?.action.variant === "danger" ? "danger" : "default"}
        loading={confirmLoading}
        onConfirm={handleConfirm}
        onClose={() => {
          if (!confirmLoading) setPendingAction(null);
        }}
      />
    </div>
  );
}
