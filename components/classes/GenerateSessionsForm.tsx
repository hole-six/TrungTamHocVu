"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import FormGuide from "@/components/ui/FormGuide";

const GENERATE_SESSIONS_GUIDE_SECTIONS = [
  {
    title: "Khi nào dùng?",
    items: [
      "Dùng để biến lịch chuẩn thành các buổi học thực tế trong một khoảng ngày.",
      "Có thể chạy nhiều lần; hệ thống tự bỏ qua buổi đã tồn tại.",
      "Nếu lớp cần dạy kéo dài cho học viên học đủ, sinh thêm buổi ở đây và học phí không tự tăng.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cần nhớ",
    items: [
      "Tổng số buổi của lớp là mốc cam kết/lộ trình/học phí, không phải trần cứng của lịch.",
      "Sửa lịch chuẩn chỉ ảnh hưởng lần sinh buổi mới về sau, không sửa buổi quá khứ.",
      "Buổi học lệch lịch hoặc đổi buổi nên xử lý trên từng session riêng.",
    ],
    tone: "warning" as const,
  },
];

export default function GenerateSessionsForm({
  classId,
  totalSessions,
  existingSessionCount = 0,
  onSuccess,
}: {
  classId: string;
  /** Tổng số buổi cam kết/học phí của lớp — để hiện so sánh cụ thể thay vì mô tả chung chung. */
  totalSessions?: number | null;
  /** Số buổi đã sinh sẵn tính đến thời điểm mở form. */
  existingSessionCount?: number;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const remainingToCommitment = totalSessions ? Math.max(0, totalSessions - existingSessionCount) : null;

  function fillNext90Days() {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 90);
    setFromDate(today.toISOString().slice(0, 10));
    setToDate(end.toISOString().slice(0, 10));
    setError(null);
    setResult(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const response = await fetch(`/api/classes/${classId}/generate-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromDate, toDate }),
    });
    const resultData = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(resultData.error ?? "Không thể sinh buổi học.");
      return;
    }

    setResult(`Đã sinh ${resultData.created} buổi mới, bỏ qua ${resultData.skipped} buổi đã tồn tại.`);
    router.refresh();
    onSuccess?.();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost">
        Sinh buổi học
      </button>

      <ResponsiveDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Sinh buổi học theo lịch chuẩn"
        description="Tạo buổi học thực tế từ lịch chuẩn của lớp. Lớp có thể kéo dài thêm buổi mà không làm học phí tự tăng."
        guide={
          <FormGuide
            title="Hướng dẫn sinh buổi học"
            summary="Dùng form này khi cần tạo thêm các buổi học thực tế để giáo viên điểm danh và ghi nhật ký."
            sections={GENERATE_SESSIONS_GUIDE_SECTIONS}
            position="inline"
          />
        }
      >
        <form onSubmit={submit} className="space-y-5">
          <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm text-[#64748b]">
            <p className="font-semibold text-[#0f1729]">Lưu ý vận hành</p>
            <p className="mt-1">
              {totalSessions
                ? remainingToCommitment && remainingToCommitment > 0
                  ? `Lớp cam kết ${totalSessions} buổi — đã sinh ${existingSessionCount} buổi, còn thiếu ${remainingToCommitment} buổi để đủ lộ trình. Chọn khoảng ngày bên dưới để sinh tiếp.`
                  : `Lớp cam kết ${totalSessions} buổi — đã sinh đủ ${existingSessionCount} buổi. Sinh thêm ở đây (nếu cần dạy kéo dài) sẽ không làm học phí tự tăng.`
                : "Tổng số buổi là mốc học phí/lộ trình, không phải trần cứng của lịch — danh sách buổi học có thể dài hơn nếu lớp cần dạy tiếp cho học viên chưa học đủ."}
            </p>
            <button type="button" onClick={fillNext90Days} className="mt-3 text-xs font-bold text-primary">
              Điền nhanh 90 ngày tới
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-group">
              <span className="label">Từ ngày</span>
              <input type="date" required className="input" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>

            <label className="form-group">
              <span className="label">Đến ngày</span>
              <input type="date" required className="input" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
          </div>

          {result ? <div className="alert-success">{result}</div> : null}
          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex gap-3 border-t border-[#e6eefc] pt-4">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Đang sinh..." : "Xác nhận sinh buổi học"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Đóng
            </button>
          </div>
        </form>
      </ResponsiveDrawer>
    </>
  );
}
