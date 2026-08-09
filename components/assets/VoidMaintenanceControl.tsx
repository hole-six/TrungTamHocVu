"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VoidMaintenanceControl({
  assetId,
  transactionId,
}: {
  assetId: string;
  transactionId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason.trim()) {
      setError("Cần nhập lý do hủy.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/assets/${assetId}/transactions/${transactionId}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể hủy giao dịch.");
      return;
    }
    router.refresh();
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="mt-2 text-xs font-semibold text-rose-600 hover:underline">
        Hủy lần bảo dưỡng này (nhập sai)
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-rose-200 bg-rose-50/60 p-3">
      <p className="text-xs font-semibold text-rose-700">Hủy giao dịch bảo dưỡng này?</p>
      <p className="text-xs text-rose-700/80">
        Số tiền sẽ được loại khỏi tổng bảo dưỡng và phiếu chi liên kết trong sổ quỹ cũng tự động bị hủy theo. Vẫn giữ lại trong lịch sử để đối chiếu sau này.
      </p>
      <textarea
        rows={2}
        className="input resize-none text-xs"
        placeholder="Lý do hủy — VD: gõ nhầm số tiền, nhập nhầm tài sản..."
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" disabled={loading} onClick={submit} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
          {loading ? "Đang hủy..." : "Xác nhận hủy"}
        </button>
        <button type="button" onClick={() => { setConfirming(false); setError(null); }} className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-ink-muted80">
          Thôi
        </button>
      </div>
    </div>
  );
}
