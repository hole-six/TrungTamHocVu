"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

export default function PayrollLineAdjustForm({
  lineId,
  bonus,
  penalty,
  notes,
  employeeName,
}: {
  lineId: string;
  bonus: number;
  penalty: number;
  notes: string | null;
  employeeName: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ bonus: String(bonus), penalty: String(penalty), notes: notes ?? "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setLoading(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/payroll-lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bonus: Number(form.bonus), penalty: Number(form.penalty), notes: form.notes }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể lưu điều chỉnh.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function removeLine() {
    setLoading(true);
    const res = await fetch(`/api/payroll-lines/${lineId}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Không thể xóa dòng lương.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-display text-lg font-semibold tracking-tight">Điều chỉnh dòng lương kỳ này</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-ink-muted48">Thưởng</span>
          <input
            type="number"
            className="input"
            value={form.bonus}
            onChange={(event) => setForm((current) => ({ ...current, bonus: event.target.value }))}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-ink-muted48">Phạt</span>
          <input
            type="number"
            className="input"
            value={form.penalty}
            onChange={(event) => setForm((current) => ({ ...current, penalty: event.target.value }))}
          />
        </label>
      </div>
      <label className="space-y-1 block">
        <span className="text-xs font-medium text-ink-muted48">Ghi chú</span>
        <textarea
          className="input resize-none"
          rows={2}
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved && !error ? <p className="text-sm text-emerald-600">Đã lưu.</p> : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={loading} className="btn-primary">
          {loading ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
        <ConfirmActionButton
          title="Xác nhận xóa dòng lương?"
          description={`Dòng lương của ${employeeName} sẽ bị xóa khỏi kỳ hiện tại.`}
          confirmLabel="Xóa dòng lương"
          tone="danger"
          disabled={loading}
          className="btn-danger-sm"
          onConfirm={removeLine}
        >
          Xóa dòng lương
        </ConfirmActionButton>
      </div>
    </div>
  );
}
