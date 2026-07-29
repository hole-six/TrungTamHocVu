"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReceiptForm({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState("");
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
      body: JSON.stringify({ type: "RECEIPT", quantity: Number(quantity), notes }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể nhập kho.");
      return;
    }
    setQuantity("");
    setNotes("");
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold tracking-tight">Nhập kho</h2>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="number" required placeholder="Số lượng" className="input w-28" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <input placeholder="Ghi chú" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "..." : "Nhập"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
