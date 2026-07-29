"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewGuardianForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", address: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/guardians", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể tạo phụ huynh.");
      return;
    }
    router.push(`/guardians/${data.item.id}`);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Thêm phụ huynh
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card flex flex-wrap items-end gap-3">
      <input required placeholder="Họ tên *" className="input" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
      <input placeholder="SĐT" className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
      <input placeholder="Địa chỉ" className="input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Đang lưu..." : "Lưu"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
        Hủy
      </button>
    </form>
  );
}
