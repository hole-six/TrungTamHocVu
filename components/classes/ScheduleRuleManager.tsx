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
    setError(null);

    if (!form.startTime || !form.endTime || form.startTime >= form.endTime) {
      setError("Khung gio hoc khong hop le.");
      return;
    }

    const overlaps = rules.some(
      (rule) => rule.weekday === Number(form.weekday) && rule.startTime < form.endTime && rule.endTime > form.startTime,
    );
    if (overlaps) {
      setError("Lich moi bi trung hoac chong gio voi lich hien co.");
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/classes/${classId}/schedule-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, weekday: Number(form.weekday) }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Khong the them lich chuan.");
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
    <div className="rounded-2xl border border-[#e5eaf7] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tight text-[#0f1729]">Lich hoc chuan</h2>
          <p className="mt-1 text-sm text-[#64748b]">
            Dung de sinh buoi hoc moi. Them/xoa lich o day khong sua cac buoi qua khu da sinh.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-lg bg-[#eff6ff] px-3 py-1 text-xs font-bold text-[#2563eb]">
          {rules.length} khung/tuan
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex flex-col gap-3 rounded-xl border border-[#e5eaf7] bg-[#f8faff] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="font-semibold text-[#0f1729]">
              {WEEKDAY_LABEL[rule.weekday]} · {rule.startTime}-{rule.endTime}
              {rule.room ? ` · ${rule.room}` : ""}
            </span>
            <ConfirmActionButton
              title="Xac nhan xoa lich chuan?"
              description={`Xoa ${WEEKDAY_LABEL[rule.weekday]} ${rule.startTime}-${rule.endTime}${rule.room ? ` · ${rule.room}` : ""}. Cac buoi da sinh khong bi xoa; chi anh huong lan sinh buoi moi ve sau.`}
              confirmLabel="Xoa lich"
              tone="danger"
              className="text-xs font-bold text-red-600"
              onConfirm={() => removeRule(rule.id)}
            >
              Xoa
            </ConfirmActionButton>
          </div>
        ))}
        {rules.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#dbe7ff] bg-[#f8faff] p-4 text-sm text-[#64748b]">
            Chua co lich chuan.
          </p>
        ) : null}
      </div>

      <form onSubmit={addRule} className="mt-4 grid gap-3 border-t border-[#e5eaf7] pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="form-group">
          <span className="label-sm">Thu</span>
          <select className="input" value={form.weekday} onChange={(e) => setForm((f) => ({ ...f, weekday: e.target.value }))}>
            {WEEKDAY_LABEL.map((label, index) => (
              <option key={index} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-group">
          <span className="label-sm">Bat dau</span>
          <input type="time" required className="input" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
        </label>
        <label className="form-group">
          <span className="label-sm">Ket thuc</span>
          <input type="time" required className="input" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
        </label>
        <label className="form-group">
          <span className="label-sm">Phong</span>
          <input placeholder="P.102" className="input" value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} />
        </label>
        {error ? <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-4">{error}</p> : null}
        <button type="submit" disabled={loading} className="btn-ghost sm:col-span-2 lg:col-span-4">
          {loading ? "Dang them..." : "+ Them lich chuan"}
        </button>
      </form>
    </div>
  );
}
