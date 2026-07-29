"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewBranchForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", address: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể tạo chi nhánh.");
      return;
    }
    setForm({ code: "", name: "", address: "" });
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost text-xs">
        + Thêm chi nhánh
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 grid grid-cols-3 gap-2 border-t border-hairline pt-3">
      <input required placeholder="Mã (VD: CS2)" className="input" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
      <input required placeholder="Tên chi nhánh" className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      <input placeholder="Địa chỉ" className="input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
      {error && <p className="col-span-3 text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary col-span-3">
        {loading ? "Đang lưu..." : "Lưu"}
      </button>
    </form>
  );
}
