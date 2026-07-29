"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewAssetForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", room: "", quantity: "1", unitValue: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể tạo tài sản.");
      return;
    }
    router.push(`/assets/${data.item.id}`);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Thêm tài sản/thiết bị
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card grid grid-cols-2 gap-3 sm:grid-cols-3">
      <input required placeholder="Tên thiết bị *" className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      <input placeholder="Loại (điện lạnh, nội thất...)" className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
      <input placeholder="Phòng/vị trí" className="input" value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} />
      <input type="number" placeholder="Số lượng" className="input" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
      <input type="number" placeholder="Giá trị/đơn vị" className="input" value={form.unitValue} onChange={(e) => setForm((f) => ({ ...f, unitValue: e.target.value }))} />
      {error && <p className="col-span-full text-sm text-red-600">{error}</p>}
      <div className="col-span-full flex gap-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Đang lưu..." : "Lưu"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          Hủy
        </button>
      </div>
    </form>
  );
}
