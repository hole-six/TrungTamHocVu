"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import ShiftPicker from "@/components/timesheets/ShiftPicker";
import { ACTION_CLASS } from "@/components/ui/DetailDrawerParts";
import { formatShift, shiftHours, type ShiftTimes } from "@/lib/timesheet-shifts";

type Entry = {
  id: string;
  checkInAm: string | null;
  checkOutAm: string | null;
  checkInPm: string | null;
  checkOutPm: string | null;
  hours: number | null;
  notes: string | null;
};

/**
 * Form chấm công cho 1 nhân viên ở 1 ngày cụ thể — dùng trong màn lương (sửa công của
 * kỳ lương). Giờ vào/ra chọn qua ShiftPicker dùng chung với màn chấm công: có ca mẫu,
 * ghi rõ "Sáng — vào/ra", "Chiều — vào/ra" và tổng giờ/công ngay dưới ô nhập.
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
  const [times, setTimes] = useState<ShiftTimes>({
    checkInAm: existing?.checkInAm ?? "",
    checkOutAm: existing?.checkOutAm ?? "",
    checkInPm: existing?.checkInPm ?? "",
    checkOutPm: existing?.checkOutPm ?? "",
  });
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);

    const response = await fetch("/api/timesheet-entries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, workDate: selectedDate, ...times, notes }),
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
      <ShiftPicker value={times} onChange={setTimes} />

      <label className="mt-3 block space-y-1">
        <span className="label text-xs">Ghi chú ngày công</span>
        <input
          className="input"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Ví dụ: đi muộn 15 phút, nghỉ phép buổi sáng, hỗ trợ sự kiện cuối giờ..."
        />
      </label>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={save} disabled={saving || shiftHours(times) <= 0} className={ACTION_CLASS}>
          {saving ? "Đang lưu..." : `Lưu chấm công ${formatShift(times)}`}
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
