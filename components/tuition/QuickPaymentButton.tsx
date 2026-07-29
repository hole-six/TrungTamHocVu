"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function QuickPaymentButton({ studentId, suggestedAmount }: { studentId: string; suggestedAmount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(Math.max(0, suggestedAmount)));
  const [method, setMethod] = useState("Tiền mặt");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, amount: Number(amount), method }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể ghi nhận thanh toán.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-primary">
        Thu tiền
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1">
      <input
        type="number"
        required
        className="w-24 rounded-md border-hairline text-xs"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <select className="rounded-md border-hairline text-xs" value={method} onChange={(e) => setMethod(e.target.value)}>
        <option>Tiền mặt</option>
        <option>Chuyển khoản</option>
      </select>
      <button type="submit" disabled={loading} className="text-xs text-primary">
        {loading ? "..." : "Lưu"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-muted48">
        Hủy
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
