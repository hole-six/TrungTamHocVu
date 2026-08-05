"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function NewPayrollRunForm({ defaultPeriod }: { defaultPeriod?: string } = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [periodName, setPeriodName] = useState(defaultPeriod ?? currentMonth());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/payroll-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodName }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể tạo kỳ lương.");
      return;
    }
    router.push(`/payroll?period=${data.item.periodName}`);
  }

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button onClick={() => setOpen(true)} className="btn-primary">
          + Tạo kỳ lương mới
        </button>
        <p className="text-sm font-medium text-[#6b7280]">
          Mỗi kỳ lương tương ứng với một tháng, sau đó bạn mới tính lương và duyệt.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-2xl border-2 border-[#e5e7eb] bg-white p-4 shadow-sm">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Tháng lương</span>
        <input type="month" required className="input" value={periodName} onChange={(e) => setPeriodName(e.target.value)} />
      </label>
      <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap">
        {loading ? "Đang tạo..." : "Tạo kỳ"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
