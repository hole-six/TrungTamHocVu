"use client";

import { useState } from "react";

const RELATION_OPTIONS = ["Bố", "Mẹ", "Ông", "Bà", "Anh/Chị", "Khác"];

export default function AddGuardianForm({ studentId, onChanged }: { studentId: string; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFullName("");
    setPhone("");
    setRelation("");
    setIsPrimary(false);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/students/${studentId}/guardians`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, phone, relation: relation || null, isPrimary }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Không thể thêm phụ huynh.");
      return;
    }
    reset();
    setOpen(false);
    onChanged?.();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost-sm">
        + Thêm phụ huynh
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="form-group">
          <span className="label-sm">Họ tên phụ huynh *</span>
          <input required className="input" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyễn Thị B" />
        </label>
        <label className="form-group">
          <span className="label-sm">Số điện thoại</span>
          <input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0912345678" />
        </label>
        <label className="form-group">
          <span className="label-sm">Mối quan hệ</span>
          <select className="input" value={relation} onChange={(event) => setRelation(event.target.value)}>
            <option value="">— Chọn —</option>
            {RELATION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2.5">
          <input type="checkbox" className="h-4 w-4 rounded border-[#c8d5ec]" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} />
          <span className="text-sm text-ink">Đặt làm liên hệ chính</span>
        </label>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="btn-primary-sm">
          {loading ? "Đang lưu..." : "Lưu phụ huynh"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="btn-ghost-sm"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
