"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";
import DatePicker from "@/components/ui/DatePicker";

export default function AddMakeupSessionButton({
  sessionId,
  sessionDateLabel,
}: {
  sessionId: string;
  sessionDateLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [makeupDate, setMakeupDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [room, setRoom] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!makeupDate) {
      setError("Chọn ngày học bù trước đã.");
      return;
    }
    setSaving(true);
    setError(null);

    const response = await fetch(`/api/sessions/${sessionId}/makeup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        makeupDate,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        room: room || undefined,
        reason: reason || undefined,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setError(result.error ?? "Không thể thêm buổi bù.");
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
        className="inline-flex items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100"
      >
        Thêm buổi bù
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Thêm buổi bù riêng"
        description={`Giữ nguyên buổi gốc ngày ${sessionDateLabel} và tạo thêm một buổi bù mới cho lớp. Dùng khi cần học thêm, bù tiến độ hoặc bù riêng do phát sinh.`}
      >
        <form onSubmit={save} className="space-y-5">
          <div className="form-group">
            <label className="label">Ngày học bù</label>
            <DatePicker value={makeupDate} onChange={setMakeupDate} placeholder="Chọn ngày học bù" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="form-group">
              <span className="label">Giờ bắt đầu</span>
              <input type="time" className="input" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </label>
            <label className="form-group">
              <span className="label">Giờ kết thúc</span>
              <input type="time" className="input" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </label>
          </div>

          <label className="form-group">
            <span className="label">Phòng học</span>
            <input className="input" placeholder="VD: P.102" value={room} onChange={(event) => setRoom(event.target.value)} />
          </label>

          <label className="form-group">
            <span className="label">Lý do thêm buổi bù</span>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="VD: nghỉ lễ tuần trước, học chậm tiến độ, phụ huynh xin bù thêm một buổi..."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex flex-wrap gap-3 border-t border-[#e6eefc] pt-4">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Đang lưu..." : "Tạo buổi bù"}
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
