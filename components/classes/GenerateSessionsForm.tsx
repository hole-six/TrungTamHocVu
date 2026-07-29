"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateSessionsForm({ classId }: { classId: string }) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await fetch(`/api/classes/${classId}/generate-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromDate, toDate }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể sinh buổi học.");
      return;
    }
    setResult(`Đã sinh ${data.created} buổi mới (bỏ qua ${data.skipped} buổi trùng ngày).`);
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold tracking-tight">Sinh buổi học theo lịch</h2>
      <p className="mt-1 text-sm text-ink-muted48">Tự động tạo buổi học từ quy tắc lịch trong khoảng ngày chọn.</p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Từ ngày</label>
          <input type="date" required className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Đến ngày</label>
          <input type="date" required className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Đang sinh..." : "Sinh buổi học"}
        </button>
      </form>
      {result && <p className="mt-2 text-sm text-primary">{result}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
