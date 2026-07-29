"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VoidButton({ txnId }: { txnId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function voidTxn() {
    if (!window.confirm("Hủy phiếu này? Số tiền sẽ không còn tính vào sổ quỹ.")) return;
    setLoading(true);
    await fetch(`/api/cash-transactions/${txnId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "VOIDED" }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button onClick={voidTxn} disabled={loading} className="text-xs text-red-600">
      {loading ? "..." : "Hủy"}
    </button>
  );
}
