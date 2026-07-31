"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";
import DatePicker from "@/components/ui/DatePicker";

export default function RescheduleSessionButton({
  sessionId,
  sessionDateLabel,
}: {
  sessionId: string;
  sessionDateLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!newDate) {
      setError("Chọn ngày bù trước đã.");
      return;
    }
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/sessions/${sessionId}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newDate,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        reason: reason || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Không đổi được buổi.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-amber-700 hover:underline">
        Đổi buổi
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Đổi buổi học"
        description={`Buổi ngày ${sessionDateLabel} sẽ chuyển sang "Đã dời lịch" — hệ thống tạo đúng 1 buổi bù thay thế, giữ nguyên tổng số buổi của khóa. GV/TG đang phân công buổi này sẽ tự động phân công lại vào buổi bù.`}
      >
        <form onSubmit={save} className="space-y-5">
          <div className="form-group">
            <label className="label">Ngày bù</label>
            <DatePicker value={newDate} onChange={setNewDate} placeholder="Chọn ngày bù" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="form-group">
              <span className="label">Giờ bắt đầu (nếu khác giờ cũ)</span>
              <input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label className="form-group">
              <span className="label">Giờ kết thúc (nếu khác giờ cũ)</span>
              <input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>
          <label className="form-group">
            <span className="label">Lý do đổi buổi</span>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="VD: GV nghỉ đột xuất, trùng lịch phòng..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex flex-wrap gap-3 border-t border-[#e6eefc] pt-4">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Đang lưu..." : "Xác nhận đổi buổi"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Hủy
            </button>
          </div>
        </form>
      </SlideOver>
    </>
  );
}
