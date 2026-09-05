"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import TestQuickAction from "@/components/leads/TestQuickAction";
import { useStudentDrawer } from "@/contexts/StudentDrawerContext";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_FILTER_GROUPS,
  leadStatusGroupKey,
  PLACEMENT_TEST_STATUS_LABEL,
} from "@/lib/server/lead-rules";

// Drawer chi tiết lead — CỐ TÌNH giữ đúng 1 màn, không tab, không thẻ KPI, không đoạn
// giải thích dài. Danh sách trường ở đây bám đúng các trường của form "Thêm lead"
// (NewLeadDrawer.tsx): trường nào chưa có dữ liệu thì để trống, không bịa thêm mục.
// Trước đây màn này có 3 tab + 4 thẻ đếm + 2 khối lặp lại thông tin phụ huynh + 3 khối
// guide dài — quá nặng so với việc thực tế cần làm ở đây (xem nhanh, sửa, đặt lịch hẹn).

const INTERACTION_LABEL: Record<string, string> = {
  CALL: "Gọi điện",
  MEET: "Gặp trực tiếp",
  MESSAGE: "Nhắn tin",
  EMAIL: "Email",
};

const GENDER_LABEL: Record<string, string> = { MALE: "Nam", FEMALE: "Nữ", OTHER: "Khác" };

const SOURCE_OPTIONS = ["Facebook", "Google", "Giới thiệu", "Walk-in", "Website", "Zalo", "Khác"];

function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("vi-VN") : "";
}

function toYmd(d: string | null) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

/** 1 dòng thông tin: chỉ nhãn + giá trị, trống thì để trống hẳn (dấu —). */
function Row({ label, children }: { label: string; children?: React.ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className="flex gap-3 border-b border-[#f1f5f9] py-2 last:border-0">
      <span className="w-[132px] shrink-0 text-xs text-[#94a3b8]">{label}</span>
      <span className={`flex-1 text-sm ${empty ? "text-[#cbd5e1]" : "font-medium text-[#0f1729]"}`}>{empty ? "—" : children}</span>
    </div>
  );
}

/** 1 dòng khi đang sửa: nhãn + input, cùng lưới với chế độ xem để không nhảy layout. */
function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-[#f1f5f9] py-1.5 last:border-0">
      <span className="w-[132px] shrink-0 text-xs text-[#94a3b8]">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export type LeadDetailData = {
  lead: {
    id: string;
    leadCode: string;
    fullName: string;
    status: string;
    gender: string | null;
    dob: string | null;
    currentSchoolGrade: string | null;
    phone: string | null;
    secondaryPhone: string | null;
    zaloContact: string | null;
    address: string | null;
    source: string | null;
    facebookParentName: string | null;
    facebookLink: string | null;
    initialAssessment: string | null;
    pendingRemedialSessions: number | null;
    notes: string | null;
    meetDate: string | null;
    expectedStartDate: string | null;
    actualEnrollDate: string | null;
    interestedClassId: string | null;
    guardian: { id: string; fullName: string; phone: string | null } | null;
    interestedClass: { className: string; classCode: string } | null;
    interactions: { id: string; type: string; content: string | null; occurredAt: string }[];
    placementTests: { id: string; scheduledDate: string | null; testDate: string | null; status: string; result: string | null }[];
    student: { id: string; fullName: string } | null;
  };
  editable: boolean;
  deletable?: boolean;
};

export default function LeadDetailContent({
  data,
  classOptions = [],
  onChanged,
  onDeleted,
}: {
  data: LeadDetailData;
  classOptions?: { id: string; className: string }[];
  onChanged?: () => void;
  onDeleted?: () => void;
}) {
  const { lead, editable, deletable } = data;
  const router = useRouter();
  const { openDrawer } = useStudentDrawer();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: lead.fullName,
    gender: lead.gender ?? "",
    dob: toYmd(lead.dob),
    currentSchoolGrade: lead.currentSchoolGrade ?? "",
    guardianName: lead.guardian?.fullName ?? "",
    phone: lead.phone ?? "",
    secondaryPhone: lead.secondaryPhone ?? "",
    address: lead.address ?? "",
    source: lead.source ?? "",
    meetDate: toYmd(lead.meetDate),
    expectedStartDate: toYmd(lead.expectedStartDate),
    interestedClassId: lead.interestedClassId ?? "",
    initialAssessment: lead.initialAssessment ?? "",
    pendingRemedialSessions: lead.pendingRemedialSessions != null ? String(lead.pendingRemedialSessions) : "",
    facebookParentName: lead.facebookParentName ?? "",
    facebookLink: lead.facebookLink ?? "",
    zaloContact: lead.zaloContact ?? "",
    notes: lead.notes ?? "",
  });

  const isConverted = Boolean(lead.student || lead.status === "ENROLLED");
  const latestTest = lead.placementTests[0] ?? null;
  const statusGroupKey = leadStatusGroupKey(lead.status);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(result.error ?? "Không lưu được.");
      return;
    }
    setEditing(false);
    onChanged?.();
    router.refresh();
  }

  async function changeStatus(groupKey: string) {
    const group = LEAD_STATUS_FILTER_GROUPS.find((item) => item.key === groupKey);
    const next = group?.statuses[0] ?? groupKey;
    if (next === lead.status) return;
    setError(null);
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      setError(result.error ?? "Không đổi được trạng thái.");
      return;
    }
    onChanged?.();
    router.refresh();
  }

  async function convert() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/leads/${lead.id}/convert`, { method: "POST" });
    const result = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(result.error ?? "Không chuyển đổi được.");
      return;
    }
    openDrawer(result.item.id);
    onChanged?.();
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Thanh trên: mã lead + trạng thái + đúng 3 tác vụ (sửa / lịch hẹn / xóa) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-[#e5eaf7] px-2.5 py-1 font-mono text-xs font-bold text-[#475569]">{lead.leadCode}</span>
        {editable && !isConverted ? (
          <select
            value={statusGroupKey}
            onChange={(event) => void changeStatus(event.target.value)}
            className="h-8 rounded-lg border border-[#e5eaf7] bg-white px-2 text-xs font-bold text-[#0f1729] outline-none"
          >
            {LEAD_STATUS_FILTER_GROUPS.map((group) => (
              <option key={group.key} value={group.key}>
                {group.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
            {isConverted ? LEAD_STATUS_LABEL.ENROLLED : LEAD_STATUS_LABEL[lead.status as keyof typeof LEAD_STATUS_LABEL] ?? lead.status}
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {editable && !editing ? (
            <button type="button" onClick={() => setEditing(true)} className="btn-ghost-sm">
              Sửa
            </button>
          ) : null}
          {editable ? (
            <TestQuickAction
              leadId={lead.id}
              latestTest={latestTest}
              expectedStartDate={lead.expectedStartDate}
              actualEnrollDate={lead.actualEnrollDate}
              interestedClassId={lead.interestedClassId}
              classOptions={classOptions}
            />
          ) : null}
          {deletable && !isConverted ? (
            <ConfirmActionButton
              title="Xác nhận xóa lead?"
              description={`Lead ${lead.fullName} sẽ bị xóa khỏi CRM.`}
              confirmLabel="Xóa lead"
              tone="danger"
              className="btn-ghost-sm text-rose-600"
              onConfirm={async () => {
                await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
                onDeleted?.();
                router.refresh();
              }}
            >
              Xóa
            </ConfirmActionButton>
          ) : null}
        </div>
      </div>

      {lead.student ? (
        <p className="text-sm text-[#475569]">
          Đã thành học viên:{" "}
          <Link href={`/students/${lead.student.id}`} className="font-bold text-[#2563eb] hover:underline">
            {lead.student.fullName}
          </Link>
        </p>
      ) : lead.status === "QUALIFIED" && editable ? (
        <ConfirmActionButton
          title="Chuyển lead thành học viên?"
          description="Hệ thống sẽ tạo hồ sơ học viên thật từ lead này."
          confirmLabel="Chuyển thành học viên"
          disabled={saving}
          className="btn-primary"
          onConfirm={convert}
        >
          Chuyển thành học viên
        </ConfirmActionButton>
      ) : null}

      {error ? <div className="alert-danger text-sm">{error}</div> : null}

      {/* Thông tin — đúng bộ trường của form tạo lead */}
      {editing ? (
        <div>
          <div className="rounded-xl border border-[#e5eaf7] bg-white px-4 py-2">
            <EditRow label="Họ và tên">
              <input className="input h-9" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
            </EditRow>
            <EditRow label="Giới tính">
              <select className="input h-9" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                <option value="">—</option>
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </EditRow>
            <EditRow label="Ngày sinh">
              <input type="date" className="input h-9" value={form.dob} onChange={(e) => set("dob", e.target.value)} />
            </EditRow>
            <EditRow label="Lớp ở trường">
              <input className="input h-9" value={form.currentSchoolGrade} onChange={(e) => set("currentSchoolGrade", e.target.value)} />
            </EditRow>
            <EditRow label="Phụ huynh">
              <input className="input h-9" value={form.guardianName} onChange={(e) => set("guardianName", e.target.value)} />
            </EditRow>
            <EditRow label="Số điện thoại">
              <input className="input h-9" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </EditRow>
            <EditRow label="SĐT thứ 2">
              <input className="input h-9" value={form.secondaryPhone} onChange={(e) => set("secondaryPhone", e.target.value)} />
            </EditRow>
            <EditRow label="Địa chỉ">
              <input className="input h-9" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </EditRow>
            <EditRow label="Nguồn">
              <select className="input h-9" value={form.source} onChange={(e) => set("source", e.target.value)}>
                <option value="">—</option>
                {SOURCE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </EditRow>
            <EditRow label="Ngày gặp">
              <input type="date" className="input h-9" value={form.meetDate} onChange={(e) => set("meetDate", e.target.value)} />
            </EditRow>
            <EditRow label="Dự kiến nhập học">
              <input type="date" className="input h-9" value={form.expectedStartDate} onChange={(e) => set("expectedStartDate", e.target.value)} />
            </EditRow>
            <EditRow label="Lớp quan tâm">
              <select className="input h-9" value={form.interestedClassId} onChange={(e) => set("interestedClassId", e.target.value)}>
                <option value="">—</option>
                {classOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.className}
                  </option>
                ))}
              </select>
            </EditRow>
            <EditRow label="Đánh giá đầu vào">
              <input className="input h-9" value={form.initialAssessment} onChange={(e) => set("initialAssessment", e.target.value)} />
            </EditRow>
            <EditRow label="Số buổi bổ trợ">
              <input
                type="number"
                min={0}
                max={60}
                className="input h-9"
                value={form.pendingRemedialSessions}
                onChange={(e) => set("pendingRemedialSessions", e.target.value)}
              />
            </EditRow>
            <EditRow label="Facebook PH">
              <input className="input h-9" value={form.facebookParentName} onChange={(e) => set("facebookParentName", e.target.value)} />
            </EditRow>
            <EditRow label="Link Facebook">
              <input className="input h-9" value={form.facebookLink} onChange={(e) => set("facebookLink", e.target.value)} />
            </EditRow>
            <EditRow label="Zalo">
              <input className="input h-9" value={form.zaloContact} onChange={(e) => set("zaloContact", e.target.value)} />
            </EditRow>
            <EditRow label="Ghi chú">
              <input className="input h-9" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </EditRow>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={save} disabled={saving} className="btn-primary">
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost">
              Hủy
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[#e5eaf7] bg-white px-4 py-2">
          <Row label="Họ và tên">{lead.fullName}</Row>
          <Row label="Giới tính">{lead.gender ? GENDER_LABEL[lead.gender] ?? lead.gender : ""}</Row>
          <Row label="Ngày sinh">{formatDate(lead.dob)}</Row>
          <Row label="Lớp ở trường">{lead.currentSchoolGrade ?? ""}</Row>
          <Row label="Phụ huynh">{lead.guardian?.fullName ?? ""}</Row>
          <Row label="Số điện thoại">{lead.phone ?? ""}</Row>
          <Row label="SĐT thứ 2">{lead.secondaryPhone ?? ""}</Row>
          <Row label="Địa chỉ">{lead.address ?? ""}</Row>
          <Row label="Nguồn">{lead.source ?? ""}</Row>
          <Row label="Ngày gặp">{formatDate(lead.meetDate)}</Row>
          <Row label="Ngày hẹn test">{formatDate(latestTest?.scheduledDate ?? null)}</Row>
          <Row label="Kết quả test">
            {latestTest ? PLACEMENT_TEST_STATUS_LABEL[latestTest.status] ?? latestTest.status : ""}
          </Row>
          <Row label="Dự kiến nhập học">{formatDate(lead.expectedStartDate)}</Row>
          <Row label="Lớp quan tâm">{lead.interestedClass?.className ?? ""}</Row>
          <Row label="Đánh giá đầu vào">{lead.initialAssessment ?? ""}</Row>
          <Row label="Số buổi bổ trợ">{lead.pendingRemedialSessions != null ? `${lead.pendingRemedialSessions} buổi` : ""}</Row>
          <Row label="Facebook PH">{lead.facebookParentName ?? ""}</Row>
          <Row label="Link Facebook">
            {lead.facebookLink ? (
              <a href={lead.facebookLink} target="_blank" rel="noreferrer" className="text-[#2563eb] hover:underline">
                {lead.facebookLink}
              </a>
            ) : (
              ""
            )}
          </Row>
          <Row label="Zalo">{lead.zaloContact ?? ""}</Row>
          <Row label="Ghi chú">{lead.notes ?? ""}</Row>
        </div>
      )}

      {/* Lịch sử tương tác — chỉ hiện khi thực sự có, không có thì không chiếm chỗ */}
      {lead.interactions.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#94a3b8]">Tương tác</p>
          <div className="rounded-xl border border-[#e5eaf7] bg-white px-4 py-2">
            {lead.interactions.slice(0, 10).map((item) => (
              <div key={item.id} className="flex gap-3 border-b border-[#f1f5f9] py-2 text-sm last:border-0">
                <span className="w-[132px] shrink-0 text-xs text-[#94a3b8]">
                  {new Date(item.occurredAt).toLocaleDateString("vi-VN")}
                </span>
                <span className="flex-1 text-[#0f1729]">
                  {INTERACTION_LABEL[item.type] ?? item.type}
                  {item.content ? ` · ${item.content}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
