"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import DatePicker from "@/components/ui/DatePicker";
import FormGuide from "@/components/ui/FormGuide";

const RESCHEDULE_GUIDE_SECTIONS = [
  {
    title: "Khi nào dùng dời lịch?",
    items: [
      "Dùng khi buổi gốc không học đúng ngày cũ nữa và cần chuyển hẳn sang một ngày khác.",
      "Luồng này giữ nguyên tổng số buổi của khóa, chỉ thay vị trí của đúng một buổi.",
      "Phù hợp khi giáo viên bận, trung tâm nghỉ đột xuất, trùng phòng hoặc phụ huynh đã thống nhất đổi lịch cho cả lớp.",
    ],
    tone: "info" as const,
  },
  {
    title: "Hiểu đúng tác động",
    items: [
      "Buổi cũ sẽ được thay bằng buổi mới, không làm tăng thêm tổng số buổi của khóa.",
      "Nếu giờ học mới khác giờ cũ, có thể nhập giờ bắt đầu và kết thúc mới ngay tại đây.",
      "Nên ghi lý do dời lịch để CSO, giáo viên và đội vận hành sau này nhìn lịch sử là hiểu ngay.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lỗi dễ gặp",
    items: [
      "Dùng dời lịch trong khi thực tế cần thêm một buổi bù riêng.",
      "Quên nhập ngày mới khiến buổi không thể tạo thay thế.",
      "Dời lịch nhưng không ghi lý do, làm người sau rất khó đối chiếu ngữ cảnh.",
    ],
    tone: "warning" as const,
  },
];

export default function RescheduleSessionButton({
  sessionId,
  sessionDateLabel,
  onSuccess,
}: {
  sessionId: string;
  sessionDateLabel: string;
  onSuccess?: () => void;
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
    onSuccess?.();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="status-action"
      >
        Dời lịch
      </button>

      <ResponsiveDrawer 
        open={open}
        onClose={() => setOpen(false)}
        title="Dời lịch buổi học"
        description={`Chuyển buổi ${sessionDateLabel} sang ngày mới. Hệ thống sẽ tạo đúng 1 buổi thay thế và giữ nguyên tổng số buổi của khóa.`}
        guide={<FormGuide title="Hướng dẫn dời lịch buổi học" summary="Đây là luồng đổi ngày cho chính buổi đang chọn. Nó không tạo thêm buổi mới cho khóa, mà chỉ thay buổi cũ bằng buổi mới." sections={RESCHEDULE_GUIDE_SECTIONS} position="inline" />}
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
            <textarea className="input resize-none" rows={3} placeholder="VD: trùng phòng, GV bận đột xuất..." value={reason} onChange={(e) => setReason(e.target.value)} />
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
      </ResponsiveDrawer>
    </>
  );
}
