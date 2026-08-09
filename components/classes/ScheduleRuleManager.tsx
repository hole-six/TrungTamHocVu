"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WEEKDAY_LABEL } from "@/lib/server/class-rules";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

type Rule = { id: string; weekday: number; startTime: string; endTime: string; room: string | null };

export default function ScheduleRuleManager({ classId, rules }: { classId: string; rules: Rule[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ weekday: "1", startTime: "", endTime: "", room: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/classes/${classId}/schedule-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, weekday: Number(form.weekday) }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Không thể thêm quy tắc lịch.");
      return;
    }
    setForm({ weekday: "1", startTime: "", endTime: "", room: "" });
    router.refresh();
  }

  async function removeRule(id: string) {
    await fetch(`/api/schedule-rules/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold tracking-tight">Quy tắc lịch học</h2>
      <div className="mt-3 space-y-2">
        {rules.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2 text-sm">
            <span>
              {WEEKDAY_LABEL[r.weekday]} · {r.startTime}–{r.endTime} {r.room && `· ${r.room}`}
            </span>
            <ConfirmActionButton
              title="Xác nhận xóa quy tắc lịch?"
              description={`Xóa quy tắc ${WEEKDAY_LABEL[r.weekday]} ${r.startTime}–${r.endTime}${r.room ? ` · ${r.room}` : ""}. Các buổi học đã sinh trước đó không bị ảnh hưởng, nhưng lịch chuẩn của lớp sẽ không còn buổi này khi sinh buổi mới.`}
              confirmLabel="Xóa quy tắc"
              tone="danger"
              className="text-xs text-red-600"
              onConfirm={() => removeRule(r.id)}
            >
              Xóa
            </ConfirmActionButton>
          </div>
        ))}
        {rules.length === 0 && <p className="text-sm text-ink-muted48">Chưa có quy tắc lịch.</p>}
      </div>

      <form onSubmit={addRule} className="mt-4 grid grid-cols-4 gap-2 border-t border-hairline pt-4">
        <select className="input" value={form.weekday} onChange={(e) => setForm((f) => ({ ...f, weekday: e.target.value }))}>
          {WEEKDAY_LABEL.map((label, idx) => (
            <option key={idx} value={idx}>
              {label}
            </option>
          ))}
        </select>
        <input type="time" required className="input" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
        <input type="time" required className="input" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
        <input placeholder="Phòng" className="input" value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} />
        {error && <p className="col-span-4 text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-ghost col-span-4">
          {loading ? "Đang thêm..." : "+ Thêm quy tắc"}
        </button>
      </form>
    </div>
  );
}
