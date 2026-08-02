"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AssetTransactionForm({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [type, setType] = useState("RECEIPT");
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
    const data = await res.json();
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
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">Ghi giao dịch</h2>
        <p className="mt-1 text-sm text-ink-muted48">Nhập mới, điều chuyển, kiểm kê, bảo dưỡng hoặc thanh lý tài sản.</p>
      </div>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="RECEIPT">Nhập mới</option>
          <option value="TRANSFER">Điều chuyển phòng/cơ sở</option>
          <option value="ADJUSTMENT">Điều chỉnh kiểm kê (+/-)</option>
          <option value="MAINTENANCE">Bảo dưỡng</option>
          <option value="DISPOSAL">Thanh lý</option>
        </select>

        {type !== "TRANSFER" && type !== "MAINTENANCE" && (
          <input
            type="number"
            className="input"
            placeholder={type === "ADJUSTMENT" ? "Số lượng (+/-)" : "Số lượng"}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        )}
        {type === "TRANSFER" && (
          <input required className="input" placeholder="Phòng/vị trí mới" value={toRoom} onChange={(e) => setToRoom(e.target.value)} />
        )}
        {type === "MAINTENANCE" && (
          <input
            required
            type="number"
            min="1"
            className="input"
            placeholder="Số tiền bảo dưỡng (VNĐ)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        )}
        <input className="input" placeholder="Ghi chú ngắn" value={notes} onChange={(e) => setNotes(e.target.value)} />

        {type === "MAINTENANCE" ? (
          <p className="text-xs text-ink-muted48">Số tiền này sẽ cộng vào "Tổng giá trị" tài sản và tự ghi 1 phiếu CHI trong Sổ quỹ.</p>
        ) : null}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && !error ? <p className="text-sm text-emerald-600">Đã lưu giao dịch.</p> : null}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Đang lưu..." : "Lưu giao dịch"}
        </button>
      </form>
    </div>
  );
}
