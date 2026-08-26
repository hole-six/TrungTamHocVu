"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WEEKDAY_LABEL } from "@/lib/server/class-rules";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

type Rule = { id: string; weekday: number; startTime: string; endTime: string; room: string | null };

export default function ScheduleRuleManager({
  classId,
  rules,
  onSuccess,
}: {
  classId: string;
  rules: Rule[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ weekday: "1", startTime: "", endTime: "", room: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.startTime || !form.endTime || form.startTime >= form.endTime) {
      setError("Khung giờ học không hợp lệ.");
      return;
    }

    const overlaps = rules.some(
      (rule) => rule.weekday === Number(form.weekday) && rule.startTime < form.endTime && rule.endTime > form.startTime,
    );
    if (overlaps) {
      setError("Lịch mới bị trùng hoặc chồng giờ với lịch hiện có.");
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
      setError(data.error ?? "Không thể thêm lịch chuẩn.");
      return;
    }

    setForm({ weekday: "1", startTime: "", endTime: "", room: "" });
    router.refresh();
    onSuccess?.();
  }

  async function removeRule(id: string) {
    await fetch(`/api/schedule-rules/${id}`, { method: "DELETE" });
    router.refresh();
    onSuccess?.();
  }

  return (
    <div className="rounded-2xl border border-[#e5eaf7] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tight text-[#0f1729]">Lịch học chuẩn</h2>
          <p className="mt-1 text-sm text-[#64748b]">
            Dùng để sinh buổi học mới. Thêm/xóa lịch ở đây không sửa các buổi quá khứ đã sinh.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-lg bg-[#eff6ff] px-3 py-1 text-xs font-bold text-[#2563eb]">
          {rules.length} khung/tuần
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
              title="Xác nhận xóa lịch chuẩn?"
              description={`Xóa ${WEEKDAY_LABEL[rule.weekday]} ${rule.startTime}-${rule.endTime}${rule.room ? ` · ${rule.room}` : ""}. Các buổi đã sinh không bị xóa; chỉ ảnh hưởng lần sinh buổi mới về sau.`}
              confirmLabel="Xóa lịch"
              tone="danger"
              className="text-xs font-bold text-red-600"
              onConfirm={() => removeRule(rule.id)}
            >
              Xóa
            </ConfirmActionButton>
          </div>
        ))}
        {rules.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#dbe7ff] bg-[#f8faff] p-4 text-sm text-[#64748b]">
            Chưa có lịch chuẩn.
          </p>
        ) : null}
      </div>

      <form onSubmit={addRule} className="mt-4 grid gap-3 border-t border-[#e5eaf7] pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="form-group">
          <span className="label-sm">Thứ</span>
          <select className="input" value={form.weekday} onChange={(e) => setForm((f) => ({ ...f, weekday: e.target.value }))}>
            {WEEKDAY_LABEL.map((label, index) => (
              <option key={index} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-group">
          <span className="label-sm">Bắt đầu</span>
          <input type="time" required className="input" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
        </label>
        <label className="form-group">
          <span className="label-sm">Kết thúc</span>
          <input type="time" required className="input" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
        </label>
        <label className="form-group">
          <span className="label-sm">Phòng</span>
          <input placeholder="P.102" className="input" value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} />
        </label>
        {error ? <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-4">{error}</p> : null}
        <button type="submit" disabled={loading} className="btn-ghost sm:col-span-2 lg:col-span-4">
          {loading ? "Đang thêm..." : "+ Thêm lịch chuẩn"}
        </button>
      </form>
    </div>
  );
}
