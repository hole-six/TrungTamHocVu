"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import type { Column, Action, BulkAction } from "@/components/ui/DataTable";
import { isManagementRole, isTeachingStaffRole, isFrontDeskRole } from "@/lib/client-roles";
import { exportToExcel } from "@/lib/export-utils";

type GuardianChild = {
  id: string;
  fullName: string;
  leadCode?: string | null;
  className?: string | null;
  outstanding: number;
};

type Guardian = {
  id: string;
  fullName: string;
  phone?: string | null;
  address?: string | null;
  portalEmail?: string | null;
  portalActive?: boolean;
  leads?: Array<{ id: string; leadCode: string }>;
  children?: GuardianChild[];
  _count?: {
    leads: number;
    students: number;
  };
};

type GuardiansTableProps = {
  initialData: Guardian[];
  total: number;
  page: number;
  pageSize: number;
  userRole: string;
};

function formatVnd(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

export default function GuardiansTable({
  initialData,
  total,
  page,
  pageSize,
  userRole,
}: GuardiansTableProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  const exportRows = (rows: Guardian[]) => {
    exportToExcel(
      rows.map((row) => ({
        fullName: row.fullName,
        phone: row.phone ?? "",
        portalEmail: row.portalEmail ?? "",
        portalStatus: row.portalEmail ? (row.portalActive ? "Đang hoạt động" : "Đã thu hồi") : "Chưa cấp",
        address: row.address ?? "",
        leads: row._count?.leads ?? 0,
        students: row._count?.students ?? 0,
        firstStudent: row.children?.[0]?.fullName ?? "",
        firstClass: row.children?.[0]?.className ?? "",
      })),
      [
        { key: "fullName", label: "Họ và tên" },
        { key: "phone", label: "Số điện thoại" },
        { key: "portalEmail", label: "Portal phụ huynh" },
        { key: "portalStatus", label: "Trạng thái portal" },
        { key: "address", label: "Địa chỉ" },
        { key: "leads", label: "Số lead" },
        { key: "students", label: "Số học viên" },
        { key: "firstStudent", label: "Con đang theo dõi" },
        { key: "firstClass", label: "Lớp hiện tại" },
      ],
      "phu-huynh",
      "PhuHuynh"
    );
  };

  const columns: Column<Guardian>[] = [
    {
      key: "fullName",
      label: "Phụ huynh",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-sm font-bold text-white shadow-md">
            {value.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{value}</p>
            <p className="text-xs font-mono text-ink-muted48">{row.phone ?? "Chưa có SĐT"}</p>
            {row.leads?.[0] ? <p className="text-xs text-amber-700">Lead gần nhất: {row.leads[0].leadCode}</p> : null}
          </div>
        </div>
      ),
    },
    {
      key: "portalEmail",
      label: "Portal",
      render: (value, row) => (
        <div>
          <p className="text-sm font-medium text-ink">{value ?? "Chưa cấp portal"}</p>
          <p className={`text-xs ${value ? (row.portalActive ? "text-sky-700" : "text-ink-muted48") : "text-ink-muted48"}`}>
            {value ? (row.portalActive ? "Đang hoạt động" : "Đã thu hồi") : "Cần cấp để phụ huynh xem portal"}
          </p>
        </div>
      ),
    },
    {
      key: "children",
      label: "Học viên liên quan",
      render: (value) =>
        value && value.length > 0 ? (
          <div className="space-y-1">
            {value.slice(0, 2).map((child: GuardianChild) => (
              <div key={child.id}>
                <p className="text-sm font-medium text-ink">{child.fullName}</p>
                <p className="text-xs text-ink-muted48">
                  {child.leadCode ?? "Không gắn lead"} · {child.className ?? "Chưa có lớp"} · Nợ {formatVnd(child.outstanding)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-xs text-ink-muted48">Chưa liên kết học viên</span>
        ),
    },
    {
      key: "_count",
      label: "Số lượng",
      align: "center",
      render: (value) => (
        <div className="space-y-1 text-xs font-bold">
          <div className="inline-flex rounded-lg bg-pink-50 px-2 py-1 text-pink-700">Lead {value?.leads || 0}</div>
          <div className="inline-flex rounded-lg bg-violet-50 px-2 py-1 text-violet-700">HV {value?.students || 0}</div>
        </div>
      ),
    },
  ];

  const actions: Action<Guardian>[] = [
    {
      label: "Xem",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      ),
      onClick: (row) => router.push(`/guardians/${row.id}`),
      variant: "primary",
    },
  ];

  if (!isTeachingStaffRole(userRole)) {
    actions.push({
      label: "Sửa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      ),
      onClick: (row) => router.push(`/guardians/${row.id}`),
      variant: "secondary",
    });
  }

  if (isManagementRole(userRole)) {
    actions.push({
      label: "Xóa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      ),
      onClick: async (row) => {
        if (confirm(`Xóa phụ huynh ${row.fullName}?`)) {
          await fetch(`/api/guardians/${row.id}`, { method: "DELETE" });
          router.refresh();
        }
      },
      variant: "danger",
      show: (row) => (row._count?.leads || 0) === 0 && (row._count?.students || 0) === 0,
    });
  }

  const bulkActions: BulkAction<Guardian>[] = [];

  if (isFrontDeskRole(userRole)) {
    bulkActions.push({
      label: "Xuất Excel",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      ),
      onClick: async (rows) => exportRows(rows),
      variant: "primary",
    });
  }

  if (isManagementRole(userRole)) {
    bulkActions.push({
      label: "Xóa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      ),
      onClick: async (rows) => {
        await Promise.all(rows.map((row) => fetch(`/api/guardians/${row.id}`, { method: "DELETE" })));
        router.refresh();
      },
      variant: "danger",
      confirmMessage: "Bạn có chắc muốn xóa phụ huynh? Thao tác này không thể hoàn tác.",
    });
  }

  const handleSearch = async (query: string) => {
    setLoading(true);
    const res = await fetch(`/api/guardians?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
    const result = await res.json();
    setData(result.items);
    setLoading(false);
    router.push(`/guardians?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
  };

  return (
    <DataTable
      data={data}
      columns={columns}
      actions={actions}
      bulkActions={bulkActions}
      searchable
      searchPlaceholder="Tìm theo phụ huynh, email portal, học viên, lead..."
      onSearch={handleSearch}
      sortable
      selectable={!isTeachingStaffRole(userRole)}
      pagination={{
        total,
        page,
        pageSize,
        onPageChange: (newPage) => router.push(`/guardians?page=${newPage}&pageSize=${pageSize}`),
        onPageSizeChange: (newSize) => router.push(`/guardians?page=1&pageSize=${newSize}`),
      }}
      emptyState={{
        title: "Chưa có phụ huynh",
        description: "Phụ huynh thường được tạo tự động khi thêm lead hoặc học viên.",
        action: !isTeachingStaffRole(userRole)
          ? {
              label: "Thêm phụ huynh",
              onClick: () => router.push("/guardians/new"),
            }
          : undefined,
      }}
      loading={loading}
      stickyHeader
      rowKey="id"
      onRowClick={(row) => router.push(`/guardians/${row.id}`)}
    />
  );
}
