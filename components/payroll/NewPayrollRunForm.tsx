"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACTION_CLASS } from "@/components/ui/DetailDrawerParts";

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
      setError(data.error ?? "Không thể chốt tháng lương.");
      return;
    }
    router.push(`/payroll?period=${data.item.periodName}`);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={ACTION_CLASS}>
        + Chốt tháng lương
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="label-sm">Tháng lương</span>
        <input type="month" required className="input" value={periodName} onChange={(e) => setPeriodName(e.target.value)} />
      </label>
      <button type="submit" disabled={loading} className={ACTION_CLASS}>
        {loading ? "Đang tạo..." : "Chốt tháng"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="btn-ghost-sm">
        Hủy
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
