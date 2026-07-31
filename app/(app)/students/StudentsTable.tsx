"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Action, BulkAction, Column } from "@/components/ui/DataTable";
import AssignEnrollmentForm from "@/components/students/AssignEnrollmentForm";
import { exportToExcel } from "@/lib/export-utils";
import { canDelete, canUpdate } from "@/lib/server/role-matrix";

type Student = {
  id: string;
  studentCode: string;
  studentDisplayId?: string | null;
  fullName: string;
  phone?: string | null;
  dob?: string | Date | null;
  address?: string | null;
  referredBy?: string | null;
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

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [assigningStudent, setAssigningStudent] = useState<Student | null>(null);

  const unassignedStudents = useMemo(
    () => initialData.filter((student) => !student.currentClassName),
    [initialData],
  );
  const firstUnassignedStudent = unassignedStudents[0] ?? null;

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const exportRows = (rows: Student[]) => {
    exportToExcel(
      rows.map((row) => ({
        studentDisplayId: row.studentDisplayId ?? row.studentCode,
        studentCode: row.studentCode,
        leadCode: row.leadCode ?? "",
        fullName: row.fullName,
        studentPhone: row.phone ?? "",
        dob: formatDate(row.dob),
        enrollDate: formatDate(row.enrollDate),
        currentClassCode: row.currentClassCode ?? "",
        currentClassName: row.currentClassName ?? "",
        enrollmentsCount: row.enrollmentsCount ?? 0,
        guardianName: row.primaryGuardian?.fullName ?? "",
        guardianPhone: row.primaryGuardian?.phone ?? "",
        guardianPortal: row.primaryGuardian?.user?.email ?? "",
        guardianPortalStatus: row.primaryGuardian?.user
          ? row.primaryGuardian.user.isActive
            ? "Đang hoạt động"
            : "Đã thu hồi"
          : "Chưa cấp",
        referredBy: row.referredBy ?? "",
        address: row.address ?? "",
        outstanding: formatVnd(row.outstanding),
        status: row.status === "ACTIVE" ? "Đang học" : "Đã nghỉ",
      })),
      [
        { key: "studentDisplayId", label: "Mã HV hiển thị" },
        { key: "studentCode", label: "Mã số gốc" },
        { key: "leadCode", label: "Lead gốc" },
        { key: "fullName", label: "Họ và tên" },
        { key: "studentPhone", label: "SĐT học viên" },
        { key: "dob", label: "Ngày sinh" },
        { key: "enrollDate", label: "Ngày nhập học" },
        { key: "currentClassCode", label: "Mã lớp hiện tại" },
        { key: "currentClassName", label: "Tên lớp hiện tại" },
        { key: "enrollmentsCount", label: "Số enrollment" },
        { key: "guardianName", label: "Phụ huynh chính" },
        { key: "guardianPhone", label: "SĐT phụ huynh" },
        { key: "guardianPortal", label: "Portal phụ huynh" },
        { key: "guardianPortalStatus", label: "Trạng thái portal" },
        { key: "referredBy", label: "Nguồn / giới thiệu" },
        { key: "address", label: "Địa chỉ" },
        { key: "outstanding", label: "Công nợ" },
        { key: "status", label: "Trạng thái" },
      ],
      "hoc-vien-day-du",
      "HocVienDayDu",
    );
  };

  const columns: Column<Student>[] = [
    {
      key: "studentDisplayId",
      label: "Mã HV",
      sortable: true,
      width: "150px",
      render: (value, row) => (
        <div className="leading-tight">
          <span className="font-mono text-sm font-semibold text-primary">{value || row.studentCode}</span>
          <p className="text-[11px] text-ink-muted48">{row.studentCode}</p>
        </div>
      ),
    },
    {
      key: "leadCode",
      label: "Lead / Nguồn",
      sortable: true,
      width: "170px",
      render: (value, row) => (
        <div>
          <p className="text-sm font-semibold text-ink">{value ?? "Chưa gắn lead"}</p>
          <p className="text-xs text-ink-muted48">{row.referredBy ?? "Chưa có nguồn"}</p>
        </div>
      ),
    },
    {
      key: "fullName",
      label: "Học viên",
      sortable: true,
      width: "260px",
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-600 text-sm font-bold text-white shadow-md">
            {value.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{value}</p>
            <p className="text-xs font-mono text-ink-muted48">{row.phone ?? "Chưa có SĐT"}</p>
            <p className="text-xs text-ink-muted48">Sinh ngày: {formatDate(row.dob)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "enrollDate",
      label: "Nhập học / Lớp hiện tại",
      sortable: true,
      width: "280px",
      render: (value, row) => (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">{formatDate(value)}</p>
          {row.currentClassName ? (
            <>
              <p className="text-xs font-semibold text-primary">
                {row.currentClassCode ? `[${row.currentClassCode}] ` : ""}
                {row.currentClassName}
              </p>
              <p className="text-xs text-ink-muted48">{row.enrollmentsCount ?? 0} enrollment</p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                <span className="text-[10px]">●</span>
                Chưa ghi danh lớp
              </div>
              <div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setAssigningStudent(row);
                  }}
                  className="inline-flex items-center rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(17,139,222,0.25)] transition hover:brightness-105"
                >
                  Gán nhập học ngay
                </button>
              </div>
            </>
          )}
        </div>
      ),
    },
    {
      key: "primaryGuardian",
      label: "Phụ huynh",
      width: "220px",
      render: (value) =>
        value ? (
          <div>
            <p className="text-sm font-medium text-ink">{value.fullName}</p>
            <p className="text-xs text-ink-muted48">{value.phone ?? "Chưa có SĐT"}</p>
          </div>
        ) : (
          <span className="text-xs text-ink-muted48">Chưa liên kết phụ huynh</span>
        ),
    },
    {
      key: "primaryGuardianPortal",
      label: "Portal phụ huynh",
      width: "220px",
      render: (_value, row) =>
        row.primaryGuardian ? (
          <div>
            <p className="text-sm font-medium text-ink">{row.primaryGuardian.user?.email ?? "Chưa cấp portal"}</p>
            <p className={`text-xs ${row.primaryGuardian.user?.isActive ? "text-sky-700" : "text-ink-muted48"}`}>
              {row.primaryGuardian.user ? (row.primaryGuardian.user.isActive ? "Đang hoạt động" : "Đã thu hồi") : "Chưa cấp"}
            </p>
          </div>
        ) : (
          <span className="text-xs text-ink-muted48">Chưa có phụ huynh</span>
        ),
    },
    {
      key: "address",
      label: "Địa chỉ",
      width: "240px",
      render: (value) => <div className="max-w-[240px] line-clamp-2 text-sm text-ink">{value ?? "Chưa có địa chỉ"}</div>,
    },
    {
      key: "outstanding",
      label: "Công nợ",
      sortable: true,
      align: "center",
      width: "130px",
      render: (value) => (
        <span
          className={`inline-flex rounded-lg px-2 py-1 text-xs font-bold ${
            (value ?? 0) > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {formatVnd(value)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Trạng thái",
      align: "center",
      width: "140px",
      render: (value, row) => {
        const missingClass = !row.currentClassName;
        const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
          ACTIVE: {
            label: missingClass ? "Cần gán lớp" : "Đang học",
            color: missingClass ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-emerald-100 text-emerald-700 border-emerald-200",
            icon: "●",
          },
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
      onClick: (row) => router.push(`/students/${row.id}`),
      variant: "primary",
    },
  ];

  if (canUpdate("schedule", userRole)) {
    actions.push({
      label: "Gán nhập học",
      onClick: (row) => setAssigningStudent(row),
      variant: "secondary",
    });
  }

  if (canUpdate("students", userRole)) {
    actions.push({
      label: "Sửa",
      onClick: (row) => router.push(`/students/${row.id}`),
      variant: "secondary",
    });
  }

  if (canDelete("students", userRole)) {
    actions.push({
      label: "Xóa",
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
        onClick: async (rows) => exportRows(rows),
        variant: "primary",
      },
      {
        label: "Xóa",
        onClick: async (rows) => {
          await Promise.all(rows.map((row) => fetch(`/api/students/${row.id}`, { method: "DELETE" })));
          router.refresh();
        },
        variant: "danger",
        confirmMessage: "Bạn có chắc muốn xóa các học viên đã chọn? Thao tác này không thể hoàn tác.",
      },
    );
  }

  const handleSearch = (query: string) => {
    updateParams({ q: query || null, page: "1" });
  };

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
        <span className="text-[10px]">●</span>
        {unassignedStudents.length} học viên chưa ghi danh trong trang này
      </div>
      {firstUnassignedStudent && canUpdate("schedule", userRole) ? (
        <button
          type="button"
          onClick={() => setAssigningStudent(firstUnassignedStudent)}
          className="inline-flex items-center rounded-full border border-primary/20 bg-white px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/5"
        >
          Xử lý nhanh học viên đầu tiên chưa có lớp
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <DataTableResponsive
        data={initialData}
        columns={columns}
        actions={actions}
        bulkActions={bulkActions}
        title="Danh sách học viên"
        description="Bảng đầy đủ theo kiểu sổ dữ liệu: mã, lead, học viên, lớp, phụ huynh, portal, công nợ và trạng thái."
        headerActions={headerActions}
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
          onPageChange: (newPage) => updateParams({ page: String(newPage) }),
          onPageSizeChange: (newSize) => updateParams({ page: "1", pageSize: String(newSize) }),
        }}
        emptyState={{
          title: "Chưa có học viên",
          description: "Bắt đầu bằng cách thêm học viên đầu tiên vào hệ thống.",
          action: {
            label: "Thêm học viên",
            onClick: () => router.push("/students/new"),
          },
        }}
        loading={isPending}
        stickyHeader
        rowKey="id"
        onRowClick={(row) => router.push(`/students/${row.id}`)}
        className="[&_table]:min-w-[1750px]"
        mobileConfig={{
          primaryColumn: "fullName",
          secondaryColumns: ["studentDisplayId", "status", "outstanding"],
        }}
      />

      {assigningStudent ? (
        <AssignEnrollmentForm
          student={assigningStudent}
          open
          onOpenChange={(open) => {
            if (!open) setAssigningStudent(null);
          }}
        />
      ) : null}
    </>
  );
}
