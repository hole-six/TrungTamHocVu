"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatVnd } from "@/lib/export-utils";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function RefundButton({ paymentId, refundable }: { paymentId: string; refundable: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [amount, setAmount] = useState(String(refundable));
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/payments/${paymentId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(amount), reason }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể hoàn tiền.");
      return;
    }
    setConfirmOpen(false);
    setOpen(false);
    router.refresh();
  }

  if (refundable <= 0) return <span className="text-xs text-ink-muted48">—</span>;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-red-600">
        Hoàn tiền
      </button>
    );
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setConfirmOpen(true);
        }}
        className="flex items-center gap-1"
      >
        <span className="flex flex-col">
          <input type="number" max={refundable} title={formatVnd(Number(amount) || 0)} className="w-20 rounded-md border-hairline text-xs" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <span className="text-[10px] leading-tight text-ink-muted48">{formatVnd(Number(amount) || 0)}</span>
        </span>
        <input placeholder="Lý do" className="w-24 rounded-md border-hairline text-xs" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button type="submit" disabled={loading} className="text-xs text-primary">
          {loading ? "..." : "OK"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-muted48">
          Hủy
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title="Xác nhận hoàn tiền?"
        description={`Hoàn ${formatVnd(Number(amount) || 0)} cho phụ huynh${reason ? ` — lý do: ${reason}` : ""}. Thao tác này ghi nhận tiền đã trả lại và không thể hoàn tác.`}
        confirmLabel="Hoàn tiền"
        tone="danger"
        loading={loading}
        onConfirm={submit}
        onClose={() => {
          if (!loading) setConfirmOpen(false);
        }}
      />
    </>
  );
}
