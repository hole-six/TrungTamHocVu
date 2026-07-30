"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column, Action, BulkAction } from "@/components/ui/DataTable";
import { canView, canUpdate, canDelete } from "@/lib/server/role-matrix";
import { LEAD_STATUS_LABEL } from "@/lib/server/lead-rules";
import { exportToExcel } from "@/lib/export-utils";

type Lead = {
  id: string;
  leadCode: string;
  fullName: string;
  phone?: string | null;
  status: string;
  dob?: string | Date | null;
  guardianName?: string | null;
  guardianPortalEmail?: string | null;
  guardianPortalActive?: boolean;
  source?: string | null;
  convertedStudentCode?: string | null;
  convertedClassName?: string | null;
  outstanding?: number | null;
};

type LeadsTableProps = {
  initialData: Lead[];
  total: number;
  page: number;
  pageSize: number;
  userRole: string;
  searchQuery?: string;
};

const LEAD_STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  NEW: { label: LEAD_STATUS_LABEL.NEW, color: "bg-blue-100 text-blue-700 border-blue-200", icon: "●" },
  CONTACTING: { label: LEAD_STATUS_LABEL.CONTACTING, color: "bg-cyan-100 text-cyan-700 border-cyan-200", icon: "●" },
  APPOINTED: { label: LEAD_STATUS_LABEL.APPOINTED, color: "bg-purple-100 text-purple-700 border-purple-200", icon: "●" },
  TESTED: { label: LEAD_STATUS_LABEL.TESTED, color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: "●" },
  QUALIFIED: { label: LEAD_STATUS_LABEL.QUALIFIED, color: "bg-amber-100 text-amber-700 border-amber-200", icon: "●" },
  UNQUALIFIED: { label: LEAD_STATUS_LABEL.UNQUALIFIED, color: "bg-slate-100 text-slate-700 border-slate-200", icon: "●" },
  ENROLLED: { label: LEAD_STATUS_LABEL.ENROLLED, color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "●" },
  LOST: { label: LEAD_STATUS_LABEL.LOST, color: "bg-red-100 text-red-700 border-red-200", icon: "●" },
};

function calculateAge(dob?: string | Date | null): number | null {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

function formatVnd(value: number | null | undefined) {
  return `${(value ?? 0).toLocaleString("vi-VN")}đ`;
}

export default function LeadsTable({
  initialData,
  total,
  page,
  pageSize,
  userRole,
  searchQuery = "",
}: LeadsTableProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  const exportRows = (rows: Lead[]) => {
    exportToExcel(
      rows.map((row) => ({
        leadCode: row.leadCode,
        fullName: row.fullName,
        guardianName: row.guardianName ?? "",
        guardianPortal: row.guardianPortalEmail ?? "",
        phone: row.phone ?? "",
        age: calculateAge(row.dob) ?? "",
        source: row.source ?? "",
        convertedStudent: row.convertedStudentCode ?? "",
        convertedClass: row.convertedClassName ?? "",
        outstanding: row.outstanding !== null && row.outstanding !== undefined ? formatVnd(row.outstanding) : "",
        status: LEAD_STATUS_LABEL[row.status as keyof typeof LEAD_STATUS_LABEL] ?? row.status,
      })),
      [
        { key: "leadCode", label: "Mã lead" },
        { key: "fullName", label: "Họ và tên" },
        { key: "guardianName", label: "Phụ huynh" },
        { key: "guardianPortal", label: "Portal phụ huynh" },
        { key: "phone", label: "Số điện thoại" },
        { key: "age", label: "Tuổi" },
        { key: "source", label: "Nguồn" },
        { key: "convertedStudent", label: "Mã học viên" },
        { key: "convertedClass", label: "Lớp đã vào" },
        { key: "outstanding", label: "Công nợ" },
        { key: "status", label: "Trạng thái" },
      ],
      "crm-tuyen-sinh",
      "CRM"
    );
  };

  const columns: Column<Lead>[] = [
    {
      key: "leadCode",
      label: "Mã lead",
      sortable: true,
      width: "120px",
      render: (value) => <span className="font-mono text-sm font-semibold text-primary">{value}</span>,
    },
    {
      key: "fullName",
      label: "Lead / phụ huynh",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-600 text-sm font-bold text-white shadow-md">
            {value.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{value}</p>
            {row.guardianName ? <p className="text-xs text-ink-muted48">PH: {row.guardianName}</p> : null}
            <p className={`text-xs ${row.guardianPortalEmail ? (row.guardianPortalActive ? "text-sky-700" : "text-ink-muted48") : "text-ink-muted48"}`}>
              {row.guardianPortalEmail ?? "Chưa cấp portal"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "source",
      label: "Nguồn / chuyển đổi",
      render: (value, row) => (
        <div>
          <p className="text-sm text-ink-muted64">{value ?? "—"}</p>
          <p className="text-xs text-primary">
            {row.convertedStudentCode ? `${row.convertedStudentCode} · ${row.convertedClassName ?? "Chưa có lớp"}` : "Chưa convert"}
          </p>
        </div>
      ),
    },
    {
      key: "outstanding",
      label: "Công nợ sau convert",
      align: "center",
      render: (value) =>
        value !== null && value !== undefined ? (
          <span className={`inline-flex rounded-lg px-2 py-1 text-xs font-bold ${value > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
            {formatVnd(value)}
          </span>
        ) : (
          <span className="text-xs text-ink-muted48">Chưa phát sinh</span>
        ),
    },
    {
      key: "status",
      label: "Trạng thái",
      align: "center",
      render: (value) => {
        const config = LEAD_STATUS_CONFIG[value] || LEAD_STATUS_CONFIG.NEW;
        return (
          <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold ${config.color}`}>
            <span>{config.icon}</span>
            {config.label}
          </span>
        );
      },
    },
  ];

  const actions: Action<Lead>[] = [
    {
      label: "Xem",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      onClick: (row) => router.push(`/leads/${row.id}`),
      variant: "primary",
    },
    {
      label: "Sửa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      onClick: (row) => router.push(`/leads/${row.id}`),
      variant: "secondary",
      show: () => canUpdate("leads", userRole),
    },
  ];

  if (canDelete("leads", userRole)) {
    actions.push({
      label: "Xóa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
      onClick: async (row) => {
        if (confirm(`Xóa lead ${row.fullName}?`)) {
          await fetch(`/api/leads/${row.id}`, { method: "DELETE" });
          router.refresh();
        }
      },
      variant: "danger",
    });
  }

  const bulkActions: BulkAction<Lead>[] = [];

  if (canView("leads", userRole)) {
    bulkActions.push({
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
    });
  }

  if (canUpdate("leads", userRole)) {
    bulkActions.push({
      label: "Đánh dấu đang liên hệ",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      ),
      onClick: async (rows) => {
        await Promise.all(
          rows.map((row) =>
            fetch(`/api/leads/${row.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "CONTACTING" }),
            })
          )
        );
        router.refresh();
      },
      variant: "secondary",
      confirmMessage: "Bạn có chắc muốn chuyển các lead đã chọn sang trạng thái đang liên hệ?",
    });
  }

  if (canDelete("leads", userRole)) {
    bulkActions.push({
      label: "Xóa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
      onClick: async (rows) => {
        await Promise.all(rows.map((row) => fetch(`/api/leads/${row.id}`, { method: "DELETE" })));
        router.refresh();
      },
      variant: "danger",
      confirmMessage: "Bạn có chắc muốn xóa lead? Thao tác này không thể hoàn tác.",
    });
  }

  const handleSearch = async (query: string) => {
    setLoading(true);
    const response = await fetch(`/api/leads?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
    const result = await response.json();
    setData(result.items);
    setLoading(false);
    router.push(`/leads?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
  };

  return (
    <DataTableResponsive
      data={data}
      columns={columns}
      actions={actions}
      bulkActions={bulkActions}
      title="Pipeline tuyển sinh"
      description="Theo dõi lead theo nguồn vào, phụ huynh, trạng thái portal và kết quả convert sang học viên thật."
      searchable
      searchPlaceholder="Tìm theo tên, mã lead, phụ huynh, mã học viên..."
      onSearch={handleSearch}
      defaultSearchValue={searchQuery}
      sortable
      selectable
      pagination={{
        total,
        page,
        pageSize,
        onPageChange: (newPage) => router.push(`/leads?page=${newPage}&pageSize=${pageSize}`),
        onPageSizeChange: (newSize) => router.push(`/leads?page=1&pageSize=${newSize}`),
      }}
      emptyState={{
        title: "Chưa có lead",
        description: "Bắt đầu bằng cách thêm lead đầu tiên vào hệ thống CRM.",
        action: {
          label: "Thêm lead",
          onClick: () => router.push("/leads/new"),
        },
      }}
      loading={loading}
      stickyHeader
      rowKey="id"
      onRowClick={(row) => router.push(`/leads/${row.id}`)}
      mobileConfig={{
        primaryColumn: "fullName",
        secondaryColumns: ["leadCode", "status"],
      }}
    />
  );
}
