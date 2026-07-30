"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column, Action, BulkAction } from "@/components/ui/DataTable";
import { canUpdate, canDelete } from "@/lib/server/role-matrix";
import { exportToExcel } from "@/lib/export-utils";

type Student = {
  id: string;
  studentCode: string;
  studentDisplayId?: string | null;
  fullName: string;
  phone?: string | null;
  status: string;
  branchId: string;
  enrollDate?: string | Date | null;
  leadCode?: string | null;
  currentClassName?: string | null;
  currentClassCode?: string | null;
  outstanding?: number;
  enrollmentsCount?: number;
  primaryGuardian?: {
    id: string;
    fullName: string;
    phone?: string | null;
    user?: {
      email: string;
      isActive: boolean;
    } | null;
  } | null;
};

type StudentsTableProps = {
  initialData: Student[];
  total: number;
  page: number;
  pageSize: number;
  userRole: string;
  searchQuery?: string;
};

function formatVnd(value: number | undefined) {
  return `${(value ?? 0).toLocaleString("vi-VN")}đ`;
}

export default function StudentsTable({
  initialData,
  total,
  page,
  pageSize,
  userRole,
  searchQuery = "",
}: StudentsTableProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  const exportRows = (rows: Student[]) => {
    exportToExcel(
      rows.map((row) => ({
        studentCode: row.studentCode,
        studentDisplayId: row.studentDisplayId ?? "",
        fullName: row.fullName,
        leadCode: row.leadCode ?? "",
        guardianName: row.primaryGuardian?.fullName ?? "",
        guardianPortal: row.primaryGuardian?.user?.email ?? "",
        currentClass: row.currentClassName ?? "",
        phone: row.phone ?? "",
        outstanding: formatVnd(row.outstanding),
        enrollments: row.enrollmentsCount ?? 0,
        enrollDate: row.enrollDate ? new Date(row.enrollDate).toLocaleDateString("vi-VN") : "",
        status: row.status === "ACTIVE" ? "Đang học" : "Đã nghỉ",
      })),
      [
        { key: "studentCode", label: "Mã học viên" },
        { key: "studentDisplayId", label: "Mã hiển thị" },
        { key: "fullName", label: "Họ và tên" },
        { key: "leadCode", label: "Lead gốc" },
        { key: "guardianName", label: "Phụ huynh chính" },
        { key: "guardianPortal", label: "Portal phụ huynh" },
        { key: "currentClass", label: "Lớp hiện tại" },
        { key: "phone", label: "Số điện thoại" },
        { key: "outstanding", label: "Công nợ" },
        { key: "enrollments", label: "Số lớp" },
        { key: "enrollDate", label: "Ngày nhập học" },
        { key: "status", label: "Trạng thái" },
      ],
      "hoc-vien",
      "HocVien"
    );
  };

  const columns: Column<Student>[] = [
    {
      key: "studentCode",
      label: "Mã HV",
      sortable: true,
      width: "140px",
      render: (value, row) => (
        <div className="leading-tight">
          <span className="font-mono text-sm font-semibold text-primary">{row.studentDisplayId ?? value}</span>
          {row.studentDisplayId ? <p className="text-[11px] text-ink-muted48">{value}</p> : null}
          {row.leadCode ? <p className="text-[11px] text-amber-700">Lead {row.leadCode}</p> : null}
        </div>
      ),
    },
    {
      key: "fullName",
      label: "Học viên",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-600 text-sm font-bold text-white shadow-md">
            {value.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{value}</p>
            {row.phone ? <p className="text-xs font-mono text-ink-muted48">{row.phone}</p> : null}
            {row.currentClassName ? (
              <p className="text-xs text-primary">
                {row.currentClassCode ? `[${row.currentClassCode}] ` : ""}
                {row.currentClassName}
              </p>
            ) : (
              <p className="text-xs text-ink-muted48">Chưa ghi danh lớp</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "primaryGuardian",
      label: "Phụ huynh / Portal",
      render: (value) =>
        value ? (
          <div>
            <p className="text-sm font-medium text-ink">{value.fullName}</p>
            <p className="text-xs text-ink-muted48">{value.phone ?? "Chưa có SĐT"}</p>
            <p className={`text-xs ${value.user?.isActive ? "text-sky-700" : "text-ink-muted48"}`}>
              {value.user ? value.user.email : "Chưa cấp portal"}
            </p>
          </div>
        ) : (
          <span className="text-xs text-ink-muted48">Chưa liên kết phụ huynh</span>
        ),
    },
    {
      key: "outstanding",
      label: "Công nợ",
      sortable: true,
      align: "center",
      render: (value) => (
        <span className={`inline-flex rounded-lg px-2 py-1 text-xs font-bold ${(value ?? 0) > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
          {formatVnd(value)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Trạng thái",
      align: "center",
      render: (value) => {
        const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
          ACTIVE: { label: "Đang học", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "●" },
          LEFT: { label: "Đã nghỉ", color: "bg-red-100 text-red-700 border-red-200", icon: "●" },
        };
        const config = statusConfig[value] || statusConfig.ACTIVE;
        return (
          <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold ${config.color}`}>
            <span>{config.icon}</span>
            {config.label}
          </span>
        );
      },
    },
  ];

  const actions: Action<Student>[] = [
    {
      label: "Xem",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      onClick: (row) => router.push(`/students/${row.id}`),
      variant: "primary",
    },
  ];

  if (canUpdate("students", userRole)) {
    actions.push({
      label: "Sửa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      onClick: (row) => router.push(`/students/${row.id}`),
      variant: "secondary",
    });
  }

  if (canDelete("students", userRole)) {
    actions.push({
      label: "Xóa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
      onClick: async (row) => {
        if (confirm(`Xóa học viên ${row.fullName}?`)) {
          await fetch(`/api/students/${row.id}`, { method: "DELETE" });
          router.refresh();
        }
      },
      variant: "danger",
      show: (row) => row.status !== "ACTIVE",
    });
  }

  const bulkActions: BulkAction<Student>[] = [];

  if (canDelete("students", userRole)) {
    bulkActions.push(
      {
        label: "Xuất Excel",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        ),
        onClick: async (rows) => exportRows(rows),
        variant: "primary",
      },
      {
        label: "Xóa",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        ),
        onClick: async (rows) => {
          await Promise.all(rows.map((row) => fetch(`/api/students/${row.id}`, { method: "DELETE" })));
          router.refresh();
        },
        variant: "danger",
        confirmMessage: "Bạn có chắc muốn xóa các học viên đã chọn? Thao tác này không thể hoàn tác.",
      }
    );
  }

  const handleSearch = async (query: string) => {
    setLoading(true);
    const response = await fetch(`/api/students?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
    const result = await response.json();
    setData(result.items);
    setLoading(false);
    router.push(`/students?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
  };

  return (
    <DataTableResponsive
      data={data}
      columns={columns}
      actions={actions}
      bulkActions={bulkActions}
      title="Danh sách học viên"
      description="Tra cứu nhanh lead gốc, phụ huynh chính, lớp đang học và công nợ ngay trên cùng một bảng."
      searchable
      searchPlaceholder="Tìm theo tên, mã học viên, lead, phụ huynh, số điện thoại..."
      onSearch={handleSearch}
      defaultSearchValue={searchQuery}
      sortable
      selectable={canUpdate("students", userRole)}
      pagination={{
        total,
        page,
        pageSize,
        onPageChange: (newPage) => router.push(`/students?page=${newPage}&pageSize=${pageSize}`),
        onPageSizeChange: (newSize) => router.push(`/students?page=1&pageSize=${newSize}`),
      }}
      emptyState={{
        title: "Chưa có học viên",
        description: "Bắt đầu bằng cách thêm học viên đầu tiên vào hệ thống.",
        action: {
          label: "Thêm học viên",
          onClick: () => router.push("/students/new"),
        },
      }}
      loading={loading}
      stickyHeader
      rowKey="id"
      onRowClick={(row) => router.push(`/students/${row.id}`)}
      mobileConfig={{
        primaryColumn: "fullName",
        secondaryColumns: ["studentCode", "status"],
      }}
    />
  );
}
