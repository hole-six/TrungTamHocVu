"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const NEXT: Record<string, { to: string; label: string; confirm?: string }[]> = {
  DRAFT: [],
  GENERATED: [
    { to: "REVIEWED", label: "Đánh dấu đã soát" },
  ],
  REVIEWED: [
    { to: "POSTED", label: "Chốt sổ", confirm: "Chốt sổ sẽ khóa kỳ này khỏi việc sinh/sửa học phí. Tiếp tục?" },
  ],
  POSTED: [{ to: "CLOSED", label: "Đóng kỳ" }],
  CLOSED: [{ to: "REOPENED", label: "Mở lại kỳ" }],
  REOPENED: [],
};

export default function BillingPeriodActions({ periodId, status }: { periodId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function generate() {
    setLoading("GENERATE");
    setError(null);
    setResult(null);
    const res = await fetch(`/api/billing-periods/${periodId}/generate-charges`, { method: "POST" });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      setError(data.error ?? "Không thể sinh học phí.");
      return;
    }
    setResult(`Đã sinh ${data.created} khoản mới, cập nhật ${data.updated} khoản (${data.totalEnrollments} ghi danh đang học).`);
    router.refresh();
  }

  async function setStatus(to: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setLoading(to);
    setError(null);
    const res = await fetch(`/api/billing-periods/${periodId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });
    setLoading(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Không thể đổi trạng thái kỳ thu.");
      return;
    }
    router.refresh();
  }

  const options = NEXT[status] ?? [];
  const canGenerate = status === "DRAFT" || status === "GENERATED" || status === "REOPENED";

  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold tracking-tight">Thao tác kỳ thu</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {canGenerate && (
          <button onClick={generate} disabled={loading === "GENERATE"} className="btn-primary">
            {loading === "GENERATE" ? "Đang sinh..." : "Sinh học phí từ dữ liệu lớp học"}
          </button>
        )}
        {options.map((o) => (
          <button key={o.to} onClick={() => setStatus(o.to, o.confirm)} disabled={loading === o.to} className="btn-ghost">
            {loading === o.to ? "..." : o.label}
          </button>
        ))}
      </div>
      {result && <p className="mt-2 text-sm text-primary">{result}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
