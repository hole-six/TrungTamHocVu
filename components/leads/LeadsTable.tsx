"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column, BulkAction } from "@/components/ui/DataTable";
import { canView, canUpdate, canDelete } from "@/lib/server/role-matrix";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  PLACEMENT_TEST_STATUS_LABEL,
  PLACEMENT_TEST_BADGE_CLASS,
  DATE_URGENCY_CLASS,
  dateUrgency,
} from "@/lib/server/lead-rules";
import { exportToExcel } from "@/lib/export-utils";
import EditableNoteCell from "@/components/leads/EditableNoteCell";
import TestQuickAction from "@/components/leads/TestQuickAction";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

type LatestTest = {
  id: string;
  scheduledDate: Date | string | null;
  testDate: Date | string | null;
  status: string;
  result: string | null;
} | null;

type Lead = {
  id: string;
  leadCode: string;
  fullName: string;
  phone?: string | null;
  secondaryPhone?: string | null;
  zaloContact?: string | null;
  status: string;
  dob?: string | Date | null;
  guardianName?: string | null;
  guardianPortalEmail?: string | null;
  guardianPortalActive?: boolean;
  source?: string | null;
  convertedStudentCode?: string | null;
  convertedClassName?: string | null;
  outstanding?: number | null;
  meetDate?: Date | string | null;
  expectedStartDate?: Date | string | null;
  actualEnrollDate?: Date | string | null;
  notes?: string | null;
  interestedClassId?: string | null;
  latestTest?: LatestTest;
  duplicatePhoneNames?: string[];
  hasStudent?: boolean;
};

type LeadsTableProps = {
  initialData: Lead[];
  total: number;
  page: number;
  pageSize: number;
  userRole: string;
  searchQuery?: string;
  statusOptions?: { key: string; label: string; count: number }[];
  statusFilter?: string;
  testStatusFilter?: string;
  urgentFilter?: string;
  missingTestCount?: number;
  soonCount?: number;
  overdueCount?: number;
  classOptions?: { id: string; className: string }[];
};

const LEAD_STATUS_CONFIG: Record<string, { label: string; color: string; activeColor: string; dot: string }> = {
  NEW:         { label: LEAD_STATUS_LABEL.NEW,         color: "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",   activeColor: "border-[#1d4ed8] bg-[#1d4ed8] text-white",   dot: "bg-[#3b82f6]" },
  CONTACTING:  { label: LEAD_STATUS_LABEL.CONTACTING,  color: "border-[#a5f3fc] bg-[#ecfeff] text-[#0e7490]",   activeColor: "border-[#0e7490] bg-[#0e7490] text-white",   dot: "bg-[#06b6d4]" },
  APPOINTED:   { label: LEAD_STATUS_LABEL.APPOINTED,   color: "border-[#c4b5fd] bg-[#f5f3ff] text-[#6d28d9]",   activeColor: "border-[#6d28d9] bg-[#6d28d9] text-white",   dot: "bg-[#8b5cf6]" },
  TESTED:      { label: LEAD_STATUS_LABEL.TESTED,      color: "border-[#a5b4fc] bg-[#eef2ff] text-[#4338ca]",   activeColor: "border-[#4338ca] bg-[#4338ca] text-white",   dot: "bg-[#6366f1]" },
  QUALIFIED:   { label: LEAD_STATUS_LABEL.QUALIFIED,   color: "border-[#fde68a] bg-[#fffbeb] text-[#b45309]",   activeColor: "border-[#b45309] bg-[#b45309] text-white",   dot: "bg-[#f59e0b]" },
  UNQUALIFIED: { label: LEAD_STATUS_LABEL.UNQUALIFIED, color: "border-[#e2e8f0] bg-[#f8fafc] text-[#475569]",   activeColor: "border-[#475569] bg-[#475569] text-white",   dot: "bg-[#94a3b8]" },
  ENROLLED:    { label: LEAD_STATUS_LABEL.ENROLLED,    color: "border-[#a7f3d0] bg-[#ecfdf5] text-[#065f46]",   activeColor: "border-[#065f46] bg-[#065f46] text-white",   dot: "bg-[#10b981]" },
  LOST:        { label: LEAD_STATUS_LABEL.LOST,        color: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",   activeColor: "border-[#b91c1c] bg-[#b91c1c] text-white",   dot: "bg-[#ef4444]" },
};

function statusSelectClass(status: string) {
  const config = LEAD_STATUS_CONFIG[status] || LEAD_STATUS_CONFIG.NEW;
  return `h-9 min-w-[150px] cursor-pointer rounded-xl border px-3 py-1 text-xs font-bold outline-none transition ${config.color}`;
}

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

function formatDate(date: Date | string | null | undefined) {
  return date ? new Date(date).toLocaleDateString("vi-VN") : "—";
}

function DateCell({ date }: { date: Date | string | null | undefined }) {
  if (!date) return <span className="text-ink-muted48">—</span>;
  const urgency = dateUrgency(date);
  const label = formatDate(date);

  if (urgency === "none") {
    return <span className="text-ink-muted80">{label}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${DATE_URGENCY_CLASS[urgency]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export default function LeadsTable({
  initialData,
  total,
  page,
  pageSize,
  userRole,
  searchQuery = "",
  statusOptions = [],
  statusFilter = "",
  testStatusFilter = "",
  urgentFilter = "",
  missingTestCount = 0,
  soonCount = 0,
  overdueCount = 0,
  classOptions = [],
}: LeadsTableProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  useEffect(() => {
    setData(initialData);
    setLoading(false);
  }, [initialData]);

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

  const changeLeadStatus = async (leadId: string, nextStatus: string) => {
    setStatusSavingId(leadId);
    const response = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setStatusSavingId(null);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      window.alert(result.error ?? "Không thể đổi trạng thái lead.");
      return;
    }
    setData((current) => current.map((item) => (item.id === leadId ? { ...item, status: nextStatus } : item)));
    router.refresh();
  };

  const convertToStudent = async (leadId: string) => {
    setConvertingId(leadId);
    const response = await fetch(`/api/leads/${leadId}/convert`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    setConvertingId(null);
    if (!response.ok) {
      window.alert(result.error ?? "Không thể chuyển đổi thành học viên.");
      return;
    }
    router.push(`/students/${result.item.id}`);
  };

  // Ghép mọi chiều lọc đang bật (status/q/testStatus/urgent) để các link chip/phân
  // trang không làm mất bộ lọc khác đang chọn — thay cho nối chuỗi thủ công cũ vì
  // giờ có 4 chiều lọc độc lập thay vì 1.
  function buildQuery(overrides: Record<string, string | number | null>) {
    const params = new URLSearchParams();
    const merged: Record<string, string | number | null> = {
      q: searchQuery || null,
      status: statusFilter || null,
      testStatus: testStatusFilter || null,
      urgent: urgentFilter || null,
      page: 1,
      pageSize,
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value === null || value === "") continue;
      params.set(key, String(value));
    }
    return params.toString();
  }

  const columns: Column<Lead>[] = [
    {
      key: "leadCode",
      label: "Mã lead",
      sortable: true,
      width: "110px",
      render: (value) => <span className="font-mono text-sm font-semibold text-primary">{value}</span>,
    },
    {
      key: "fullName",
      label: "Lead / phụ huynh",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-600 text-sm font-bold text-white shadow-md">
            {value.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-semibold text-ink">{value}</p>
              {row.convertedStudentCode ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{row.convertedStudentCode}</span>
              ) : null}
              {row.duplicatePhoneNames && row.duplicatePhoneNames.length > 0 ? (
                <span
                  className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                  title={`Trùng SĐT với: ${row.duplicatePhoneNames.join(", ")}`}
                >
                  Trùng SĐT
                </span>
              ) : null}
            </div>
            {row.guardianName ? <p className="text-xs text-ink-muted48">PH: {row.guardianName}</p> : null}
            <p className={`text-xs ${row.guardianPortalEmail ? (row.guardianPortalActive ? "text-sky-700" : "text-ink-muted48") : "text-ink-muted48"}`}>
              {row.guardianPortalEmail ?? "Chưa cấp portal"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Liên hệ",
      render: (value, row) => (
        <div className="space-y-0.5 text-xs">
          <p className="text-ink-muted80">{value ?? "Chưa có SĐT"}</p>
          {row.secondaryPhone ? <p className="text-ink-muted48">{row.secondaryPhone}</p> : null}
          {row.zaloContact ? <p className="text-sky-700">Zalo {row.zaloContact}</p> : null}
        </div>
      ),
    },
    {
      key: "meetDate",
      label: "Ngày gặp",
      render: (value) => <DateCell date={value} />,
    },
    {
      key: "latestTest",
      label: "Lịch test",
      render: (_value, row) => {
        const test = row.latestTest;
        return (
          <div className="min-w-[150px] space-y-1 text-xs">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${PLACEMENT_TEST_BADGE_CLASS[test?.status ?? "NONE"]}`}>
              {test ? PLACEMENT_TEST_STATUS_LABEL[test.status] ?? test.status : "Chưa hẹn"}
            </span>
            <p>
              <span className="text-ink-muted48">Hẹn:</span> <DateCell date={test?.scheduledDate} />
            </p>
            <p>
              <span className="text-ink-muted48">Đến:</span> <DateCell date={test?.testDate} />
            </p>
          </div>
        );
      },
    },
    {
      key: "expectedStartDate",
      label: "Nhập học",
      render: (_value, row) => (
        <div className="min-w-[130px] space-y-1 text-xs">
          <p>
            <span className="text-ink-muted48">Dự kiến:</span> <DateCell date={row.expectedStartDate} />
          </p>
          <p>
            <span className="text-ink-muted48">Thực tế:</span> <DateCell date={row.actualEnrollDate} />
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Trạng thái",
      align: "center",
      render: (value, row) => {
        const options = value === "ENROLLED" ? [value] : LEAD_STATUSES.filter((s) => s !== "ENROLLED");
        const cfg = LEAD_STATUS_CONFIG[value] || LEAD_STATUS_CONFIG.NEW;
        return (
          <div className="flex flex-col items-start gap-1.5" onClick={(e) => e.stopPropagation()}>
            {canUpdate("leads", userRole) ? (
              <div className={`relative inline-flex items-center gap-1.5 rounded-lg border pr-5 ${cfg.color} ${statusSavingId === row.id ? "opacity-60" : ""} [&_select]:focus:outline-none [&_select]:focus:ring-0 [&_select]:focus:shadow-none`}>
                <span className={`ml-2 h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
                <select
                  value={value}
                  disabled={statusSavingId === row.id}
                  onChange={(e) => {
                    e.stopPropagation();
                    if (e.target.value !== value) void changeLeadStatus(row.id, e.target.value);
                  }}
                  className="h-7 w-full appearance-none bg-transparent py-0 pl-0 pr-0 text-xs font-bold outline-none border-none ring-0 shadow-none focus:outline-none focus:ring-0 focus:border-none focus:shadow-none cursor-pointer"
                  style={{ WebkitAppearance: "none", MozAppearance: "none", outline: "none", boxShadow: "none" }}
                >
                  {options.map((s) => (
                    <option key={s} value={s}>
                      {LEAD_STATUS_LABEL[s as keyof typeof LEAD_STATUS_LABEL] ?? s}
                    </option>
                  ))}
                </select>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="pointer-events-none absolute right-1.5 shrink-0 opacity-60"><path d="M6 9l6 6 6-6"/></svg>
              </div>
            ) : (
              <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-bold ${cfg.color}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            )}

            {value === "QUALIFIED" && !row.hasStudent && canUpdate("leads", userRole) && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); void convertToStudent(row.id); }}
                disabled={convertingId === row.id}
                className="inline-flex items-center gap-1 rounded-lg border border-[#3b82f6] bg-[#eff6ff] px-2.5 py-1 text-[11px] font-bold text-[#1d4ed8] transition hover:bg-[#3b82f6] hover:text-white disabled:opacity-50"
              >
                {convertingId === row.id ? (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Đang chuyển...
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    Chuyển thành HV
                  </>
                )}
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: "notes",
      label: "Ghi chú",
      render: (value, row) => (
        <div onClick={(event) => event.stopPropagation()} className="max-w-[220px]">
          <EditableNoteCell leadId={row.id} notes={value ?? null} />
        </div>
      ),
    },
    {
      key: "id",
      label: "Tác vụ",
      render: (_value, row) => (
        <div onClick={(event) => event.stopPropagation()} className="flex flex-wrap items-center gap-1.5">
          <TestQuickAction
            leadId={row.id}
            latestTest={row.latestTest ?? null}
            expectedStartDate={row.expectedStartDate}
            actualEnrollDate={row.actualEnrollDate}
            interestedClassId={row.interestedClassId ?? null}
            classOptions={classOptions}
          />
          <button type="button" onClick={() => router.push(`/leads/${row.id}`)} className="btn-icon" title="Xem" aria-label="Xem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          {canUpdate("leads", userRole) ? (
            <button type="button" onClick={() => router.push(`/leads/${row.id}`)} className="btn-icon" title="Sửa" aria-label="Sửa">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          ) : null}
          {canDelete("leads", userRole) ? (
            <ConfirmActionButton
              title="Xác nhận xóa lead?"
              description={`Lead ${row.fullName} sẽ bị xóa khỏi CRM.`}
              confirmLabel="Xóa lead"
              tone="danger"
              className="btn-icon text-rose-600"
              onConfirm={async () => {
                await fetch(`/api/leads/${row.id}`, { method: "DELETE" });
                router.refresh();
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </ConfirmActionButton>
          ) : null}
        </div>
      ),
    },
  ];

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

  const handleSearch = (query: string) => {
    setLoading(true);
    router.push(`/leads?${buildQuery({ q: query || null })}`);
  };

  const testChips: { key: string; label: string; count: number; active: boolean; query: Record<string, string | null> }[] = [
    { key: "NONE", label: "Chưa hẹn", count: missingTestCount, active: testStatusFilter === "NONE", query: { testStatus: "NONE", urgent: null } },
    { key: "soon", label: "Sắp tới", count: soonCount, active: urgentFilter === "soon", query: { urgent: "soon", testStatus: null } },
    { key: "overdue", label: "Quá hạn", count: overdueCount, active: urgentFilter === "overdue", query: { urgent: "overdue", testStatus: null } },
  ];
  const testFilterActive = Boolean(testStatusFilter || urgentFilter);

  // ENROLLED đã có học viên thật, việc theo dõi tiếp thuộc module Học viên — không
  // còn cần chip lọc riêng ở CRM này nữa (đã loại khỏi danh sách mặc định rồi).
  // LOST vẫn giữ vì còn có thể quay lại liên hệ, chỉ tách/làm mờ khỏi pipeline chính.
  const activeStatusOptions = statusOptions.filter((option) => option.key !== "ENROLLED" && option.key !== "LOST");
  const closedStatusOptions = statusOptions.filter((option) => option.key === "LOST");

  function statusChipClass(key: string, isActive: boolean, count: number) {
    const cfg = LEAD_STATUS_CONFIG[key];
    if (!cfg) return "";
    const base = "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all duration-150 select-none";
    if (isActive) return `${base} ${cfg.activeColor} shadow-md scale-[1.03]`;
    if (count === 0) return `${base} ${cfg.color} opacity-40 cursor-default`;
    return `${base} ${cfg.color} hover:shadow-sm hover:scale-[1.01]`;
  }

  const totalActive = statusOptions.filter((o) => o.key !== "ENROLLED").reduce((s, o) => s + o.count, 0);

  const filterChips = (
    <div className="flex w-full flex-col gap-3" data-tour="leads-filters">
      {/* Row 1: Status filters */}
      {statusOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {/* All statuses pill */}
          <Link
            href={`/leads?${buildQuery({ status: null })}`}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all duration-150 ${
              !statusFilter
                ? "border-[#1d4ed8] bg-[#1d4ed8] text-white shadow-md scale-[1.03]"
                : "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8] hover:shadow-sm hover:scale-[1.01]"
            }`}
          >
            <span>Tất cả trạng thái</span>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${!statusFilter ? "bg-white/20 text-white" : "bg-[#1d4ed8]/10 text-[#1d4ed8]"}`}>
              {totalActive}
            </span>
          </Link>

          {/* Active pipeline chips */}
          {activeStatusOptions.map((option) => {
            const isActive = statusFilter === option.key;
            const cfg = LEAD_STATUS_CONFIG[option.key];
            return (
              <Link
                key={option.key}
                href={`/leads?${buildQuery({ status: option.key })}`}
                className={statusChipClass(option.key, isActive, option.count)}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-white" : cfg?.dot ?? "bg-current"}`} />
                <span>{option.label}</span>
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${isActive ? "bg-white/20 text-white" : "bg-current/10"}`}>
                  {option.count}
                </span>
              </Link>
            );
          })}

          {/* Divider + Closed/Lost */}
          {closedStatusOptions.length > 0 && (
            <>
              <div className="mx-1 h-5 w-px shrink-0 rounded-full bg-[#e5eaf7]" aria-hidden />
              {closedStatusOptions.map((option) => {
                const isActive = statusFilter === option.key;
                return (
                  <Link
                    key={option.key}
                    href={`/leads?${buildQuery({ status: option.key })}`}
                    className={statusChipClass(option.key, isActive, option.count)}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-white" : "bg-[#ef4444]"}`} />
                    <span>{option.label}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${isActive ? "bg-white/20 text-white" : "bg-current/10"}`}>
                      {option.count}
                    </span>
                  </Link>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Row 2: Lịch test sub-filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#f1f5f9] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#64748b]">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Lịch test
        </span>

        {testFilterActive && (
          <Link
            href={`/leads?${buildQuery({ testStatus: null, urgent: null })}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3 py-1.5 text-xs font-bold text-[#b91c1c] transition hover:bg-[#fee2e2]"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Bỏ lọc
          </Link>
        )}

        {testChips.map((chip) => (
          <Link
            key={chip.key}
            href={`/leads?${buildQuery(chip.query)}`}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all duration-150 ${
              chip.active
                ? "border-[#0f1729] bg-[#0f1729] text-white shadow-md scale-[1.03]"
                : chip.count === 0
                  ? "border-[#e5eaf7] bg-white text-[#94a3b8] opacity-50 cursor-default"
                  : "border-[#e5eaf7] bg-white text-[#475569] hover:border-[#3b82f6] hover:text-[#3b82f6] hover:shadow-sm"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                chip.active ? "bg-white" :
                chip.key === "overdue" ? "bg-[#ef4444]" :
                chip.key === "soon" ? "bg-[#f59e0b]" :
                "bg-[#94a3b8]"
              }`}
            />
            <span>{chip.label}</span>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${chip.active ? "bg-white/20 text-white" : "bg-[#f1f5f9] text-[#475569]"}`}>
              {chip.count}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <div data-tour="leads-table">
    <DataTableResponsive
      data={data}
      columns={columns}
      bulkActions={bulkActions}
      searchable
      searchPlaceholder="Tìm tên, mã lead, SĐT, phụ huynh..."
      onSearch={handleSearch}
      defaultSearchValue={searchQuery}
      filterChips={filterChips}
      showCountBadge={false}
      sortable
      selectable
      pagination={{
        total,
        page,
        pageSize,
        onPageChange: (newPage) => router.push(`/leads?${buildQuery({ page: newPage })}`),
        onPageSizeChange: (newSize) => router.push(`/leads?${buildQuery({ page: 1, pageSize: newSize })}`),
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
      primaryColumn="fullName"
      secondaryColumns={["leadCode", "status", "latestTest"]}
    />
    </div>
  );
}
