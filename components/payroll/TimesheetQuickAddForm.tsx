"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TimesheetQuickAddForm({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ workDate: "", checkInAm: "08:00", checkOutAm: "12:00", checkInPm: "13:30", checkOutPm: "17:30" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/timesheet-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, ...form }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể lưu chấm công.");
      return;
    }
    setForm((f) => ({ ...f, workDate: "" }));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="font-display text-lg font-semibold tracking-tight">Chấm công ngày</h2>
      <input type="date" required className="input" value={form.workDate} onChange={(e) => setForm((f) => ({ ...f, workDate: e.target.value }))} />
      <div className="grid grid-cols-2 gap-2">
        <input type="time" className="input" value={form.checkInAm} onChange={(e) => setForm((f) => ({ ...f, checkInAm: e.target.value }))} />
        <input type="time" className="input" value={form.checkOutAm} onChange={(e) => setForm((f) => ({ ...f, checkOutAm: e.target.value }))} />
        <input type="time" className="input" value={form.checkInPm} onChange={(e) => setForm((f) => ({ ...f, checkInPm: e.target.value }))} />
        <input type="time" className="input" value={form.checkOutPm} onChange={(e) => setForm((f) => ({ ...f, checkOutPm: e.target.value }))} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Đang lưu..." : "Lưu chấm công"}
      </button>
    </form>
  );
}
