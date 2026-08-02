"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

const NEXT: Record<string, { to: string; label: string; confirm?: string }[]> = {
  DRAFT: [],
  CALCULATED: [{ to: "REVIEWED", label: "Đánh dấu đã soát" }],
  REVIEWED: [{ to: "APPROVED", label: "Duyệt lương", confirm: "Duyệt kỳ lương này? Sẽ không tính lại được nữa." }],
  APPROVED: [{ to: "LOCKED", label: "Khóa kỳ" }],
  LOCKED: [{ to: "PAID", label: "Đánh dấu đã trả lương" }],
  PAID: [],
};

export default function PayrollRunActions({ runId, status }: { runId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function generate() {
    setLoading("GENERATE");
    setError(null);
    setResult(null);
    const res = await fetch(`/api/payroll-runs/${runId}/generate`, { method: "POST" });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      setError(data.error ?? "Không thể tính lương.");
      return;
    }
    setResult(`Đã tạo ${data.created} dòng mới, cập nhật ${data.updated} dòng (trên ${data.totalEmployees} nhân viên).`);
    router.refresh();
  }

  async function setStatus(to: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setLoading(to);
    setError(null);
    const res = await fetch(`/api/payroll-runs/${runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });
    setLoading(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Không thể đổi trạng thái.");
      return;
    }
    router.refresh();
  }

  async function remove() {
    setLoading("DELETE");
    setError(null);
    const res = await fetch(`/api/payroll-runs/${runId}`, { method: "DELETE" });
    setLoading(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Không thể xóa kỳ lương.");
      return;
    }
    router.push("/payroll");
  }

  const options = NEXT[status] ?? [];
  const canGenerate = status === "DRAFT" || status === "CALCULATED" || status === "REVIEWED";
  const canDelete = canGenerate;

  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold tracking-tight">Thao tác kỳ lương</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {canGenerate && (
          <button onClick={generate} disabled={loading === "GENERATE"} className="btn-primary">
            {loading === "GENERATE" ? "Đang tính..." : "Tính lương từ dữ liệu buổi dạy/chấm công"}
          </button>
        )}
        {options.map((o) => (
          <button key={o.to} onClick={() => setStatus(o.to, o.confirm)} disabled={loading === o.to} className="btn-ghost">
            {loading === o.to ? "..." : o.label}
          </button>
        ))}
        {canDelete && (
          <ConfirmActionButton
            title="Xác nhận xóa kỳ lương?"
            description="Toàn bộ dòng lương trong kỳ này sẽ bị xóa theo và không thể hoàn tác."
            confirmLabel="Xóa kỳ lương"
            tone="danger"
            disabled={loading === "DELETE"}
            className="btn-danger-sm"
            onConfirm={remove}
          >
            {loading === "DELETE" ? "..." : "Xóa kỳ lương"}
          </ConfirmActionButton>
        )}
      </div>
      {result && <p className="mt-2 text-sm text-primary">{result}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
