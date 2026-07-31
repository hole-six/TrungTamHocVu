"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteAssetButton({
  assetId,
  assetName,
  redirectTo,
  compact = false,
}: {
  assetId: string;
  assetName: string;
  redirectTo?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm(`Xóa tài sản "${assetName}"? Thao tác này không thể hoàn tác.`)) return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/assets/${assetId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDeleting(false);
      setError(data.error ?? "Không thể xóa tài sản.");
      return;
    }
    if (redirectTo) {
      router.push(redirectTo);
    }
    router.refresh();
  }

  return (
    <div className={compact ? "inline-block" : ""}>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className={
          compact
            ? "inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100"
            : "btn-ghost border border-red-200 text-red-700 hover:bg-red-50"
        }
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        {deleting ? "Đang xóa..." : "Xóa"}
      </button>
      {error && <p className="mt-1 max-w-[220px] text-right text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
