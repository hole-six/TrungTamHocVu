"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewBookForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", bookCode: "", unitPrice: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể tạo sách.");
      return;
    }
    setForm({ name: "", bookCode: "", unitPrice: "" });
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Thêm sách/giáo trình
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card flex flex-wrap items-end gap-3">
      <div>
        <label className="label">Tên sách *</label>
        <input required className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div>
        <label className="label">Mã sách</label>
        <input className="input" value={form.bookCode} onChange={(e) => setForm((f) => ({ ...f, bookCode: e.target.value }))} />
      </div>
      <div>
        <label className="label">Đơn giá *</label>
        <input required type="number" className="input" value={form.unitPrice} onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Đang lưu..." : "Lưu"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
        Hủy
      </button>
    </form>
  );
}
