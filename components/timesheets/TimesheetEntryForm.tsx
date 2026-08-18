"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

type Entry = {
  id: string;
  checkInAm: string | null;
  checkOutAm: string | null;
  checkInPm: string | null;
  checkOutPm: string | null;
  hours: number | null;
  notes: string | null;
};

const DEFAULT_TIMES = { checkInAm: "08:00", checkOutAm: "12:00", checkInPm: "13:30", checkOutPm: "17:30" };

function hoursFromRange(start: string, end: string) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((item) => Number.isNaN(item))) return 0;
  return Math.max(0, eh + em / 60 - (sh + sm / 60));
}

function computeHours(row: { checkInAm: string; checkOutAm: string; checkInPm: string; checkOutPm: string }) {
  return hoursFromRange(row.checkInAm, row.checkOutAm) + hoursFromRange(row.checkInPm, row.checkOutPm);
}

/**
 * Form chấm công cho 1 nhân viên ở 1 ngày cụ thể — nội dung mở ra khi bấm "Xem thêm"
 * trên dòng đó. Trước đây form này dùng chung 1 state `draft` ở component cha cho MỌI
 * dòng (chỉ 1 dòng mở tại 1 thời điểm) — giờ mỗi dòng tự quản lý state riêng, không còn
 * ràng buộc "chỉ mở được 1 dòng" nhưng đổi lại không còn state dùng chung dễ rối.
 */
export default function TimesheetEntryForm({
  employeeId,
  employeeName,
  selectedDate,
  selectedDateLabel,
  existing,
  canDeleteTimesheet,
  onSaved,
}: {
  employeeId: string;
  employeeName: string;
  selectedDate: string;
  selectedDateLabel: string;
  existing: Entry | null;
  canDeleteTimesheet: boolean;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState({
    checkInAm: existing?.checkInAm ?? DEFAULT_TIMES.checkInAm,
    checkOutAm: existing?.checkOutAm ?? DEFAULT_TIMES.checkOutAm,
    checkInPm: existing?.checkInPm ?? DEFAULT_TIMES.checkInPm,
    checkOutPm: existing?.checkOutPm ?? DEFAULT_TIMES.checkOutPm,
    notes: existing?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewHours = computeHours(draft);

  async function save() {
    setSaving(true);
    setError(null);

    const response = await fetch("/api/timesheet-entries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, workDate: selectedDate, ...draft }),
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setError(result.error ?? "Không lưu được chấm công.");
      return;
    }
    onSaved();
    router.refresh();
  }

  async function deleteEntry() {
    if (!existing) return;
    setDeleting(true);
    setError(null);

    const response = await fetch(`/api/timesheet-entries/${existing.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    setDeleting(false);

    if (!response.ok) {
      setError(result.error ?? "Không xóa được chấm công.");
      return;
    }
    onSaved();
    router.refresh();
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1">
          <span className="label text-xs">Đến sáng</span>
          <input type="time" className="input" value={draft.checkInAm} onChange={(event) => setDraft((d) => ({ ...d, checkInAm: event.target.value }))} />
        </label>
        <label className="space-y-1">
          <span className="label text-xs">Về sáng</span>
          <input type="time" className="input" value={draft.checkOutAm} onChange={(event) => setDraft((d) => ({ ...d, checkOutAm: event.target.value }))} />
        </label>
        <label className="space-y-1">
          <span className="label text-xs">Đến chiều</span>
          <input type="time" className="input" value={draft.checkInPm} onChange={(event) => setDraft((d) => ({ ...d, checkInPm: event.target.value }))} />
        </label>
        <label className="space-y-1">
          <span className="label text-xs">Về chiều</span>
          <input type="time" className="input" value={draft.checkOutPm} onChange={(event) => setDraft((d) => ({ ...d, checkOutPm: event.target.value }))} />
        </label>
        <div className="space-y-1">
          <span className="label text-xs">Giờ / công tính được</span>
          <p className="input flex items-center bg-white font-semibold text-ink">
            {previewHours.toFixed(2)} giờ · {(Math.round((previewHours / 8) * 100) / 100).toFixed(2)} công
          </p>
        </div>
      </div>
      <label className="mt-3 block space-y-1">
        <span className="label text-xs">Ghi chú ngày công</span>
        <input
          className="input"
          value={draft.notes}
          onChange={(event) => setDraft((d) => ({ ...d, notes: event.target.value }))}
          placeholder="Ví dụ: đi muộn 15 phút, nghỉ phép buổi sáng, hỗ trợ sự kiện cuối giờ..."
        />
      </label>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={save} disabled={saving} className="btn-primary">
          {saving ? "Đang lưu..." : "Lưu chấm công"}
        </button>
        {existing && canDeleteTimesheet ? (
          <ConfirmActionButton
            title="Xác nhận xóa chấm công?"
            description={`Xóa chấm công ngày ${selectedDateLabel} của ${employeeName}. Thao tác này không thể hoàn tác.`}
            confirmLabel="Xóa chấm công"
            tone="danger"
            disabled={deleting}
            className="btn-ghost text-red-600"
            onConfirm={deleteEntry}
          >
            {deleting ? "Đang xóa..." : "Xóa chấm công"}
          </ConfirmActionButton>
        ) : null}
      </div>
    </div>
  );
}
