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
  return date ? new Date(date).toLocaleDateString("vi-VN") : "â€”";
}

function DateCell({ date }: { date: Date | string | null | undefined }) {
  if (!date) return <span className="text-ink-muted48">â€”</span>;
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
        { key: "leadCode", label: "MÃ£ lead" },
        { key: "fullName", label: "Há» vÃ  tÃªn" },
        { key: "guardianName", label: "Phá»¥ huynh" },
        { key: "guardianPortal", label: "Portal phá»¥ huynh" },
        { key: "phone", label: "Sá»‘ Ä‘iá»‡n thoáº¡i" },
        { key: "age", label: "Tuá»•i" },
        { key: "source", label: "Nguá»“n" },
        { key: "convertedStudent", label: "MÃ£ há»c viÃªn" },
        { key: "convertedClass", label: "Lá»›p Ä‘Ã£ vÃ o" },
        { key: "outstanding", label: "CÃ´ng ná»£" },
        { key: "status", label: "Tráº¡ng thÃ¡i" },
      ],
      "data-tuyen-sinh",
      "Data tuyá»ƒn sinh"
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
      toast.blocked(result.error ?? "KhÃ´ng thá»ƒ Ä‘á»•i tráº¡ng thÃ¡i lead.");
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
      toast.blocked(result.error ?? "KhÃ´ng thá»ƒ chuyá»ƒn Ä‘á»•i thÃ nh há»c viÃªn.");
      return;
    }
    openDrawer(result.item.id);
    router.refresh();
  };

  // Äá»c searchParams hiá»‡n táº¡i lÃ m ná»n rá»“i patch Ä‘Ãºng key Ä‘Æ°á»£c Ä‘á»•i â€” giá»¯ nguyÃªn Má»ŒI
  // filter khÃ¡c Ä‘ang báº­t (leadCode/name/source/phone/meetDate/... ) thay vÃ¬ dá»±ng láº¡i
  // URL tá»« 1 danh sÃ¡ch field cá»‘ Ä‘á»‹nh (bug cÅ©: Ä‘á»•i filter A sáº½ xÃ³a máº¥t filter B Ä‘Ã£ chá»n
  // vÃ¬ buildQuery khÃ´ng biáº¿t B tá»“n táº¡i). Trá»« page: reset vá» 1 má»—i khi Ä‘á»•i filter, giá»¯
  // nguyÃªn chá»‰ khi chÃ­nh overrides Ä‘ang set page (phÃ¢n trang).
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
      label: "MÃ£ lead",
      sortable: true,
      width: "110px",
      filter: { type: "text", paramKey: "leadCode", placeholder: "MÃ£ lead..." },
      render: (value) => <span className="font-mono text-sm font-semibold text-primary">{value}</span>,
    },
    {
      key: "fullName",
      label: "Lead / phá»¥ huynh",
      sortable: true,
      filter: { type: "text", paramKey: "name", placeholder: "TÃªn lead..." },
      render: (value, row) => (
        // KhÃ´ng cÃ³ min-width thÃ¬ cá»™t nÃ y bá»‹ bÃ³p cÃ²n ~145px, tÃªn bá»‹ báº» thÃ nh 3-4 dÃ²ng
        // ("ChÆ°a / rÃµ"), dÃ²ng nÃ o cÅ©ng cao gáº¥p Ä‘Ã´i vÃ  ráº¥t khÃ³ Ä‘á»c.
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
                  title={`TrÃ¹ng SÄT vá»›i: ${row.duplicatePhoneNames.join(", ")}`}
                >
                  TrÃ¹ng SÄT
                </span>
              ) : null}
            </div>
            {row.guardianName ? <p className="text-xs text-ink-muted48">PH: {row.guardianName}</p> : null}
            <p className={`text-xs ${row.guardianPortalEmail ? (row.guardianPortalActive ? "text-sky-700" : "text-ink-muted48") : "text-ink-muted48"}`}>
              {row.guardianPortalEmail ?? "ChÆ°a cáº¥p portal"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      label: "LiÃªn há»‡",
      filter: { type: "text", paramKey: "phone", placeholder: "SÄT..." },
      render: (value, row) => (
        <div className="space-y-0.5 text-xs">
          <p className="text-ink-muted80">{value ?? "ChÆ°a cÃ³ SÄT"}</p>
          {row.secondaryPhone ? <p className="text-ink-muted48">{row.secondaryPhone}</p> : null}
          {row.zaloContact ? <p className="text-sky-700">Zalo {row.zaloContact}</p> : null}
        </div>
      ),
    },
    {
      key: "source",
      label: "Nguá»“n",
      width: "110px",
      filter: { type: "text", paramKey: "source", placeholder: "Nguá»“n..." },
      render: (value) => <span className="text-xs text-ink-muted80">{value ?? "â€”"}</span>,
    },
    {
      key: "meetDate",
      label: "NgÃ y gáº·p",
      filter: { type: "dateRange", paramKeyFrom: "meetFrom", paramKeyTo: "meetTo" },
      // NgÃ y gáº·p KHÃ”NG bÃ´i mÃ u theo yÃªu cáº§u váº­n hÃ nh: chá»‰ ngÃ y háº¹n test vÃ  ngÃ y nháº­p
      // há»c má»›i lÃ  má»‘c pháº£i gá»i nháº¯c, tÃ´ mÃ u cáº£ ngÃ y gáº·p lÃ m báº£ng Ä‘á» rá»±c vÃ´ nghÄ©a.
      render: (value) => <span className="text-ink-muted80">{formatDate(value)}</span>,
    },
    {
      key: "latestTest",
      label: "Lá»‹ch test",
      filter: {
        type: "select",
        paramKey: "testStatus",
        placeholder: "Táº¥t cáº£",
        // Chá»‰ lá»c theo THá»œI ÄIá»‚M (chÆ°a háº¹n / sáº¯p tá»›i háº¡n / Ä‘Ã£ quÃ¡ háº¡n) â€” khá»›p Ä‘Ãºng 3
        // chip "Lá»‹ch test" phÃ­a trÃªn thanh tÃ¬m kiáº¿m, khÃ´ng liá»‡t kÃª káº¿t quáº£ test
        // (Äáº¡t/KhÃ´ng Ä‘áº¡t/...) vÃ¬ Ä‘Ã³ khÃ´ng pháº£i khÃ¡i niá»‡m "lá»‹ch" (thá»i Ä‘iá»ƒm).
        options: [
          { label: "ChÆ°a háº¹n", value: "NONE" },
          { label: "QuÃ¡ háº¡n", value: "overdue" },
          { label: "HÃ´m nay", value: "today" },
          { label: "NgÃ y mai", value: "tomorrow" },
        ],
      },
      render: (_value, row) => {
        const test = row.latestTest;
        return (
          <div className="min-w-[150px] space-y-1 text-xs">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${PLACEMENT_TEST_BADGE_CLASS[test?.status ?? "NONE"]}`}>
              {test ? PLACEMENT_TEST_STATUS_LABEL[test.status] ?? test.status : "ChÆ°a háº¹n"}
            </span>
            <p>
              <span className="text-ink-muted48">Háº¹n:</span> <DateCell date={test?.scheduledDate} />
            </p>
            <p>
              {/* NgÃ y Äáº¾N test lÃ  viá»‡c Ä‘Ã£ xáº£y ra â€” khÃ´ng pháº£i má»‘c pháº£i nháº¯c nÃªn khÃ´ng bÃ´i mÃ u. */}
              <span className="text-ink-muted48">Äáº¿n:</span> <span className="text-ink-muted80">{formatDate(test?.testDate)}</span>
            </p>
          </div>
        );
      },
    },
    {
      key: "expectedStartDate",
      label: "Nháº­p há»c",
      filter: { type: "dateRange", paramKeyFrom: "startFrom", paramKeyTo: "startTo" },
      render: (_value, row) => (
        <div className="min-w-[130px] space-y-1 text-xs">
          <p>
            <span className="text-ink-muted48">Dá»± kiáº¿n:</span> <DateCell date={row.expectedStartDate} />
          </p>
          <p>
            {/* ÄÃ£ nháº­p há»c tháº­t rá»“i thÃ¬ khÃ´ng cÃ²n gÃ¬ Ä‘á»ƒ nháº¯c â€” Ä‘á»ƒ trÆ¡n nhÆ° ngÃ y gáº·p. */}
            <span className="text-ink-muted48">Thá»±c táº¿:</span> <span className="text-ink-muted80">{formatDate(row.actualEnrollDate)}</span>
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Tráº¡ng thÃ¡i",
      align: "center",
      // Ã” chá»n tráº¡ng thÃ¡i pháº£i Ä‘á»§ rá»™ng Ä‘á»ƒ Ä‘á»c Ä‘Æ°á»£c nhÃ£n ("ChÆ°a test"/"ÄÃ£ test"...) â€”
      // Ä‘á»ƒ báº£ng tá»± co thÃ¬ nÃ³ bá»‹ bÃ³p cÃ²n máº¥y chá»¥c px, chá»‰ tháº¥y cÃ¡i cháº¥m mÃ u.
      width: "150px",
      filter: {
        type: "select",
        paramKey: "status",
        placeholder: "Táº¥t cáº£",
        options: LEAD_STATUS_FILTER_GROUPS.map((group) => ({ label: group.label, value: group.key })),
      },
      render: (value, row) => {
        const isConverted = Boolean(row.hasStudent || row.convertedStudentCode || value === "ENROLLED");
        // Chá»‰ cho chá»n cÃ¡c nhÃ³m trong LEAD_STATUS_FILTER_GROUPS (lib/server/lead-rules.ts) â€”
        // ENROLLED khÃ´ng náº±m trong Ä‘Ã³ vÃ¬ chá»‰ Ä‘áº¡t Ä‘Æ°á»£c qua luá»“ng chuyá»ƒn thÃ nh há»c viÃªn tháº­t.
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
                  {/* Tráº¡ng thÃ¡i láº¡ (dá»¯ liá»‡u cÅ©/import sai) khÃ´ng náº±m trong nhÃ³m nÃ o â€”
                      pháº£i thÃªm nÃ³ thÃ nh 1 option tháº­t, náº¿u khÃ´ng <select> cÃ³ value
                      khÃ´ng khá»›p option nÃ o sáº½ hiá»ƒn thá»‹ option Ä‘áº§u tiÃªn, vÃ  nhÃ¢n viÃªn
                      báº¥m Ä‘Ãºng option Ä‘ang hiá»‡n thÃ¬ trÃ¬nh duyá»‡t KHÃ”NG báº¯n onChange
                      (tÆ°á»Ÿng há»‡ thá»‘ng há»ng). Hiá»‡n kÃ¨m nhÃ£n "cáº§n sá»­a" Ä‘á»ƒ biáº¿t mÃ  Ä‘á»•i. */}
                  {!LEAD_STATUS_FILTER_GROUPS.some((group) => group.key === currentGroupKey) ? (
                    <option value={currentGroupKey}>{`${value} (khÃ´ng há»£p lá»‡ â€” chá»n láº¡i)`}</option>
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

          </div>
        );
      },
    },
    {
      key: "notes",
      label: "Ghi chÃº",
      filter: { type: "text", paramKey: "notes", placeholder: "TÃ¬m ghi chÃº..." },
      render: (value, row) => (
        <div onClick={(event) => event.stopPropagation()} className="max-w-[220px]">
          <EditableNoteCell leadId={row.id} notes={value ?? null} />
        </div>
      ),
    },
    {
      key: "id",
      label: "TÃ¡c vá»¥",
      render: (_value, row) => (
        <div onClick={(event) => event.stopPropagation()} className="flex flex-wrap items-center gap-1.5">
          {/* NÃºt "Cáº­p nháº­t test" Ä‘Ã£ bá» khá»i báº£ng â€” háº¹n/cáº­p nháº­t test lÃ m trong drawer chi tiáº¿t
              lead (báº¥m vÃ o dÃ²ng), nÆ¡i nhÃ¬n tháº¥y Ä‘á»§ lá»‹ch sá»­ test trÆ°á»›c khi sá»­a. */}
          {/* KhÃ´ng cÃ²n nÃºt "Xem" riÃªng â€” trÆ°á»›c Ä‘Ã¢y "Xem" vÃ  "Sá»­a" má»Ÿ CÃ™NG 1 drawer, chá»‰
              khÃ¡c icon. Giá» Ä‘Ãºng 3 tÃ¡c vá»¥: sá»­a lá»‹ch háº¹n, sá»­a (má»Ÿ drawer, sá»­a táº¡i chá»—), xÃ³a. */}
          {canUpdate("leads", userRole) ? (
            <button type="button" onClick={() => setSelectedLeadId(row.id)} className="btn-icon" title="Sá»­a" aria-label="Sá»­a">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          ) : null}
          {canDelete("leads", userRole) ? (
            <ConfirmActionButton
              title="XÃ¡c nháº­n xÃ³a lead?"
              description={`Lead ${row.fullName} sáº½ bá»‹ xÃ³a khá»i Data tuyá»ƒn sinh.`}
              confirmLabel="XÃ³a lead"
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
      label: "Xuáº¥t Excel",
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
      label: "ÄÃ¡nh dáº¥u Ä‘ang liÃªn há»‡",
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
      confirmMessage: "Báº¡n cÃ³ cháº¯c muá»‘n chuyá»ƒn cÃ¡c lead Ä‘Ã£ chá»n sang tráº¡ng thÃ¡i Ä‘ang liÃªn há»‡?",
    });
  }

  if (canDelete("leads", userRole)) {
    bulkActions.push({
      label: "XÃ³a",
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
      confirmMessage: "Báº¡n cÃ³ cháº¯c muá»‘n xÃ³a lead? Thao tÃ¡c nÃ y khÃ´ng thá»ƒ hoÃ n tÃ¡c.",
    });
  }

  const handleSearch = (query: string) => {
    setLoading(true);
    router.push(`/leads?${buildQuery({ q: query || null })}`);
  };

  // Lá»c theo tá»«ng cá»™t (hÃ ng cá»‘ Ä‘á»‹nh dÆ°á»›i header) â€” patch 1 paramKey qua buildQuery(),
  // tÃ¡i dÃ¹ng Ä‘Ãºng cÆ¡ cháº¿ Ä‘iá»u hÆ°á»›ng URL sáºµn cÃ³ (khÃ´ng phÃ¡t minh luá»“ng fetch thá»© 2).
  const handleFilterChange = (key: string, value: string | null, extra?: Record<string, string | null>) => {
    setLoading(true);
    // Dropdown lá»c cá»™t "Lá»‹ch test" gá»™p chung 1 Ã´ chá»n nhÆ°ng tháº­t ra Ä‘i 2 param khÃ¡c
    // nhau á»Ÿ URL â€” "ChÆ°a háº¹n" lÃ  testStatus=NONE, cÃ²n "Sáº¯p tá»›i"/"QuÃ¡ háº¡n" lÃ  lÃ¡t cáº¯t
    // theo ngÃ y (urgent=soon|overdue), khÃ´ng pháº£i giÃ¡ trá»‹ testStatus tháº­t.
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
    // Hiá»‡n Ä‘Ãºng lá»±a chá»n Ä‘ang active trong dropdown dÃ¹ tráº¡ng thÃ¡i Ä‘Ã³ lÆ°u á»Ÿ param nÃ o
    // (testStatus=NONE hay urgent=soon|overdue) â€” xem handleFilterChange á»Ÿ trÃªn.
    testStatus: ["overdue", "today", "tomorrow"].includes(urgentFilter) ? urgentFilter : testStatusFilter,
  };

  // Má»˜T THANH Lá»ŒC DUY NHáº¤T, khÃ´ng cÃ²n 3 cá»¥m chá»“ng chÃ©o nhau:
  //   [4 nhÃ³m tráº¡ng thÃ¡i] Â· [chi tiáº¿t cá»§a nhÃ³m Ä‘ang chá»n] Â· [nháº¯c háº¹n] Â· [bá» lá»c]
  // TrÆ°á»›c Ä‘Ã¢y cÃ³ cáº£ chip "ChÆ°a háº¹n test" á»Ÿ cá»¥m bÃ¡o Ä‘á»™ng trong khi cá»¥m chi tiáº¿t Ä‘Ã£ cÃ³
  // "ChÆ°a liÃªn há»‡ Ä‘Æ°á»£c" â€” hai chip lá»c gáº§n nhÆ° cÃ¹ng má»™t táº­p ngÆ°á»i, láº¡i náº±m 2 cá»¥m khÃ¡c
  // nhau nÃªn nhÃ¬n ráº¥t rá»‘i. Má»—i cá»¥m cÃ²n cÃ³ nÃºt "bá» lá»c" riÃªng, báº¥m cÃ¡i nÃ y khÃ´ng táº¯t cÃ¡i
  // kia. Nay chá»‰ cÃ²n Má»˜T nÃºt "Bá» lá»c" táº¯t sáº¡ch, vÃ  má»i chip Ä‘á»u báº¥m láº¡i lÃ  táº¯t.
  const alertChips: { key: string; label: string; count: number; dot: string }[] = [
    { key: "overdue", label: "QuÃ¡ háº¡n", count: overdueCount, dot: "bg-[#ef4444]" },
    { key: "today", label: "HÃ´m nay", count: todayCount, dot: "bg-[#f97316]" },
    { key: "tomorrow", label: "NgÃ y mai", count: tomorrowCount, dot: "bg-[#f59e0b]" },
  ];

  const anyFilterActive = Boolean(statusFilter || urgentFilter || testStatusFilter);

  function statusChipClass(key: string, isActive: boolean, count: number) {
    const cfg = LEAD_STATUS_CONFIG[key];
    if (!cfg) return "";
    const base = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all duration-150 select-none";
    if (isActive) return `${base} ${cfg.activeColor} shadow-md`;
    if (count === 0) return `${base} ${cfg.color} opacity-40`;
    return `${base} ${cfg.color} hover:shadow-sm`;
  }


  const countClass = (isActive: boolean) =>
    `rounded-md px-1.5 py-0.5 text-[10px] font-black ${isActive ? "bg-white/20 text-white" : "bg-[#f1f5f9] text-[#475569]"}`;

  const totalActive = statusOptions.reduce((s, o) => s + o.count, 0);

  const filterChips = (
    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2" data-tour="leads-filters">
      {/* 1. Tráº¡ng thÃ¡i â€” trá»¥c chÃ­nh cá»§a trang, luÃ´n hiá»‡n Ä‘á»§ 5 lá»±a chá»n. */}
      <Link href={`/leads?${buildQuery({ status: null, sub: null })}`} className={statusChipClass("CONTACTING", false, 1)
        .replace(LEAD_STATUS_CONFIG.CONTACTING.color, !statusFilter ? "border-[#0f1729] bg-[#0f1729] text-white shadow-md" : "border-[#e5eaf7] bg-white text-[#475569] hover:border-[#0f1729]")}
      >
        <span>Táº¥t cáº£</span>
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
        <span>ÄÃ£ nháº­p há»c</span>
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${statusFilter === "ENROLLED" ? "bg-white/20 text-white" : "bg-current/10"}`}>
          {enrolledCount}
        </span>
      </Link>


      {/* 3. Nháº¯c háº¹n (ngÃ y háº¹n test + ngÃ y dá»± kiáº¿n nháº­p há»c) â€” Ä‘áº©y sang pháº£i. */}
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#b91c1c]">Nháº¯c háº¹n</span>
        {alertChips.map((chip) => {
          const isActive = urgentFilter === chip.key;
          return (
            <Link
              key={chip.key}
              href={`/leads?${buildQuery({ urgent: isActive ? null : chip.key, testStatus: null, from: null, to: null })}`}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all duration-150 ${
                isActive
                  ? "border-[#0f1729] bg-[#0f1729] text-white shadow-md"
                  : chip.count === 0
                    ? "border-[#e5eaf7] bg-white text-[#94a3b8] opacity-50"
                    : "border-[#e5eaf7] bg-white text-[#475569] hover:border-[#0f1729] hover:text-[#0f1729]"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-white" : chip.dot}`} />
              <span>{chip.label}</span>
              <span className={countClass(isActive)}>{chip.count}</span>
            </Link>
          );
        })}

        {/* Má»˜T nÃºt bá» lá»c duy nháº¥t, táº¯t sáº¡ch má»i bá»™ lá»c Ä‘ang báº­t. */}
        {anyFilterActive ? (
          <Link
            href={`/leads?${buildQuery({ status: null, sub: null, urgent: null, testStatus: null })}`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#fecaca] bg-[#fef2f2] px-2.5 py-1.5 text-xs font-bold text-[#b91c1c] transition hover:bg-[#fee2e2]"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Bá» lá»c
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
      searchPlaceholder="TÃ¬m tÃªn, mÃ£ lead, SÄT, phá»¥ huynh..."
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
        title: "ChÆ°a cÃ³ lead",
        description: "Báº¯t Ä‘áº§u báº±ng cÃ¡ch báº¥m nÃºt \"ThÃªm Data\" á»Ÿ trÃªn Ä‘á»ƒ thÃªm data Ä‘áº§u tiÃªn vÃ o Data tuyá»ƒn sinh.",
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
