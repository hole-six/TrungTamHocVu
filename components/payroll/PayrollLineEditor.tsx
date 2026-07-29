"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PayrollLineEditor({ lineId, bonus, penalty }: { lineId: string; bonus: number; penalty: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ bonus: String(bonus), penalty: String(penalty) });
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    await fetch(`/api/payroll-lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bonus: Number(form.bonus), penalty: Number(form.penalty) }),
    });
    setLoading(false);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-xs text-primary">
        Sửa thưởng/phạt
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input type="number" placeholder="Thưởng" className="w-20 rounded-md border-hairline text-xs" value={form.bonus} onChange={(e) => setForm((f) => ({ ...f, bonus: e.target.value }))} />
      <input type="number" placeholder="Phạt" className="w-20 rounded-md border-hairline text-xs" value={form.penalty} onChange={(e) => setForm((f) => ({ ...f, penalty: e.target.value }))} />
      <button onClick={save} disabled={loading} className="text-xs text-primary">
        {loading ? "..." : "OK"}
      </button>
    </div>
  );
}
