"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Action, BulkAction, Column } from "@/components/ui/DataTable";
import AssignEnrollmentForm from "@/components/students/AssignEnrollmentForm";
import StudentDetailDrawer from "@/components/students/StudentDetailDrawer";
import AddPaidCatchupForm from "@/components/session-credits/AddPaidCatchupForm";
import StudentForm from "@/components/students/StudentForm";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import { exportToExcel, formatVnd } from "@/lib/export-utils";
import { canCreate, canDelete, canUpdate } from "@/lib/server/role-matrix";

type Student = {
  id: string;
  studentCode: string;
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
  currentClassStatus?: string | null;
  currentClassCode?: string | null;
  outstanding?: number;
  enrollmentsCount?: number;
  currentBillingModel?: string | null;
  totalCharged?: number;
  totalPaid?: number;
  tuitionCharged?: number;
  materialsCharged?: number;
  openingBalanceTotal?: number;
  unpaidChargeCount?: number;
  latestChargePeriod?: string | null;
  billingModes?: string[];
  bookIssueAmount?: number;
  unpaidBookIssueCount?: number;
  bookIssueQuantity?: number;
  chargeCount?: number;
  scholarshipCount?: number;
  adjustmentCount?: number;
  sessionCreditCount?: number;
  sessionCreditUnitPrice?: number | null;
  learningRemainingSessions?: number | null;
  learningPurchasedSessions?: number | null;
  learningCompletedSessions?: number | null;
  expectedStudentEndDate?: string | Date | null;
  continuationStatus?: string | null;
  shortageAfterCurrentClass?: number;
  nextClassName?: string | null;
  activeDiscountPercent?: number;
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
  canViewFinance?: boolean;
  searchQuery?: string;
  status?: string;
  stats?: {
    total: number;
    active: number;
    left: number;
    portal: number;
    debt: number;
    needTransfer: number;
    endingSoon: number;
  };
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
}

function billingModeLabel(value?: string | null) {
  if (value === "COURSE") return "Thu khóa";
  if (value === "PERIOD") return "Thu tháng";
  if (value === "INSTALLMENT") return "Trả góp";
  return value ?? "";
}

export default function StudentsTable({
  initialData,
  total,
  page,
  pageSize,
  userRole,
  canViewFinance = true,
  searchQuery = "",
  status = "",
  stats,
}: StudentsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [assigningStudent, setAssigningStudent] = useState<Student | null>(null);
  const [drawerStudentId, setDrawerStudentId] = useState<string | null>(null);
  const [addStudentOpen, setAddStudentOpen] = useState(false);

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
        studentCode: row.studentCode,
        leadCode: row.leadCode ?? "",
        fullName: row.fullName,
        studentPhone: row.phone ?? "",
        dob: formatDate(row.dob),
        enrollDate: formatDate(row.enrollDate),
        currentClassCode: row.currentClassCode ?? "",
        currentClassName: row.currentClassName ?? "",
        currentBillingModel: billingModeLabel(row.currentBillingModel),
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
        chargeCount: row.chargeCount ?? 0,
        latestChargePeriod: row.latestChargePeriod ?? "",
        billingModes: (row.billingModes ?? []).map((item) => billingModeLabel(item)).join(", "),
        totalCharged: formatVnd(row.totalCharged),
        totalPaid: formatVnd(row.totalPaid),
        tuitionCharged: formatVnd(row.tuitionCharged),
        materialsCharged: formatVnd(row.materialsCharged),
        openingBalanceTotal: formatVnd(row.openingBalanceTotal),
        outstanding: formatVnd(row.outstanding),
        unpaidChargeCount: row.unpaidChargeCount ?? 0,
        bookIssueAmount: formatVnd(row.bookIssueAmount),
        bookIssueQuantity: row.bookIssueQuantity ?? 0,
        unpaidBookIssueCount: row.unpaidBookIssueCount ?? 0,
        // Học bổng + điều chỉnh HP gộp thành 1 khái niệm "chiết khấu" duy nhất (xem
        // ScholarshipAdjustmentForm.tsx) — export cũng gộp theo, không tách 2 cột.
        discountCount: (row.scholarshipCount ?? 0) + (row.adjustmentCount ?? 0),
        sessionCreditCount: row.sessionCreditCount ?? 0,
        status: row.status === "ACTIVE" ? "Đang học" : "Đã nghỉ",
      })),
      [
        { key: "studentCode", label: "Mã HV" },
        { key: "leadCode", label: "Lead gốc" },
        { key: "fullName", label: "Họ và tên" },
        { key: "studentPhone", label: "SĐT học viên" },
        { key: "dob", label: "Ngày sinh" },
        { key: "enrollDate", label: "Ngày nhập học" },
        { key: "currentClassCode", label: "Mã lớp hiện tại" },
        { key: "currentClassName", label: "Tên lớp hiện tại" },
        { key: "currentBillingModel", label: "Kiểu thu hiện tại" },
        { key: "enrollmentsCount", label: "Số enrollment" },
        { key: "guardianName", label: "Phụ huynh chính" },
        { key: "guardianPhone", label: "SĐT phụ huynh" },
        { key: "guardianPortal", label: "Portal phụ huynh" },
        { key: "guardianPortalStatus", label: "Trạng thái portal" },
        { key: "referredBy", label: "Nguồn / giới thiệu" },
        { key: "address", label: "Địa chỉ" },
        { key: "chargeCount", label: "Số kỳ thu" },
        { key: "latestChargePeriod", label: "Kỳ thu gần nhất" },
        { key: "billingModes", label: "Mode charge" },
        { key: "totalCharged", label: "Tổng đã tính" },
        { key: "totalPaid", label: "Tổng đã thu" },
        { key: "tuitionCharged", label: "Tổng học phí" },
        { key: "materialsCharged", label: "Tổng giáo trình" },
        { key: "openingBalanceTotal", label: "Tổng tồn đầu" },
        { key: "outstanding", label: "Công nợ" },
        { key: "unpaidChargeCount", label: "Kỳ còn nợ" },
        { key: "bookIssueAmount", label: "Tổng tiền sách" },
        { key: "bookIssueQuantity", label: "SL sách đã phát" },
        { key: "unpaidBookIssueCount", label: "Dòng sách chưa thu" },
        { key: "discountCount", label: "Số lần chiết khấu" },
        { key: "sessionCreditCount", label: "Số credit buổi" },
        { key: "status", label: "Trạng thái" },
      ],
      "hoc-vien-day-du",
      "HocVienDayDu",
    );
  };

  const columns: Column<Student>[] = [
    {
      key: "studentCode",
      label: "Mã HV",
      sortable: true,
      width: "130px",
      filter: { type: "text", paramKey: "code", placeholder: "Mã HV..." },
      render: (value) => <span className="font-mono text-sm font-semibold text-primary">{value}</span>,
    },
    {
      key: "fullName",
      label: "Học viên",
      sortable: true,
      width: "260px",
      filter: { type: "text", paramKey: "name", placeholder: "Tên học viên..." },
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e5eaf7] bg-white text-sm font-bold text-[#475569]">
            {value.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              {value}
              {row.status === "LEFT" ? (
                <span className="rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">Đã nghỉ</span>
              ) : null}
              {/* Luôn hiện ở đây (không đặt trong cột "Học phí còn nợ") — cột đó bị ẩn với
                  vai trò không có quyền xem tài chính, trong khi "có học bổng hay không"
                  không nhạy cảm bằng số tiền nợ cụ thể, không nên mất theo. */}
              {row.activeDiscountPercent ? (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                  -{Math.round(row.activeDiscountPercent * 100)}% chiết khấu
                </span>
              ) : null}
            </p>
            {/* Phụ huynh gộp vào ngay đây, không tách cột riêng — đúng ý gọn của khách */}
            <p className="text-xs text-ink-muted48">
              {row.primaryGuardian ? `${row.primaryGuardian.fullName} · ${row.primaryGuardian.phone ?? "chưa có SĐT"}` : "Chưa liên kết phụ huynh"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "enrollDate",
      label: "Nhập học / Lớp hiện tại",
      sortable: true,
      width: "300px",
      filter: { type: "text", paramKey: "className", placeholder: "Tìm lớp..." },
      render: (value, row) => (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">{formatDate(value)}</p>
          {row.currentClassName ? (
            <>
              <p className="text-xs font-semibold text-primary">
                {row.currentClassCode ? `[${row.currentClassCode}] ` : ""}
                {row.currentClassName}
              </p>
              <p className="text-xs text-ink-muted48">
                {row.enrollmentsCount ?? 0} enrollment · {billingModeLabel(row.currentBillingModel) || "Chưa rõ mode"}
              </p>
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
      key: "continuationStatus",
      label: "Hành trình",
      width: "230px",
      filter: {
        type: "select",
        paramKey: "continuationStatus",
        placeholder: "Tất cả",
        options: [
          { label: "Cần chuyển lớp", value: "NEED_TRANSFER" },
          { label: "Đã học đủ", value: "COMPLETED" },
          { label: "Đang ổn", value: "ON_TRACK" },
        ],
      },
      render: (_value, row) => {
        const remaining = row.learningRemainingSessions ?? null;
        const completed = row.learningCompletedSessions ?? null;
        const purchased = row.learningPurchasedSessions ?? null;
        const needTransfer = row.continuationStatus === "NEED_TRANSFER";
        const endingSoon = !needTransfer && remaining !== null && remaining > 0 && remaining <= 3;
        const completedCourse = row.continuationStatus === "COMPLETED";
        // "Đã học đủ" trong khi lớp VẪN ACTIVE (còn dạy tiếp cho người khác) là việc cần
        // quyết định (ghi danh thêm hay chờ tự tất toán), không phải "xong việc" — không
        // nên tô cùng tông xanh lá với trường hợp lớp đã thật sự kết thúc.
        const completedWhileClassActive = completedCourse && row.currentClassStatus === "ACTIVE";
        const badge = needTransfer
          ? { label: "Cần chuyển lớp", className: "border-amber-200 bg-amber-50 text-amber-800" }
          : endingSoon
            ? { label: "Sắp hết khóa", className: "border-sky-200 bg-sky-50 text-sky-800" }
            : completedWhileClassActive
              ? { label: "Đã học đủ — cần xử lý", className: "border-amber-200 bg-amber-50 text-amber-800" }
              : completedCourse
                ? { label: "Đã học đủ", className: "border-emerald-200 bg-emerald-50 text-emerald-800" }
                : { label: "Đang ổn", className: "border-slate-200 bg-slate-50 text-slate-700" };

        return (
          <div className="space-y-1.5">
            <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${badge.className}`}>{badge.label}</span>
            {completed !== null && purchased !== null ? (
              <p className="text-xs font-semibold text-[#0f1729]">
                Đã học {completed}/{purchased} · còn {remaining ?? 0} buổi
              </p>
            ) : (
              <p className="text-xs text-[#94a3b8]">Chưa có tiến độ enrollment</p>
            )}
            {needTransfer ? (
              <p className="text-xs text-amber-700">
                {row.nextClassName ? `Đẩy sang ${row.nextClassName}` : "Thiếu lớp tiếp theo"} · thiếu {row.shortageAfterCurrentClass ?? 0} buổi
              </p>
            ) : (
              <p className="text-xs text-[#64748b]">Dự kiến {formatDate(row.expectedStudentEndDate)}</p>
            )}
          </div>
        );
      },
    },
    {
      key: "sessionCreditCount",
      label: "Buổi bổ trợ",
      sortable: true,
      width: "130px",
      filter: { type: "numberRange", paramKeyFrom: "sessionCreditFrom", paramKeyTo: "sessionCreditTo", placeholder: "buổi" },
      render: (value, row) => {
        const count = value ?? 0;
        if (count <= 0) return <span className="text-sm text-ink-muted48">—</span>;
        return (
          <div>
            <span className="text-sm font-semibold text-ink">{count} buổi</span>
            {row.sessionCreditUnitPrice ? (
              <p className="mt-0.5 text-xs text-ink-muted48">{formatVnd(row.sessionCreditUnitPrice)}/buổi</p>
            ) : (
              <p className="mt-0.5 text-xs text-ink-muted48">Miễn phí</p>
            )}
          </div>
        );
      },
    },
    {
      key: "outstanding",
      label: "Học phí còn nợ",
      sortable: true,
      width: "230px",
      filter: { type: "numberRange", paramKeyFrom: "outstandingFrom", paramKeyTo: "outstandingTo", placeholder: "đ" },
      render: (value, row) => (
        <div className="space-y-1">
          <p className={`text-sm font-bold ${(value ?? 0) > 0 ? "text-rose-700" : "text-emerald-700"}`}>{formatVnd(value)}</p>
          <p className="text-xs text-ink-muted48">
            Đã thu {formatVnd(row.totalPaid)} / Tổng phải thu {formatVnd(row.totalCharged)}
          </p>
          <p className="text-xs text-ink-muted48">
            HP {formatVnd(row.tuitionCharged)} · Sách {formatVnd(row.materialsCharged)}
          </p>
        </div>
      ),
    },
  ];
  if (!canViewFinance) {
    const financeColumnIndex = columns.findIndex((column) => column.key === "outstanding");
    if (financeColumnIndex >= 0) columns.splice(financeColumnIndex, 1);
  }

  const actions: Action<Student>[] = [];

  if (canUpdate("schedule", userRole)) {
    actions.push({
      label: "Gán nhập học",
      iconOnly: true,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <polyline points="17 11 19 13 23 9" />
        </svg>
      ),
      onClick: (row) => setAssigningStudent(row),
      variant: "secondary",
    });
  }

  if (canUpdate("students", userRole)) {
    actions.push({
      label: "Sửa",
      iconOnly: true,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      onClick: (row) => setDrawerStudentId(row.id),
      variant: "secondary",
    });
  }

  if (canDelete("students", userRole)) {
    actions.push({
      label: "Xóa",
      iconOnly: true,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
      onClick: async (row) => {
        await fetch(`/api/students/${row.id}`, { method: "DELETE" });
        router.refresh();
      },
      confirmTitle: "Xác nhận xóa học viên?",
      confirmMessage: "Hồ sơ học viên cùng lịch sử ghi danh, điểm danh, học phí liên quan sẽ bị xóa. Thao tác này không thể hoàn tác.",
      variant: "danger",
      show: (row) => row.status !== "ACTIVE",
    });
  }

  const bulkActions: BulkAction<Student>[] = [];

  if (canUpdate("students", userRole) || canDelete("students", userRole)) {
    bulkActions.push({ label: "Xuất Excel", onClick: async (rows) => exportRows(rows), variant: "primary" });
  }

  if (canDelete("students", userRole)) {
    bulkActions.push({
      label: "Xóa",
      onClick: async (rows) => {
        await Promise.all(rows.map((row) => fetch(`/api/students/${row.id}`, { method: "DELETE" })));
        router.refresh();
      },
      variant: "danger",
      confirmMessage: "Bạn có chắc muốn xóa các học viên đã chọn? Thao tác này không thể hoàn tác.",
    });
  }

  const handleSearch = (query: string) => {
    updateParams({ q: query || null, page: "1" });
  };

  const filterValues = {
    code: searchParams.get("code") ?? "",
    name: searchParams.get("name") ?? "",
    className: searchParams.get("className") ?? "",
    guardian: searchParams.get("guardian") ?? "",
    status,
    continuationStatus: searchParams.get("continuationStatus") ?? "",
    outstandingFrom: searchParams.get("outstandingFrom") ?? "",
    outstandingTo: searchParams.get("outstandingTo") ?? "",
    sessionCreditFrom: searchParams.get("sessionCreditFrom") ?? "",
    sessionCreditTo: searchParams.get("sessionCreditTo") ?? "",
  };
  const handleFilterChange = (key: string, value: string | null, extra?: Record<string, string | null>) =>
    updateParams({ [key]: value, ...extra, page: "1" });

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {canUpdate("students", userRole) ? <AddPaidCatchupForm /> : null}
      {canCreate("students", userRole) ? (
        <button
          type="button"
          onClick={() => setAddStudentOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Thêm học viên
        </button>
      ) : null}
      {stats
        ? [
            { label: "Tất cả", value: stats.total, href: "/students", active: !status, activeClass: "bg-primary text-white", idleValueClass: "text-primary" },
            { label: "Đang học", value: stats.active, href: "/students?status=ACTIVE", active: status === "ACTIVE", activeClass: "bg-emerald-500 text-white", idleValueClass: "text-emerald-700" },
            { label: "Đã nghỉ", value: stats.left, href: "/students?status=LEFT", active: status === "LEFT", activeClass: "bg-rose-500 text-white", idleValueClass: "text-rose-700" },
            { label: "Cần chuyển", value: stats.needTransfer, href: null, active: false, activeClass: "", idleValueClass: "text-amber-700" },
            { label: "Sắp hết", value: stats.endingSoon, href: null, active: false, activeClass: "", idleValueClass: "text-sky-700" },
            { label: "Portal", value: stats.portal, href: null, active: false, activeClass: "", idleValueClass: "text-sky-700" },
            ...(canViewFinance
              ? [{ label: "Công nợ", value: stats.debt, href: null, active: false, activeClass: "", idleValueClass: "text-amber-700" }]
              : []),
          ].map((item) => {
            const className = `inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              item.active ? `${item.activeClass} border-transparent` : "border-[#dbe7ff] bg-white text-ink hover:border-primary/30"
            }`;

            const content = (
              <>
                <span>{item.label}</span>
                <span className={item.active ? "text-white" : item.idleValueClass}>{item.value}</span>
              </>
            );

            return item.href ? (
              <a key={item.label} href={item.href} className={className}>
                {content}
              </a>
            ) : (
              <span key={item.label} className={className}>
                {content}
              </span>
            );
          })
        : null}
    </div>
  );

  return (
    <>
      <DataTableResponsive
        data={initialData}
        columns={columns}
        actions={actions}
        bulkActions={bulkActions}
        headerActions={headerActions}
        searchable
        searchPlaceholder="Tìm theo tên, mã học viên, lead, phụ huynh, số điện thoại..."
        onSearch={handleSearch}
        defaultSearchValue={searchQuery}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        showCountBadge={false}
        sortable
        selectable={canUpdate("students", userRole) || canDelete("students", userRole)}
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
            onClick: () => setAddStudentOpen(true),
          },
        }}
        loading={isPending}
        stickyHeader
        rowKey="id"
        onRowClick={(row) => setDrawerStudentId(row.id)}
        className="[&_table]:min-w-[1750px]"
        primaryColumn="fullName"
        secondaryColumns={["studentCode", "status", "outstanding"]}
      />

      {/* Add Student Drawer */}
      <ResponsiveDrawer open={addStudentOpen} onClose={() => setAddStudentOpen(false)} title="Thêm học viên mới" widthClassName="max-w-3xl">
        <StudentForm onCancel={() => setAddStudentOpen(false)} onCreated={() => setAddStudentOpen(false)} />
      </ResponsiveDrawer>

      {/* Student Detail Drawer */}
      {drawerStudentId && (
        <StudentDetailDrawer
          open={!!drawerStudentId}
          onClose={() => setDrawerStudentId(null)}
          studentId={drawerStudentId}
        />
      )}

      {/* Assign Enrollment Form */}
      {assigningStudent ? (
        <AssignEnrollmentForm
          student={{
            id: assigningStudent.id,
            fullName: assigningStudent.fullName,
            studentCode: assigningStudent.studentCode,
            currentClassName: assigningStudent.currentClassName,
            sessionCreditCount: assigningStudent.sessionCreditCount,
          }}
          open
          onOpenChange={(open) => {
            if (!open) setAssigningStudent(null);
          }}
        />
      ) : null}
    </>
  );
}
