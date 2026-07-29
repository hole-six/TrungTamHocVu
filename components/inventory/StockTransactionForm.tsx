"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StockTransactionFormProps = {
  bookId: string;
  currentStock: number;
};

const TRANSACTION_TYPES = [
  { value: "IN", label: "Nhập kho", icon: "📥", color: "emerald" },
  { value: "OUT", label: "Xuất kho", icon: "📤", color: "blue" },
  { value: "ADJUSTMENT", label: "Điều chỉnh", icon: "⚙️", color: "amber" },
  { value: "DAMAGED", label: "Hư hỏng", icon: "❌", color: "red" },
];

export default function StockTransactionForm({ bookId, currentStock }: StockTransactionFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "IN",
    quantity: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/books/${bookId}/stock-transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Không thể tạo giao dịch kho.");
      return;
    }

    setForm({ type: "IN", quantity: "", notes: "" });
    setOpen(false);
    router.refresh();
  }

  const selectedType = TRANSACTION_TYPES.find((t) => t.value === form.type);
  const newStock = form.quantity
    ? form.type === "OUT" || form.type === "DAMAGED"
      ? currentStock - Number(form.quantity)
      : currentStock + Number(form.quantity)
    : currentStock;

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <div>
            <h2 className="font-display text-base font-bold tracking-tight text-ink">Giao dịch kho</h2>
            <p className="text-xs text-ink-muted48">Tồn hiện tại: <strong>{currentStock}</strong></p>
          </div>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="btn-ghost-sm"
        >
          {open ? "Đóng" : "+ Thêm giao dịch"}
        </button>
      </div>

      {/* Form */}
      {open && (
        <div className="rounded-xl border border-[#e8edf5] bg-gradient-to-br from-white to-[#fafbff] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted48 mb-4">+ Giao dịch mới</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Transaction Type Selection */}
            <div className="form-group">
              <label className="label">Loại giao dịch</label>
              <div className="grid grid-cols-2 gap-2">
                {TRANSACTION_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 cursor-pointer transition-all ${
                      form.type === type.value
                        ? `border-${type.color}-400 bg-${type.color}-50`
                        : "border-[#e8edf5] hover:border-[#cbd5e1]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={type.value}
                      checked={form.type === type.value}
                      onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-sm flex items-center gap-1.5">
                      <span>{type.icon}</span>
                      <span className="font-semibold">{type.label}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div className="form-group">
              <label className="label">
                Số lượng <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                className="input"
                placeholder="Nhập số lượng"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>

            {/* Stock Preview */}
            {form.quantity && (
              <div className={`rounded-lg border-2 p-3 flex items-center justify-between ${
                newStock < 0
                  ? "border-red-200 bg-red-50"
                  : "border-blue-200 bg-blue-50"
              }`}>
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={newStock < 0 ? "#dc2626" : "#2563eb"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="16 12 12 8 8 12"/>
                    <line x1="12" y1="16" x2="12" y2="8"/>
                  </svg>
                  <div>
                    <p className={`text-xs font-semibold ${newStock < 0 ? "text-red-700" : "text-blue-700"}`}>
                      Tồn kho sau giao dịch
                    </p>
                    <p className={`text-sm font-bold ${newStock < 0 ? "text-red-600" : "text-blue-600"}`}>
                      {currentStock} → {newStock}
                    </p>
                  </div>
                </div>
                {newStock < 0 && (
                  <span className="text-xs font-bold text-red-600">⚠️ Không đủ tồn!</span>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="form-group">
              <label className="label">Ghi chú</label>
              <textarea
                className="input min-h-[80px] resize-none"
                placeholder="Lý do giao dịch, nhà cung cấp, khách hàng..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="alert-danger text-xs flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setForm({ type: "IN", quantity: "", notes: "" });
                  setError(null);
                }}
                className="btn-ghost flex-1"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading || Boolean(form.quantity && newStock < 0)}
                className="btn-primary flex-1"
              >
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
                    {selectedType?.icon} Tạo giao dịch
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
