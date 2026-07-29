"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GuardianEditForm({
  guardianId,
  initial,
}: {
  guardianId: string;
  initial: { fullName: string; phone: string; address: string; notes: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/guardians/${guardianId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Không thể cập nhật.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="font-display text-lg font-semibold tracking-tight">Cập nhật</h2>
      <div>
        <label className="label">Họ tên</label>
        <input className="input" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
      </div>
      <div>
        <label className="label">Số điện thoại</label>
        <input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
      </div>
      <div>
        <label className="label">Địa chỉ</label>
        <input className="input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
      </div>
      <div>
        <label className="label">Ghi chú</label>
        <textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Đang lưu..." : "Lưu thay đổi"}
      </button>
    </form>
  );
}
