"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

type Category = { id: string; type: string; name: string };

export default function NewCashTransactionForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "CHI", categoryId: "", amount: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredCategories = categories.filter((category) => category.type === form.type);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

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

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        + Tạo phiếu thu/chi
      </button>

      {open && (
        <div className="slideover-root">
          {/* Backdrop */}
          <div className="slideover-backdrop" onClick={() => setOpen(false)} />

          {/* Drawer Panel */}
          <div className="slideover-panel max-w-xl">
            {/* Header */}
            <div className="slideover-header">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c]">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-ink">Phiếu thu / chi mới</h3>
                    <p className="text-xs text-ink-muted48">Tạo nghiệp vụ tiền mặt</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-white text-ink-muted48 transition-all hover:border-[#f97316] hover:bg-orange-50 hover:text-[#f97316]"
              >
                <X className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>

            {/* Body */}
            <div className="slideover-body">
              <div className="rounded-xl border border-orange-100 bg-orange-50/50 px-4 py-3 mb-6">
                <p className="text-sm text-orange-800">
                  💡 Nhập đúng hướng tiền, đúng danh mục và diễn giải đủ rõ để sau này đối chiếu sổ không bị mơ hồ.
                </p>
              </div>

              <form onSubmit={submit} className="space-y-5">
                <div className="grid gap-4">
                  <label className="form-group">
                    <span className="label-sm">Loại phiếu</span>
                    <select
                      className="input"
                      value={form.type}
                      onChange={(event) => setForm((current) => ({ ...current, type: event.target.value, categoryId: "" }))}
                    >
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
                    <input
                      required
                      type="number"
                      min="0"
                      className="input"
                      value={form.amount}
                      onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                      placeholder="Nhập số tiền"
                    />
                  </label>

                  <label className="form-group">
                    <span className="label-sm">Diễn giải giao dịch</span>
                    <textarea
                      className="input min-h-[120px] resize-none"
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="VD: Thu học phí tháng 8, chi mua văn phòng phẩm, hoàn tiền..."
                    />
                  </label>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Footer Actions */}
                <div className="flex flex-col gap-3 border-t border-hairline pt-5">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full py-3 text-base font-semibold disabled:opacity-50"
                  >
                    {loading ? "Đang lưu..." : "Lưu phiếu"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="btn-ghost w-full py-3"
                  >
                    Hủy bỏ
                  </button>
                  <p className="text-center text-xs text-ink-muted48">
                    Phiếu tạo xong sẽ xuất hiện ngay trong sổ giao dịch
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
