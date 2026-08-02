"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

export default function DeleteGuardianButton({
  guardianId,
  guardianName,
  disabled,
  disabledReason,
}: {
  guardianId: string;
  guardianName: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/guardians/${guardianId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDeleting(false);
      setError(data.error ?? "Không thể xóa phụ huynh.");
      return;
    }
    router.push("/guardians");
    router.refresh();
  }

  return (
    <div>
      <ConfirmActionButton
        title="Xác nhận xóa phụ huynh?"
        description={`Phụ huynh "${guardianName}" sẽ bị xóa. Thao tác này không thể hoàn tác.`}
        confirmLabel="Xóa phụ huynh"
        tone="danger"
        disabled={disabled || deleting}
        className="btn-ghost w-full border border-red-200 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        onConfirm={handleDelete}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        {deleting ? "Đang xóa..." : "Xóa phụ huynh"}
      </ConfirmActionButton>
      {disabled && disabledReason ? <p className="mt-1 text-xs text-ink-muted48">{disabledReason}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
