"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";

export default function AssetEditForm({
  assetId,
  initial,
  compact = false,
}: {
  assetId: string;
  initial: {
    status: string;
    name: string;
    category: string;
    room: string;
    unitName: string;
    unitValue: string;
    notes: string;
  };
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/assets/${assetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Không lưu được thay đổi.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/10"
            : "btn-ghost w-full"
        }
      >
        Sửa{!compact ? " thông tin tài sản" : ""}
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Sửa tài sản"
        description="Cập nhật tên, nhóm, vị trí, giá trị và trạng thái sử dụng."
      >
        <form onSubmit={save} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-group md:col-span-2">
              <span className="label">Tên tài sản</span>
              <input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Nhóm</span>
              <input className="input" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Phòng / vị trí</span>
              <input className="input" value={form.room} onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Đơn vị tính</span>
              <input className="input" value={form.unitName} onChange={(event) => setForm((current) => ({ ...current, unitName: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Giá trị / đơn vị</span>
              <input
                type="number"
                min={0}
                step={1000}
                className="input"
                value={form.unitValue}
                onChange={(event) => setForm((current) => ({ ...current, unitValue: event.target.value }))}
              />
            </label>

            <label className="form-group md:col-span-2">
              <span className="label">Trạng thái</span>
              <select className="input" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="ACTIVE">Đang sử dụng</option>
                <option value="MAINTENANCE">Đang bảo trì</option>
                <option value="BROKEN">Hỏng</option>
                <option value="DISPOSED">Đã thanh lý</option>
              </select>
            </label>
          </div>

          <label className="form-group">
            <span className="label">Ghi chú</span>
            <textarea
              className="input resize-none"
              rows={4}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex flex-wrap gap-3 border-t border-[#e6eefc] pt-4">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Hủy
            </button>
          </div>
        </form>
      </SlideOver>
    </>
  );
}
