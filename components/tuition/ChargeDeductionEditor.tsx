"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function ChargeDeductionEditor({ chargeId, deductedCount }: { chargeId: string; deductedCount: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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
    setConfirmOpen(false);
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
      <button onClick={() => setConfirmOpen(true)} disabled={loading} className="text-xs text-primary">
        {loading ? "..." : "OK"}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title="Xác nhận sửa số buổi trừ?"
        description={`Đổi số buổi trừ từ ${deductedCount} thành ${value || 0} — số tiền phải thu trên hóa đơn sẽ tự tính lại theo giá trị mới này.`}
        confirmLabel="Lưu thay đổi"
        loading={loading}
        onConfirm={save}
        onClose={() => {
          if (!loading) setConfirmOpen(false);
        }}
      />
    </span>
  );
}
