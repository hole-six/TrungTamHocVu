"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
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
  title?: string;
  description?: string;
  headerActions?: ReactNode;
  defaultSearchValue?: string;
  mobileConfig?: {
    primaryColumn: string;
    secondaryColumns?: string[];
  };
  mobileBreakpoint?: number;
};

export default function DataTableResponsive<T extends Record<string, any>>({
  mobileConfig,
  mobileBreakpoint = 768,
  ...props
}: DataTableResponsiveProps<T>) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const checkMobile = () => {
      setIsMobile(window.innerWidth < mobileBreakpoint);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [mobileBreakpoint]);

  if (!mounted) {
    return <DataTable {...props} />;
  }

  const primaryColumn = mobileConfig?.primaryColumn || props.columns[0]?.key;
  const secondaryColumns = mobileConfig?.secondaryColumns || props.columns.slice(1, 3).map((column) => column.key);

  if (isMobile) {
    return (
      <DataTableMobile
        data={props.data}
        columns={props.columns}
        actions={props.actions}
        searchable={props.searchable}
        searchPlaceholder={props.searchPlaceholder}
        onSearch={props.onSearch}
        pagination={props.pagination}
        emptyState={props.emptyState}
        loading={props.loading}
        rowKey={props.rowKey}
        onRowClick={props.onRowClick}
        primaryColumn={primaryColumn}
        secondaryColumns={secondaryColumns}
        className={props.className}
        defaultSearchValue={props.defaultSearchValue}
      />
    );
  }

  return <DataTable {...props} />;
}
