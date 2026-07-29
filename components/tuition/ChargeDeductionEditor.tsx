"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChargeDeductionEditor({ chargeId, deductedCount }: { chargeId: string; deductedCount: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(deductedCount));
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    await fetch(`/api/charges/${chargeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deductedCount: Number(value) }),
    });
    setLoading(false);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="underline decoration-dotted">
        {deductedCount}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        className="w-14 rounded-md border-hairline text-xs"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <button onClick={save} disabled={loading} className="text-xs text-primary">
        {loading ? "..." : "OK"}
      </button>
    </span>
  );
}
