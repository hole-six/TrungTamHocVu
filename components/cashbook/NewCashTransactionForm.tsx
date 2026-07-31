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

  const filteredCategories = categories.filter((category) => category.type === form.type);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/cash-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Không thể tạo phiếu.");
      return;
    }

    setForm({ type: "CHI", categoryId: "", amount: "", description: "" });
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        + Tạo phiếu thu/chi
      </button>
    );
  }

  return (
    <div className="w-full rounded-[28px] border border-[#dbe7ff] bg-white/95 p-5 shadow-[0_18px_50px_-32px_rgba(14,116,144,0.35)] lg:w-[860px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Tạo nghiệp vụ tiền</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">Phiếu thu / phiếu chi mới</h3>
          <p className="mt-1 text-sm text-ink-muted48">Nhập đúng hướng tiền, đúng danh mục và diễn giải đủ rõ để sau này đối chiếu sổ không bị mơ hồ.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          Đóng
        </button>
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="form-group">
            <span className="label-sm">Loại phiếu</span>
            <select className="input" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value, categoryId: "" }))}>
              <option value="CHI">Phiếu chi</option>
              <option value="THU">Phiếu thu</option>
            </select>
          </label>

          <label className="form-group">
            <span className="label-sm">Danh mục tiền</span>
            <select className="input" value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
              <option value="">Chưa chọn danh mục</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-group">
            <span className="label-sm">Số tiền</span>
            <input required type="number" min="0" className="input" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
          </label>
        </div>

        <label className="form-group">
          <span className="label-sm">Diễn giải giao dịch</span>
          <input
            className="input"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="VD: Thu học phí tháng 8, chi mua văn phòng phẩm, hoàn tiền..."
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
          <p className="text-sm text-ink-muted48">Phiếu tạo xong sẽ xuất hiện ngay trong sổ giao dịch của kỳ đang xem.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Hủy
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Đang lưu..." : "Lưu phiếu"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
