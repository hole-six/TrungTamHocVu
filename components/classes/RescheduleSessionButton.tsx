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
      setError("Chọn ngày mới trước đã.");
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
      setError(data.error ?? "Không dời lịch được buổi này.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
      >
        Dời lịch
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Dời lịch buổi học"
        description={`Chuyển buổi ${sessionDateLabel} sang ngày mới. Hệ thống sẽ tạo đúng 1 buổi thay thế và giữ nguyên tổng số buổi của khóa.`}
      >
        <form onSubmit={save} className="space-y-5">
          <div className="form-group">
            <label className="label">Ngày mới</label>
            <DatePicker value={newDate} onChange={setNewDate} placeholder="Chọn ngày mới" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="form-group">
              <span className="label">Giờ bắt đầu nếu khác</span>
              <input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label className="form-group">
              <span className="label">Giờ kết thúc nếu khác</span>
              <input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>
          <label className="form-group">
            <span className="label">Lý do dời lịch</span>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="VD: trùng phòng, GV bận đột xuất..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex flex-wrap gap-3 border-t border-[#e6eefc] pt-4">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Đang lưu..." : "Xác nhận dời lịch"}
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
