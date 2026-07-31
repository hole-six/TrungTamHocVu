"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";

const INITIAL_FORM = {
  name: "",
  assetCode: "",
  category: "",
  room: "",
  unitName: "cái",
  quantity: "1",
  unitValue: "",
  notes: "",
};

export default function NewAssetForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Không thể tạo tài sản.");
      return;
    }

    setForm(INITIAL_FORM);
    setOpen(false);
    router.push(`/assets/${result.item.id}`);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Thêm tài sản
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Thêm tài sản / thiết bị"
        description="Nhập theo đúng cách hiểu vận hành: tên tài sản, đơn vị tính, số lượng hiện có, giá trị trên từng đơn vị và vị trí đang sử dụng."
      >
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-group">
              <span className="label">Tên tài sản</span>
              <input
                required
                className="input"
                placeholder="Ví dụ: Bàn học sinh gỗ nhỏ"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>

            <label className="form-group">
              <span className="label">Mã tài sản</span>
              <input
                className="input"
                placeholder="Ví dụ: TS-BAN-001"
                value={form.assetCode}
                onChange={(event) => setForm((current) => ({ ...current, assetCode: event.target.value }))}
              />
            </label>

            <label className="form-group">
              <span className="label">Nhóm tài sản</span>
              <input
                className="input"
                placeholder="Ví dụ: Nội thất, điện lạnh, máy tính"
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              />
            </label>

            <label className="form-group">
              <span className="label">Phòng / vị trí</span>
              <input
                className="input"
                placeholder="Ví dụ: Phòng P.102"
                value={form.room}
                onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))}
              />
            </label>

            <label className="form-group">
              <span className="label">Đơn vị tính</span>
              <input
                className="input"
                placeholder="Ví dụ: cái, bộ, chiếc"
                value={form.unitName}
                onChange={(event) => setForm((current) => ({ ...current, unitName: event.target.value }))}
              />
            </label>

            <label className="form-group">
              <span className="label">Số lượng hiện có</span>
              <input
                type="number"
                min={0}
                step={1}
                className="input"
                placeholder="1"
                value={form.quantity}
                onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
              />
            </label>

            <label className="form-group">
              <span className="label">Giá trị / 1 đơn vị</span>
              <input
                type="number"
                min={0}
                step={1000}
                className="input"
                placeholder="1500000"
                value={form.unitValue}
                onChange={(event) => setForm((current) => ({ ...current, unitValue: event.target.value }))}
              />
              <p className="form-hint">Ví dụ 1 bộ bàn ghế trị giá 1.500.000đ thì nhập đúng giá trị của 1 bộ.</p>
            </label>
          </div>

          <label className="form-group">
            <span className="label">Ghi chú</span>
            <textarea
              rows={4}
              className="input resize-none"
              placeholder="Ghi chú bảo hành, tình trạng ban đầu, xuất xứ..."
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex flex-wrap gap-3 border-t border-[#e6eefc] pt-4">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Đang lưu..." : "Lưu tài sản"}
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
