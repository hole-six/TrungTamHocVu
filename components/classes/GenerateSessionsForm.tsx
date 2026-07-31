"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";

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

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Sinh buổi học theo lịch chuẩn"
        description="Hệ thống sẽ tạo các buổi học trong khoảng ngày bạn chọn dựa trên lịch chuẩn của lớp."
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
      </SlideOver>
    </>
  );
}
