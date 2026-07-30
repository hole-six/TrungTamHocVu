"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Branch = { id: string; name: string };

export default function AssistantScoreForm({
  employeeId,
  month,
  branches,
  currentBonus,
}: {
  employeeId: string;
  month: string;
  branches: Branch[];
  currentBonus: number | null;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [type, setType] = useState("DEDUCT");
  const [points, setPoints] = useState("1");
  const [eventDate, setEventDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bonusPercent, setBonusPercent] = useState(currentBonus !== null ? String(currentBonus * 100) : "");
  const [bonusLoading, setBonusLoading] = useState(false);

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/employees/${employeeId}/score-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId, type, points: Number(points), eventDate, reason }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể ghi nhận điểm.");
      return;
    }
    setEventDate("");
    setReason("");
    router.refresh();
  }

  async function saveBonus(e: React.FormEvent) {
    e.preventDefault();
    setBonusLoading(true);
    const res = await fetch(`/api/employees/${employeeId}/monthly-bonus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, bonusPercent: Number(bonusPercent) / 100 }),
    });
    setBonusLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addEvent} className="card space-y-3">
        <h3 className="font-display text-base font-semibold tracking-tight">Ghi nhận điểm trừ/cộng</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="DEDUCT">Điểm trừ</option>
            <option value="ADD">Điểm cộng</option>
          </select>
          <input type="number" min="0.5" step="0.5" className="input" value={points} onChange={(e) => setPoints(e.target.value)} />
          <input type="date" required className="input" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        </div>
        <input className="input" placeholder="Lý do..." value={reason} onChange={(e) => setReason(e.target.value)} />
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "..." : "Ghi nhận"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <form onSubmit={saveBonus} className="card space-y-3">
        <h3 className="font-display text-base font-semibold tracking-tight">Mức thưởng tháng {month}</h3>
        <p className="text-xs text-ink-muted48">
          Nhập tay sau khi xem tỉ lệ A — hệ thống không tự suy ra mức thưởng.
        </p>
        <div className="flex items-center gap-2">
          <input type="number" step="1" className="input w-28" value={bonusPercent} onChange={(e) => setBonusPercent(e.target.value)} />
          <span className="text-sm text-ink-muted48">%</span>
          <button type="submit" disabled={bonusLoading} className="btn-primary">
            {bonusLoading ? "..." : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}
