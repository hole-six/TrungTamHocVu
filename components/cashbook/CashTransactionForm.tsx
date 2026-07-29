"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CashCategory = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
};

export default function CashTransactionForm({ categories }: { categories: CashCategory[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    type: "EXPENSE" as "INCOME" | "EXPENSE",
    categoryId: "",
    amount: "",
    txnDate: new Date().toISOString().slice(0, 10),
    description: "",
    reference: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCategories = categories.filter((c) => c.type === form.type);

  async function handleSubmit(e: React.FormEvent) {
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
      setError(data.error ?? "Không thể tạo giao dịch.");
      return;
    }

    setForm({
      type: "EXPENSE",
      categoryId: "",
      amount: "",
      txnDate: new Date().toISOString().slice(0, 10),
      description: "",
      reference: "",
    });
    router.refresh();
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"/>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-ink">Thêm giao dịch</h2>
          <p className="text-sm text-ink-muted48">Thu hoặc chi tiền mặt</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Type Selection */}
        <div className="rounded-xl border border-[#e8edf5] bg-gradient-to-br from-white to-[#fafbff] p-5">
          <label className="label mb-3">
            Loại giao dịch <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={`flex items-center gap-3 rounded-xl border-2 px-4 py-4 cursor-pointer transition-all ${
              form.type === "INCOME"
                ? "border-emerald-400 bg-emerald-50"
                : "border-[#e8edf5] hover:border-[#cbd5e1]"
            }`}>
              <input
                type="radio"
                name="type"
                value="INCOME"
                checked={form.type === "INCOME"}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any, categoryId: "" }))}
                className="h-5 w-5 text-emerald-600"
              />
              <div className="flex-1">
                <p className="text-sm font-bold text-ink flex items-center gap-2">
                  <span className="text-xl">📥</span>
                  Thu tiền
                </p>
                <p className="text-xs text-ink-muted48 mt-0.5">Tiền vào quỹ</p>
              </div>
            </label>

            <label className={`flex items-center gap-3 rounded-xl border-2 px-4 py-4 cursor-pointer transition-all ${
              form.type === "EXPENSE"
                ? "border-red-400 bg-red-50"
                : "border-[#e8edf5] hover:border-[#cbd5e1]"
            }`}>
              <input
                type="radio"
                name="type"
                value="EXPENSE"
                checked={form.type === "EXPENSE"}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any, categoryId: "" }))}
                className="h-5 w-5 text-red-600"
              />
              <div className="flex-1">
                <p className="text-sm font-bold text-ink flex items-center gap-2">
                  <span className="text-xl">📤</span>
                  Chi tiền
                </p>
                <p className="text-xs text-ink-muted48 mt-0.5">Tiền ra khỏi quỹ</p>
              </div>
            </label>
          </div>
        </div>

        {/* Details */}
        <div className="rounded-xl border border-[#e8edf5] bg-gradient-to-br from-white to-[#fafbff] p-5">
          <div className="space-y-4">
            <div className="form-group">
              <label className="label">
                Danh mục <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="input"
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              >
                <option value="">-- Chọn danh mục --</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="form-group">
                <label className="label">
                  Số tiền (đ) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  className="input text-lg font-bold"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="label">
                  Ngày giao dịch <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  className="input"
                  value={form.txnDate}
                  onChange={(e) => setForm((f) => ({ ...f, txnDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Mã tham chiếu</label>
              <input
                className="input font-mono"
                placeholder="VD: HD001, PT002..."
                value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="label">
                Diễn giải <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                className="input min-h-[100px] resize-none"
                placeholder="Mô tả chi tiết giao dịch..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="alert-danger flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* Actions */}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"/>
              </svg>
              Đang lưu...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              Tạo giao dịch
            </span>
          )}
        </button>
      </form>
    </div>
  );
}
