"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Employee = { id: string; fullName: string; shortName: string };
type Assignment = {
  id: string;
  role: string;
  hours: number | null;
  amount: number | null;
  deductedHours: number;
  addedHours: number;
  adjustmentNote: string | null;
  employee: { fullName: string };
};

const ROLE_LABEL: Record<string, string> = { TEACHER: "Giáo viên", ASSISTANT: "Trợ giảng", ASSISTANT2: "Trợ giảng 2" };

function AssignmentRow({ a }: { a: Assignment }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deductedHours, setDeductedHours] = useState(String(a.deductedHours ?? 0));
  const [addedHours, setAddedHours] = useState(String(a.addedHours ?? 0));
  const [note, setNote] = useState(a.adjustmentNote ?? "");
  const [loading, setLoading] = useState(false);

  async function remove() {
    await fetch(`/api/session-assignments/${a.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function saveAdjustment(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch(`/api/session-assignments/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deductedHours: Number(deductedHours), addedHours: Number(addedHours), adjustmentNote: note }),
    });
    setLoading(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-hairline px-3 py-2 text-sm">
      <div className="flex items-center justify-between">
        <span>
          {a.employee.fullName} — {ROLE_LABEL[a.role] ?? a.role} ({a.hours}h, {(a.amount ?? 0).toLocaleString("vi-VN")}đ)
        </span>
        <div className="flex items-center gap-3">
          <button onClick={() => setEditing(!editing)} className="text-xs text-primary">
            {editing ? "Đóng" : "Trừ/cộng giờ"}
          </button>
          <button onClick={remove} className="text-xs text-red-600">
            Xóa
          </button>
        </div>
      </div>
      {(a.deductedHours > 0 || a.addedHours > 0) && !editing && (
        <p className="mt-1 text-xs text-ink-muted48">
          {a.deductedHours > 0 && <>Trừ {a.deductedHours}h </>}
          {a.addedHours > 0 && <>Cộng {a.addedHours}h </>}
          {a.adjustmentNote && <>— {a.adjustmentNote}</>}
        </p>
      )}
      {editing && (
        <form onSubmit={saveAdjustment} className="mt-2 flex flex-wrap items-center gap-2 border-t border-hairline pt-2">
          <label className="text-xs text-ink-muted48">
            Trừ giờ
            <input
              type="number"
              step="0.25"
              min="0"
              className="input mt-0.5 w-20"
              value={deductedHours}
              onChange={(e) => setDeductedHours(e.target.value)}
            />
          </label>
          <label className="text-xs text-ink-muted48">
            Cộng giờ
            <input
              type="number"
              step="0.25"
              min="0"
              className="input mt-0.5 w-20"
              value={addedHours}
              onChange={(e) => setAddedHours(e.target.value)}
            />
          </label>
          <input
            placeholder="Lý do (đi muộn, chuẩn bị thêm...)"
            className="input flex-1 min-w-[160px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "..." : "Lưu"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function SessionAssignmentForm({
  sessionId,
  employees,
  assignments,
}: {
  sessionId: string;
  employees: Employee[];
  assignments: Assignment[];
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState("TEACHER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/sessions/${sessionId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, role }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể phân công.");
      return;
    }
    setEmployeeId("");
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold tracking-tight">Phân công GV/TG</h2>
      <div className="mt-3 space-y-2">
        {assignments.map((a) => (
          <AssignmentRow key={a.id} a={a} />
        ))}
        {assignments.length === 0 && <p className="text-sm text-ink-muted48">Chưa phân công ai.</p>}
      </div>

      <form onSubmit={assign} className="mt-3 flex flex-wrap gap-2 border-t border-hairline pt-3">
        <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">— Chọn nhân viên —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullName} ({e.shortName})
            </option>
          ))}
        </select>
        <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="TEACHER">Giáo viên</option>
          <option value="ASSISTANT">Trợ giảng</option>
          <option value="ASSISTANT2">Trợ giảng 2</option>
        </select>
        <button type="submit" disabled={loading || !employeeId} className="btn-primary">
          {loading ? "..." : "Phân công"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
