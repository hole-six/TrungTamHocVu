"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; type: string; name: string };

export default function NewCashTransactionForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "CHI", categoryId: "", amount: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredCategories = categories.filter((c) => c.type === form.type);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/cash-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể tạo phiếu.");
      return;
    }
    setForm({ type: "CHI", categoryId: "", amount: "", description: "" });
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Tạo phiếu thu/chi
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card flex flex-wrap items-end gap-3">
      <div>
        <label className="label">Loại</label>
        <select className="input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, categoryId: "" }))}>
          <option value="CHI">Phiếu chi</option>
          <option value="THU">Phiếu thu</option>
        </select>
      </div>
      <div>
        <label className="label">Danh mục</label>
        <select className="input" value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
          <option value="">— Không có —</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Số tiền *</label>
        <input required type="number" className="input" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
      </div>
      <div className="flex-1">
        <label className="label">Diễn giải</label>
        <input className="input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </div>
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
