"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";

export default function ReceiptForm({ bookId, defaultUnitPrice }: { bookId: string; defaultUnitPrice: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState(String(defaultUnitPrice));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/books/${bookId}/stock-transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "RECEIPT", quantity: Number(quantity), unitPrice: Number(unitPrice), notes }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể nhập kho.");
      return;
    }
    setQuantity("");
    setNotes("");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost">
        Nhập kho
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Nhập kho"
        description="Ghi nhận một đợt nhập mới và lưu đúng giá nhập."
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[120px_180px_minmax(0,1fr)]">
            <input type="number" required placeholder="Số lượng" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <label className="form-group">
              <span className="label-sm">Giá nhập / đơn vị</span>
              <input
                type="number"
                required
                min="0"
                placeholder="Giá nhập"
                className="input"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </label>
            <input placeholder="Ghi chú" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <p className="text-xs text-ink-muted48">Giá nhập có thể khác giá bán và có thể khác nhau theo từng đợt.</p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Đang lưu..." : "Nhập kho"}
          </button>
        </form>
      </SlideOver>
    </>
  );
}
