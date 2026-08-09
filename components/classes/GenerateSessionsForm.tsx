"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import FormGuide from "@/components/ui/FormGuide";

const GENERATE_SESSIONS_GUIDE_SECTIONS = [
  {
    title: "Form này dùng khi nào?",
    items: [
      "Dùng khi lớp đã có lịch chuẩn nhưng hệ thống chưa sinh ra các buổi học thực tế trong một khoảng ngày.",
      "Đây là bước biến lịch chuẩn thành danh sách buổi học để giáo viên điểm danh và ghi nhật ký.",
      "Thường dùng ngay sau khi tạo lớp hoặc khi cần sinh thêm các buổi cho giai đoạn kế tiếp.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách chọn khoảng ngày đúng",
    items: [
      "Chọn từ ngày và đến ngày đủ rộng để bao trùm các buổi cần sinh.",
      "Hệ thống sẽ tự bỏ qua các buổi đã tồn tại, nên có thể chạy lại nếu cần mở rộng dải ngày.",
      "Form này bám theo lịch chuẩn của lớp, không tự nghĩ ra buổi ngoài lịch chuẩn.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lỗi dễ gặp",
    items: [
      "Chọn khoảng ngày quá ngắn nên sinh thiếu buổi.",
      "Tưởng rằng chạy lại sẽ tạo trùng, trong khi hệ thống thực ra sẽ bỏ qua buổi đã có.",
      "Dùng form này để tạo buổi bù riêng là sai luồng; buổi bù nên dùng nút thêm buổi bù.",
    ],
    tone: "warning" as const,
  },
];

export default function GenerateSessionsForm({ classId }: { classId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        description="Hệ thống sẽ tạo các buổi học trong khoảng ngày bạn chọn dựa trên lịch chuẩn của lớp."
        guide={<FormGuide title="Hướng dẫn sinh buổi học" summary="Đây là bước tạo ra các buổi học thực tế từ lịch chuẩn của lớp. Chỉ cần chọn đúng khoảng ngày là hệ thống sẽ sinh buổi và tự bỏ qua những buổi đã có." sections={GENERATE_SESSIONS_GUIDE_SECTIONS} position="inline" />}
      >
        <form onSubmit={submit} className="space-y-5">
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
              Hủy
            </button>
          </div>
        </form>
      </ResponsiveDrawer>
    </>
  );
}
