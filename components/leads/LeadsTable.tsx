"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column, BulkAction } from "@/components/ui/DataTable";
import { canView, canUpdate, canDelete } from "@/lib/server/role-matrix";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_FILTER_GROUPS,
  LEAD_SUB_STATUS,
  LEAD_SUB_STATUS_LABEL,
  leadSubStatusesOf,
  leadStatusGroupKey,
  PLACEMENT_TEST_STATUS_LABEL,
  PLACEMENT_TEST_BADGE_CLASS,
  DATE_URGENCY_CLASS,
  dateUrgency,
} from "@/lib/server/lead-rules";
import { exportToExcel, formatVnd } from "@/lib/export-utils";
import EditableNoteCell from "@/components/leads/EditableNoteCell";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import { useStudentDrawer } from "@/contexts/StudentDrawerContext";
import LeadDetailDrawer from "@/components/leads/LeadDetailDrawer";
import { useToast } from "@/components/ui/Toast";

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
  subStatus?: string | null;
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
  overdueCount?: number;
  todayCount?: number;
  tomorrowCount?: number;
  subStatusOptions?: { value: string; label: string; group: string; count: number }[];
  subStatusFilter?: string;
  classOptions?: { id: string; className: string }[];
  enrolledCount?: number;
};

const LEAD_STATUS_CONFIG: Record<string, { label: string; color: string; activeColor: string; dot: string }> = {
  CONTACTING:  { label: LEAD_STATUS_LABEL.CONTACTING,  color: "border-[#a5f3fc] bg-[#ecfeff] text-[#0e7490]",   activeColor: "border-[#0e7490] bg-[#0e7490] text-white",   dot: "bg-[#06b6d4]" },
  QUALIFIED:   { label: LEAD_STATUS_LABEL.QUALIFIED,   color: "border-[#fde68a] bg-[#fffbeb] text-[#b45309]",   activeColor: "border-[#b45309] bg-[#b45309] text-white",   dot: "bg-[#f59e0b]" },
  ENROLLED:    { label: LEAD_STATUS_LABEL.ENROLLED,    color: "border-[#a7f3d0] bg-[#ecfdf5] text-[#065f46]",   activeColor: "border-[#065f46] bg-[#065f46] text-white",   dot: "bg-[#10b981]" },
  LOST:        { label: LEAD_STATUS_LABEL.LOST,        color: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",   activeColor: "border-[#b91c1c] bg-[#b91c1c] text-white",   dot: "bg-[#ef4444]" },
};

function statusSelectClass(status: string) {
  const config = LEAD_STATUS_CONFIG[status] || LEAD_STATUS_CONFIG.CONTACTING;
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
  overdueCount = 0,
  todayCount = 0,
  tomorrowCount = 0,
  subStatusOptions = [],
  subStatusFilter = "",
  classOptions = [],
  enrolledCount = 0,
}: LeadsTableProps) {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const { openDrawer } = useStudentDrawer();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
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
      "data-tuyen-sinh",
      "Data tuyển sinh"
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
      toast.blocked(result.error ?? "Không thể đổi trạng thái lead.");
      return;
    }
    setData((current) => current.map((item) => (item.id === leadId ? { ...item, status: nextStatus } : item)));
    router.refresh();
  };

  // Trạng thái chi tiết (đã hẹn chưa test / trùng lịch / đợi lớp mới / đã xếp lớp...)
  // đổi ngay trên bảng như trạng thái nhóm, không bắt mở chi tiết.
  const changeLeadSubStatus = async (leadId: string, nextSubStatus: string) => {
    setStatusSavingId(leadId);
    const response = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subStatus: nextSubStatus || null }),
    });
    setStatusSavingId(null);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      toast.blocked(result.error ?? "Không thể đổi trạng thái chi tiết.");
      return;
    }
    setData((current) => current.map((item) => (item.id === leadId ? { ...item, subStatus: nextSubStatus || null } : item)));
    router.refresh();
  };

  const convertToStudent = async (leadId: string) => {
    setConvertingId(leadId);
    const response = await fetch(`/api/leads/${leadId}/convert`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    setConvertingId(null);
    if (!response.ok) {
      toast.blocked(result.error ?? "Không thể chuyển đổi thành học viên.");
      return;
    }
    openDrawer(result.item.id);
    router.refresh();
  };

  // Đọc searchParams hiện tại làm nền rồi patch đúng key được đổi — giữ nguyên MỌI
  // filter khác đang bật (leadCode/name/source/phone/meetDate/... ) thay vì dựng lại
  // URL từ 1 danh sách field cố định (bug cũ: đổi filter A sẽ xóa mất filter B đã chọn
  // vì buildQuery không biết B tồn tại). Trừ page: reset về 1 mỗi khi đổi filter, giữ
  // nguyên chỉ khi chính overrides đang set page (phân trang).
  function buildQuery(overrides: Record<string, string | number | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, String(value));
    }
    if (!("page" in overrides)) params.set("page", "1");
    if (!params.has("pageSize")) params.set("pageSize", String(pageSize));
    return params.toString();
  }

  const columns: Column<Lead>[] = [
    {
      key: "leadCode",
      label: "Mã lead",
      sortable: true,
      width: "110px",
      filter: { type: "text", paramKey: "leadCode", placeholder: "Mã lead..." },
      render: (value) => <span className="font-mono text-sm font-semibold text-primary">{value}</span>,
    },
    {
      key: "fullName",
      label: "Lead / phụ huynh",
      sortable: true,
      filter: { type: "text", paramKey: "name", placeholder: "Tên lead..." },
      render: (value, row) => (
        // Không có min-width thì cột này bị bóp còn ~145px, tên bị bẻ thành 3-4 dòng
        // ("Chưa / rõ"), dòng nào cũng cao gấp đôi và rất khó đọc.
        <div className="flex min-w-[210px] items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-600 text-sm font-bold text-white shadow-md">
            {value.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
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
      filter: { type: "text", paramKey: "phone", placeholder: "SĐT..." },
      render: (value, row) => (
        <div className="space-y-0.5 text-xs">
          <p className="text-ink-muted80">{value ?? "Chưa có SĐT"}</p>
          {row.secondaryPhone ? <p className="text-ink-muted48">{row.secondaryPhone}</p> : null}
          {row.zaloContact ? <p className="text-sky-700">Zalo {row.zaloContact}</p> : null}
        </div>
      ),
    },
    {
      key: "source",
      label: "Nguồn",
      width: "110px",
      filter: { type: "text", paramKey: "source", placeholder: "Nguồn..." },
      render: (value) => <span className="text-xs text-ink-muted80">{value ?? "—"}</span>,
    },
    {
      key: "meetDate",
      label: "Ngày gặp",
      filter: { type: "dateRange", paramKeyFrom: "meetFrom", paramKeyTo: "meetTo" },
      // Ngày gặp KHÔNG bôi màu theo yêu cầu vận hành: chỉ ngày hẹn test và ngày nhập
      // học mới là mốc phải gọi nhắc, tô màu cả ngày gặp làm bảng đỏ rực vô nghĩa.
      render: (value) => <span className="text-ink-muted80">{formatDate(value)}</span>,
    },
    {
      key: "latestTest",
      label: "Lịch test",
      filter: {
        type: "select",
        paramKey: "testStatus",
        placeholder: "Tất cả",
        // Chỉ lọc theo THỜI ĐIỂM (chưa hẹn / sắp tới hạn / đã quá hạn) — khớp đúng 3
        // chip "Lịch test" phía trên thanh tìm kiếm, không liệt kê kết quả test
        // (Đạt/Không đạt/...) vì đó không phải khái niệm "lịch" (thời điểm).
        options: [
          { label: "Chưa hẹn", value: "NONE" },
          { label: "Quá hạn", value: "overdue" },
          { label: "Hôm nay", value: "today" },
          { label: "Ngày mai", value: "tomorrow" },
        ],
      },
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
              {/* Ngày ĐẾN test là việc đã xảy ra — không phải mốc phải nhắc nên không bôi màu. */}
              <span className="text-ink-muted48">Đến:</span> <span className="text-ink-muted80">{formatDate(test?.testDate)}</span>
            </p>
          </div>
        );
      },
    },
    {
      key: "expectedStartDate",
      label: "Nhập học",
      filter: { type: "dateRange", paramKeyFrom: "startFrom", paramKeyTo: "startTo" },
      render: (_value, row) => (
        <div className="min-w-[130px] space-y-1 text-xs">
          <p>
            <span className="text-ink-muted48">Dự kiến:</span> <DateCell date={row.expectedStartDate} />
          </p>
          <p>
            {/* Đã nhập học thật rồi thì không còn gì để nhắc — để trơn như ngày gặp. */}
            <span className="text-ink-muted48">Thực tế:</span> <span className="text-ink-muted80">{formatDate(row.actualEnrollDate)}</span>
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Trạng thái",
      align: "center",
      // Ô chọn trạng thái phải đủ rộng để đọc được nhãn ("Chưa test"/"Đã test"...) —
      // để bảng tự co thì nó bị bóp còn mấy chục px, chỉ thấy cái chấm màu.
      width: "150px",
      filter: {
        type: "select",
        paramKey: "status",
        placeholder: "Tất cả",
        options: LEAD_STATUS_FILTER_GROUPS.map((group) => ({ label: group.label, value: group.key })),
      },
      render: (value, row) => {
        const isConverted = Boolean(row.hasStudent || row.convertedStudentCode || value === "ENROLLED");
        // Chỉ cho chọn các nhóm trong LEAD_STATUS_FILTER_GROUPS (lib/server/lead-rules.ts) —
        // ENROLLED không nằm trong đó vì chỉ đạt được qua luồng chuyển thành học viên thật.
        const currentGroupKey = leadStatusGroupKey(value);
        const cfg = LEAD_STATUS_CONFIG[currentGroupKey] || LEAD_STATUS_CONFIG[value] || LEAD_STATUS_CONFIG.CONTACTING;
        return (
          <div className="flex flex-col items-start gap-1.5" onClick={(e) => e.stopPropagation()}>
            {canUpdate("leads", userRole) && !isConverted ? (
              <div className={`relative inline-flex min-w-[132px] items-center gap-1.5 rounded-lg border pr-5 ${cfg.color} ${statusSavingId === row.id ? "opacity-60" : ""} [&_select]:focus:outline-none [&_select]:focus:ring-0 [&_select]:focus:shadow-none`}>
                <span className={`ml-2 h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
                <select
                  value={currentGroupKey}
                  disabled={statusSavingId === row.id}
                  onChange={(e) => {
                    e.stopPropagation();
                    const group = LEAD_STATUS_FILTER_GROUPS.find((item) => item.key === e.target.value);
                    const nextStatus = group?.statuses[0] ?? e.target.value;
                    if (nextStatus !== value) void changeLeadStatus(row.id, nextStatus);
                  }}
                  className="h-7 w-full appearance-none bg-transparent py-0 pl-0 pr-0 text-xs font-bold outline-none border-none ring-0 shadow-none focus:outline-none focus:ring-0 focus:border-none focus:shadow-none cursor-pointer"
                  style={{ WebkitAppearance: "none", MozAppearance: "none", outline: "none", boxShadow: "none" }}
                >
                  {/* Trạng thái lạ (dữ liệu cũ/import sai) không nằm trong nhóm nào —
                      phải thêm nó thành 1 option thật, nếu không <select> có value
                      không khớp option nào sẽ hiển thị option đầu tiên, và nhân viên
                      bấm đúng option đang hiện thì trình duyệt KHÔNG bắn onChange
                      (tưởng hệ thống hỏng). Hiện kèm nhãn "cần sửa" để biết mà đổi. */}
                  {!LEAD_STATUS_FILTER_GROUPS.some((group) => group.key === currentGroupKey) ? (
                    <option value={currentGroupKey}>{`${value} (không hợp lệ — chọn lại)`}</option>
                  ) : null}
                  {LEAD_STATUS_FILTER_GROUPS.map((group) => (
                    <option key={group.key} value={group.key}>
                      {group.label}
                    </option>
                  ))}
                </select>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="pointer-events-none absolute right-1.5 shrink-0 opacity-60"><path d="M6 9l6 6 6-6"/></svg>
              </div>
            ) : (
              <span className={`inline-flex min-w-[132px] items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-bold ${cfg.color}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {isConverted ? LEAD_STATUS_LABEL.ENROLLED : cfg.label}
              </span>
            )}

            {value === "QUALIFIED" && !isConverted && canUpdate("leads", userRole) && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); void convertToStudent(row.id); }}
                disabled={convertingId === row.id}
                className="inline-flex items-center gap-1 rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1 text-[11px] font-bold text-[#0f1729] transition hover:border-[#0f1729] disabled:opacity-50"
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
      // TRẠNG THÁI CHI TIẾT để CỘT RIÊNG — nhét chung ô trạng thái thì select bị bóp còn
      // vài chục px, chữ cụt hết không ai đọc được.
      key: "subStatus",
      label: "Chi tiết",
      width: "170px",
      filter: {
        type: "select",
        paramKey: "sub",
        placeholder: "Tất cả",
        options: LEAD_SUB_STATUS.map((item) => ({ label: item.label, value: item.value })),
      },
      render: (value, row) => {
        const isConverted = Boolean(row.hasStudent || row.convertedStudentCode || row.status === "ENROLLED");
        const options = leadSubStatusesOf(leadStatusGroupKey(row.status));
        if (isConverted || options.length === 0) return <span className="text-xs text-ink-muted48">—</span>;
        if (!canUpdate("leads", userRole)) {
          return value ? (
            <span className="text-xs font-semibold text-[#475569]">{LEAD_SUB_STATUS_LABEL[value] ?? value}</span>
          ) : (
            <span className="text-xs text-ink-muted48">—</span>
          );
        }
        return (
          <select
            value={value ?? ""}
            disabled={statusSavingId === row.id}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              void changeLeadSubStatus(row.id, e.target.value);
            }}
            className="h-8 w-full min-w-[150px] cursor-pointer rounded-lg border border-[#e5eaf7] bg-white px-2 text-xs font-semibold text-[#475569] outline-none"
          >
            <option value="">Chưa chọn</option>
            {options.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: "notes",
      label: "Ghi chú",
      filter: { type: "text", paramKey: "notes", placeholder: "Tìm ghi chú..." },
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
          {/* Nút "Cập nhật test" đã bỏ khỏi bảng — hẹn/cập nhật test làm trong drawer chi tiết
              lead (bấm vào dòng), nơi nhìn thấy đủ lịch sử test trước khi sửa. */}
          {/* Không còn nút "Xem" riêng — trước đây "Xem" và "Sửa" mở CÙNG 1 drawer, chỉ
              khác icon. Giờ đúng 3 tác vụ: sửa lịch hẹn, sửa (mở drawer, sửa tại chỗ), xóa. */}
          {canUpdate("leads", userRole) ? (
            <button type="button" onClick={() => setSelectedLeadId(row.id)} className="btn-icon" title="Sửa" aria-label="Sửa">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          ) : null}
          {canDelete("leads", userRole) ? (
            <ConfirmActionButton
              title="Xác nhận xóa lead?"
              description={`Lead ${row.fullName} sẽ bị xóa khỏi Data tuyển sinh.`}
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

  // Lọc theo từng cột (hàng cố định dưới header) — patch 1 paramKey qua buildQuery(),
  // tái dùng đúng cơ chế điều hướng URL sẵn có (không phát minh luồng fetch thứ 2).
  const handleFilterChange = (key: string, value: string | null, extra?: Record<string, string | null>) => {
    setLoading(true);
    // Dropdown lọc cột "Lịch test" gộp chung 1 ô chọn nhưng thật ra đi 2 param khác
    // nhau ở URL — "Chưa hẹn" là testStatus=NONE, còn "Sắp tới"/"Quá hạn" là lát cắt
    // theo ngày (urgent=soon|overdue), không phải giá trị testStatus thật.
    if (key === "testStatus" && (value === "overdue" || value === "today" || value === "tomorrow")) {
      router.push(`/leads?${buildQuery({ urgent: value, testStatus: null, ...extra })}`);
      return;
    }
    if (key === "testStatus") {
      router.push(`/leads?${buildQuery({ [key]: value, urgent: null, ...extra })}`);
      return;
    }
    router.push(`/leads?${buildQuery({ [key]: value, ...extra })}`);
  };

  const filterValues = {
    leadCode: searchParams.get("leadCode") ?? "",
    name: searchParams.get("name") ?? "",
    source: searchParams.get("source") ?? "",
    status: statusFilter,
    phone: searchParams.get("phone") ?? "",
    meetFrom: searchParams.get("meetFrom") ?? "",
    meetTo: searchParams.get("meetTo") ?? "",
    startFrom: searchParams.get("startFrom") ?? "",
    startTo: searchParams.get("startTo") ?? "",
    notes: searchParams.get("notes") ?? "",
    // Hiện đúng lựa chọn đang active trong dropdown dù trạng thái đó lưu ở param nào
    // (testStatus=NONE hay urgent=soon|overdue) — xem handleFilterChange ở trên.
    testStatus: ["overdue", "today", "tomorrow"].includes(urgentFilter) ? urgentFilter : testStatusFilter,
  };

  // MỘT THANH LỌC DUY NHẤT, không còn 3 cụm chồng chéo nhau:
  //   [4 nhóm trạng thái] · [chi tiết của nhóm đang chọn] · [nhắc hẹn] · [bỏ lọc]
  // Trước đây có cả chip "Chưa hẹn test" ở cụm báo động trong khi cụm chi tiết đã có
  // "Chưa liên hệ được" — hai chip lọc gần như cùng một tập người, lại nằm 2 cụm khác
  // nhau nên nhìn rất rối. Mỗi cụm còn có nút "bỏ lọc" riêng, bấm cái này không tắt cái
  // kia. Nay chỉ còn MỘT nút "Bỏ lọc" tắt sạch, và mọi chip đều bấm lại là tắt.
  const alertChips: { key: string; label: string; count: number; dot: string }[] = [
    { key: "overdue", label: "Quá hạn", count: overdueCount, dot: "bg-[#ef4444]" },
    { key: "today", label: "Hôm nay", count: todayCount, dot: "bg-[#f97316]" },
    { key: "tomorrow", label: "Ngày mai", count: tomorrowCount, dot: "bg-[#f59e0b]" },
  ];

  // Chi tiết chỉ hiện khi đã chọn một nhóm CÓ chi tiết (Chưa test / Đã test) — chưa chọn
  // nhóm nào mà bày hết 5 chip chi tiết thì người dùng không hiểu chúng thuộc về đâu.
  const visibleSubStatuses = statusFilter ? subStatusOptions.filter((item) => item.group === statusFilter) : [];
  const anyFilterActive = Boolean(statusFilter || subStatusFilter || urgentFilter || testStatusFilter);

  function statusChipClass(key: string, isActive: boolean, count: number) {
    const cfg = LEAD_STATUS_CONFIG[key];
    if (!cfg) return "";
    const base = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all duration-150 select-none";
    if (isActive) return `${base} ${cfg.activeColor} shadow-md`;
    if (count === 0) return `${base} ${cfg.color} opacity-40`;
    return `${base} ${cfg.color} hover:shadow-sm`;
  }

  const plainChipClass = (isActive: boolean, count: number) =>
    `inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all duration-150 ${
      isActive
        ? "border-[#0f1729] bg-[#0f1729] text-white shadow-md"
        : count === 0
          ? "border-[#e5eaf7] bg-white text-[#94a3b8] opacity-50"
          : "border-[#e5eaf7] bg-white text-[#475569] hover:border-[#0f1729] hover:text-[#0f1729]"
    }`;

  const countClass = (isActive: boolean) =>
    `rounded-md px-1.5 py-0.5 text-[10px] font-black ${isActive ? "bg-white/20 text-white" : "bg-[#f1f5f9] text-[#475569]"}`;

  const totalActive = statusOptions.reduce((s, o) => s + o.count, 0);

  const filterChips = (
    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2" data-tour="leads-filters">
      {/* 1. Trạng thái — trục chính của trang, luôn hiện đủ 5 lựa chọn. */}
      <Link href={`/leads?${buildQuery({ status: null, sub: null })}`} className={statusChipClass("CONTACTING", false, 1)
        .replace(LEAD_STATUS_CONFIG.CONTACTING.color, !statusFilter ? "border-[#0f1729] bg-[#0f1729] text-white shadow-md" : "border-[#e5eaf7] bg-white text-[#475569] hover:border-[#0f1729]")}
      >
        <span>Tất cả</span>
        <span className={countClass(!statusFilter)}>{totalActive}</span>
      </Link>

      {statusOptions.map((option) => {
        const isActive = statusFilter === option.key;
        const cfg = LEAD_STATUS_CONFIG[option.key];
        return (
          <Link
            key={option.key}
            href={`/leads?${buildQuery(isActive ? { status: null, sub: null } : { status: option.key, sub: null })}`}
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

      <Link
        href={`/leads?${buildQuery(statusFilter === "ENROLLED" ? { status: null, sub: null } : { status: "ENROLLED", sub: null })}`}
        className={statusChipClass("ENROLLED", statusFilter === "ENROLLED", enrolledCount)}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${statusFilter === "ENROLLED" ? "bg-white" : LEAD_STATUS_CONFIG.ENROLLED.dot}`} />
        <span>Đã nhập học</span>
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${statusFilter === "ENROLLED" ? "bg-white/20 text-white" : "bg-current/10"}`}>
          {enrolledCount}
        </span>
      </Link>

      {/* 2. Chi tiết của đúng nhóm vừa chọn — nằm ngay sau nhóm đó, ngăn bằng 1 vạch. */}
      {visibleSubStatuses.length > 0 ? (
        <>
          <div className="h-5 w-px shrink-0 rounded-full bg-[#e5eaf7]" aria-hidden />
          {visibleSubStatuses.map((item) => {
            const isActive = subStatusFilter === item.value;
            return (
              <Link
                key={item.value}
                href={`/leads?${buildQuery({ sub: isActive ? null : item.value, status: item.group })}`}
                className={plainChipClass(isActive, item.count)}
              >
                <span>{item.label}</span>
                <span className={countClass(isActive)}>{item.count}</span>
              </Link>
            );
          })}
        </>
      ) : null}

      {/* 3. Nhắc hẹn (ngày hẹn test + ngày dự kiến nhập học) — đẩy sang phải. */}
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#b91c1c]">Nhắc hẹn</span>
        {alertChips.map((chip) => {
          const isActive = urgentFilter === chip.key;
          return (
            <Link
              key={chip.key}
              href={`/leads?${buildQuery({ urgent: isActive ? null : chip.key, testStatus: null, from: null, to: null })}`}
              className={plainChipClass(isActive, chip.count)}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-white" : chip.dot}`} />
              <span>{chip.label}</span>
              <span className={countClass(isActive)}>{chip.count}</span>
            </Link>
          );
        })}

        {/* MỘT nút bỏ lọc duy nhất, tắt sạch mọi bộ lọc đang bật. */}
        {anyFilterActive ? (
          <Link
            href={`/leads?${buildQuery({ status: null, sub: null, urgent: null, testStatus: null })}`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#fecaca] bg-[#fef2f2] px-2.5 py-1.5 text-xs font-bold text-[#b91c1c] transition hover:bg-[#fee2e2]"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Bỏ lọc
          </Link>
        ) : null}
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
      chipsBlock
      filterValues={filterValues}
      onFilterChange={handleFilterChange}
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
        description: "Bắt đầu bằng cách bấm nút \"Thêm lead\" ở trên để thêm lead đầu tiên vào Data tuyển sinh.",
      }}
      loading={loading}
      stickyHeader
      rowKey="id"
      onRowClick={(row) => setSelectedLeadId(row.id)}
      primaryColumn="fullName"
      secondaryColumns={["leadCode", "status", "latestTest"]}
    />
    <LeadDetailDrawer leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} classOptions={classOptions} />
    </div>
  );
}
