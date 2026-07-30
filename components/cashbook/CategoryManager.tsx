"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CASH_TXN_TYPE_LABEL } from "@/lib/server/cash-rules";

type Category = { id: string; type: string; name: string; detail: string | null };

export default function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "CHI", name: "", detail: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/cash-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể tạo danh mục.");
      return;
    }
    setForm({ type: "CHI", name: "", detail: "" });
    router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">Danh mục thu/chi</h2>
        <button className="btn-ghost text-xs" onClick={() => setOpen((o) => !o)}>
          {open ? "Đóng" : "+ Thêm danh mục"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {categories.map((c) => (
          <span key={c.id} className={`badge ${c.type === "THU" ? "bg-primary/10 text-primary" : "bg-ink/5 text-ink-muted80"}`}>
            [{CASH_TXN_TYPE_LABEL[c.type] ?? c.type}] {c.name}
          </span>
        ))}
        {categories.length === 0 && <p className="text-sm text-ink-muted48">Chưa có danh mục nào.</p>}
      </div>

      {open && (
        <form onSubmit={submit} className="mt-4 grid grid-cols-3 gap-3 border-t border-hairline pt-4">
          <select className="input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
            <option value="CHI">Chi</option>
            <option value="THU">Thu</option>
          </select>
          <input required placeholder="Tên danh mục" className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input placeholder="Chi tiết" className="input" value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} />
          {error && <p className="col-span-3 text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary col-span-3">
            {loading ? "Đang lưu..." : "Lưu danh mục"}
          </button>
        </form>
      )}
    </div>
  );
}
