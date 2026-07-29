"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function NewPeriodForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [periodName, setPeriodName] = useState(currentMonth());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/billing-periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodName }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể tạo kỳ thu.");
      return;
    }
    router.push(`/tuition/${data.item.id}`);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Tạo kỳ thu
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        type="month"
        required
        className="input"
        value={periodName}
        onChange={(e) => setPeriodName(e.target.value)}
      />
      <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap">
        {loading ? "Đang tạo..." : "Tạo"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
