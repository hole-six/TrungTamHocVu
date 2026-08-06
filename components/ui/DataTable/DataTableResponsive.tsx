"use client";

import { ReactNode } from "react";
import DataTable, { Column, Action, BulkAction } from "./DataTable";
import DataTableMobile from "./DataTableMobile";

type DataTableResponsiveProps<T> = {
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
  // Mobile-specific props
  primaryColumn: string;
  secondaryColumns?: string[];
};

/**
 * DataTableResponsive - Responsive wrapper that shows:
 * - Desktop table (DataTable) on md+ screens
 * - Mobile card view (DataTableMobile) on mobile screens
 */
export default function DataTableResponsive<T extends Record<string, any>>({
  primaryColumn,
  secondaryColumns = [],
  ...props
}: DataTableResponsiveProps<T>) {
  return (
    <>
      {/* Desktop Table - Hidden on mobile */}
      <div className="hidden md:block">
        <DataTable {...props} />
      </div>

      {/* Mobile Card View - Hidden on desktop */}
      <div className="block md:hidden">
        <DataTableMobile
          {...props}
          primaryColumn={primaryColumn}
          secondaryColumns={secondaryColumns}
        />
      </div>
    </>
  );
}
