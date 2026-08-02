"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ACTION_OPTIONS = [
  { value: "MAINTENANCE", label: "Bảo dưỡng" },
  { value: "RECEIPT", label: "Nhập mới" },
  { value: "TRANSFER", label: "Điều chuyển" },
  { value: "ADJUSTMENT", label: "Điều chỉnh" },
  { value: "DISPOSAL", label: "Thanh lý" },
] as const;

export default function AssetTransactionForm({
  assetId,
  assetName,
}: {
  assetId: string;
  assetName?: string;
}) {
  const router = useRouter();
  const [type, setType] = useState("MAINTENANCE");
  const [quantity, setQuantity] = useState("1");
  const [toRoom, setToRoom] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const res = await fetch(`/api/assets/${assetId}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, quantity: Number(quantity), toRoom, amount: Number(amount), notes }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Không thể ghi giao dịch.");
      return;
    }

    setQuantity("1");
    setToRoom("");
    setAmount("");
    setNotes("");
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
            Bảo dưỡng
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Tự cộng vào giá trị tài sản
          </span>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Ghi nhận giao dịch tài sản</h2>
          <p className="mt-1 text-sm text-ink-muted48">
            Ưu tiên thao tác bảo dưỡng: chỉ cần nhập số tiền, hệ thống sẽ tự cộng vào chi phí bảo dưỡng và tổng giá trị
            {assetName ? ` của ${assetName}` : ""}.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {ACTION_OPTIONS.map((option) => {
          const active = type === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setType(option.value)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                active
                  ? "border-[#1f6feb] bg-[#1f6feb] text-white"
                  : "border-[#dbe7ff] bg-white text-[#235f9d] hover:bg-[#f7fbff]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} className="mt-4 space-y-4">
        {type === "MAINTENANCE" ? (
          <div className="rounded-[22px] border border-amber-200 bg-amber-50/60 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="form-group">
                <span className="label">Số tiền bảo dưỡng</span>
                <input
                  required
                  type="number"
                  min="1"
                  className="input"
                  placeholder="VD: 350000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>

              <label className="form-group">
                <span className="label">Ghi chú bảo dưỡng</span>
                <input
                  className="input"
                  placeholder="VD: thay linh kiện, vệ sinh máy..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </div>

            <div className="mt-3 rounded-2xl border border-white bg-white px-4 py-3 text-xs text-amber-800">
              Khoản này sẽ:
              <div className="mt-2 space-y-1">
                <p>- cộng vào tiền bảo dưỡng của tài sản</p>
                <p>- cộng vào tổng giá trị hiện tại</p>
                <p>- tự sinh 1 phiếu chi trong sổ quỹ</p>
              </div>
            </div>
          </div>
        ) : null}

        {type !== "TRANSFER" && type !== "MAINTENANCE" ? (
          <label className="form-group">
            <span className="label">Số lượng</span>
            <input
              type="number"
              className="input"
              placeholder={type === "ADJUSTMENT" ? "Số lượng (+/-)" : "Số lượng"}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
        ) : null}

        {type === "TRANSFER" ? (
          <label className="form-group">
            <span className="label">Phòng / vị trí mới</span>
            <input required className="input" placeholder="Phòng/vị trí mới" value={toRoom} onChange={(e) => setToRoom(e.target.value)} />
          </label>
        ) : null}

        {type !== "MAINTENANCE" ? (
          <label className="form-group">
            <span className="label">Ghi chú</span>
            <input className="input" placeholder="Ghi chú ngắn" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {saved && !error ? <p className="text-sm text-emerald-600">Đã lưu giao dịch.</p> : null}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Đang lưu..." : type === "MAINTENANCE" ? "Xác nhận bảo dưỡng" : "Lưu giao dịch"}
        </button>
      </form>
    </div>
  );
}
