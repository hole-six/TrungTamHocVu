"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Branch = { id: string; name: string };

function BranchBonusRow({
  employeeId,
  month,
  branch,
  currentBonus,
}: {
  employeeId: string;
  month: string;
  branch: Branch;
  currentBonus: number | null;
}) {
  const router = useRouter();
  const [bonusPercent, setBonusPercent] = useState(currentBonus !== null ? String(currentBonus * 100) : "");
  const [loading, setLoading] = useState(false);

  async function saveBonus(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/employees/${employeeId}/monthly-bonus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, branchId: branch.id, bonusPercent: Number(bonusPercent) / 100 }),
    });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={saveBonus} className="flex items-center gap-2 border-b border-hairline/60 py-2 last:border-0">
      <span className="w-32 shrink-0 text-sm font-medium">{branch.name}</span>
      <input type="number" step="1" className="input w-24" value={bonusPercent} onChange={(e) => setBonusPercent(e.target.value)} />
      <span className="text-sm text-ink-muted48">%</span>
      <button type="submit" disabled={loading} className="btn-ghost text-xs">
        {loading ? "..." : "Lưu"}
      </button>
    </form>
  );
}

export default function AssistantScoreForm({
  employeeId,
  month,
  branches,
  bonusByBranch,
}: {
  employeeId: string;
  month: string;
  branches: Branch[];
  bonusByBranch: Record<string, number | null>;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [type, setType] = useState("DEDUCT");
  const [points, setPoints] = useState("1");
  const [eventDate, setEventDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      <div className="card space-y-2">
        <h3 className="font-display text-base font-semibold tracking-tight">Mức thưởng tháng {month} — theo từng cơ sở</h3>
        <p className="text-xs text-ink-muted48">
          Nhập tay sau khi xem tỉ lệ A của từng cơ sở — hệ thống không tự suy ra mức thưởng, và làm tốt ở cơ sở này không bù được lỗi ở cơ sở khác.
        </p>
        <div className="mt-2">
          {branches.map((b) => (
            <BranchBonusRow key={b.id} employeeId={employeeId} month={month} branch={b} currentBonus={bonusByBranch[b.id] ?? null} />
          ))}
        </div>
      </div>
    </div>
  );
}
