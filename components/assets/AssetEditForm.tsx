"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AssetEditForm({
  assetId,
  initial,
}: {
  assetId: string;
  initial: { status: string; name: string; category: string; room: string; unitValue: string; notes: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    await fetch(`/api/assets/${assetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold tracking-tight">Cập nhật</h2>
      <div className="mt-3 space-y-3">
        <div>
          <label className="label">Tên thiết bị</label>
          <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Loại</label>
          <input className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
        </div>
        <div>
          <label className="label">Giá trị/đơn vị</label>
          <input type="number" className="input" value={form.unitValue} onChange={(e) => setForm((f) => ({ ...f, unitValue: e.target.value }))} />
        </div>
        <div>
          <label className="label">Trạng thái</label>
          <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="ACTIVE">Đang sử dụng</option>
            <option value="MAINTENANCE">Đang bảo trì</option>
            <option value="BROKEN">Hỏng</option>
            <option value="DISPOSED">Đã thanh lý</option>
          </select>
        </div>
        <div>
          <label className="label">Phòng/vị trí</label>
          <input className="input" value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} />
        </div>
        <div>
          <label className="label">Ghi chú</label>
          <textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <button onClick={save} disabled={loading} className="btn-primary w-full">
          {loading ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </div>
  );
}
