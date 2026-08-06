"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import DatePicker from "@/components/ui/DatePicker";
import FormGuide from "@/components/ui/FormGuide";

const MAKEUP_GUIDE_SECTIONS = [
  {
    title: "Khi nào dùng thêm buổi bù?",
    items: [
      "Dùng khi cần tạo thêm một buổi riêng ngoài buổi gốc, ví dụ học bù tiến độ, bù do nghỉ lễ hoặc bù riêng do phát sinh.",
      "Luồng này giữ nguyên buổi gốc và cộng thêm một buổi mới vào lịch thực tế.",
      "Phù hợp khi lớp cần học thêm, không phải khi chỉ muốn đổi ngày của buổi cũ.",
    ],
    tone: "info" as const,
  },
  {
    title: "Hiểu đúng tác động",
    items: [
      "Buổi bù là một buổi mới, nên có thể làm mốc kết thúc thực tế của lớp lùi ra xa hơn.",
      "Bạn có thể nhập giờ học và phòng riêng cho buổi bù nếu khác lịch chuẩn.",
      "Nên ghi lý do rõ để người vận hành khác hiểu vì sao lớp có thêm buổi phát sinh.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lỗi dễ gặp",
    items: [
      "Dùng thêm buổi bù trong khi thực tế chỉ cần dời lịch buổi cũ.",
      "Không nhập ngày bù làm buổi không thể tạo.",
      "Thêm buổi bù nhưng không ghi lý do, về sau rất khó giải thích vì sao khóa dài thêm.",
    ],
    tone: "warning" as const,
  },
];

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

      <ResponsiveDrawer 
        open={open}
        onClose={() => setOpen(false)}
        title="Thêm buổi bù riêng"
        description={`Giữ nguyên buổi gốc ngày ${sessionDateLabel} và tạo thêm một buổi bù mới cho lớp. Dùng khi cần học thêm, bù tiến độ hoặc bù riêng do phát sinh.`}
        guide={<FormGuide title="Hướng dẫn thêm buổi bù" summary="Đây là luồng tạo thêm một buổi mới ngoài buổi gốc. Nếu ý định của bạn là cộng thêm một buổi thật vào lớp, hãy dùng form này thay vì dời lịch." sections={MAKEUP_GUIDE_SECTIONS} position="inline" />}
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
            <textarea className="input resize-none" rows={3} placeholder="VD: nghỉ lễ tuần trước, học chậm tiến độ, phụ huynh xin bù thêm một buổi..." value={reason} onChange={(event) => setReason(event.target.value)} />
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
      </ResponsiveDrawer>
    </>
  );
}
