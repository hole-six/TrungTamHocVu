"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { formatVnd } from "@/lib/export-utils";

export default function CompleteClassButton({
  classId,
  className,
  nextClassName,
  needTransferCount,
  completedCount,
  transferValueAmount,
  freeExtraSessions,
}: {
  classId: string;
  className: string;
  nextClassName?: string | null;
  needTransferCount: number;
  completedCount: number;
  transferValueAmount: number;
  freeExtraSessions: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/classes/${classId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "CSO kết thúc lớp và chuyển học viên còn buổi" }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Không kết thúc lớp được.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border-2 border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 sm:px-4 sm:py-2.5 sm:text-sm"
      >
        Kết thúc lớp
      </button>

      <ConfirmDialog
        open={open}
        title={`Kết thúc lớp ${className}?`}
        description={[
          `${completedCount} học viên đã đủ buổi sẽ được đánh dấu hoàn thành.`,
          needTransferCount > 0
            ? `${needTransferCount} học viên còn buổi sẽ chuyển sang ${nextClassName ?? "lớp tiếp theo chưa cấu hình"}.`
            : "Không có học viên cần chuyển lớp.",
          transferValueAmount > 0 ? `Giá trị học phí còn lại: ${formatVnd(transferValueAmount)}.` : null,
          freeExtraSessions > 0 ? `Có ${freeExtraSessions} buổi cộng linh động sẽ được mang theo.` : null,
          "Thao tác này sẽ chuyển trạng thái lớp thành đã hoàn thành.",
          error,
        ].filter(Boolean).join(" ")}
        confirmLabel={loading ? "Đang kết thúc..." : "Kết thúc lớp"}
        tone="danger"
        loading={loading}
        onConfirm={submit}
        onClose={() => {
          if (!loading) {
            setOpen(false);
            setError(null);
          }
        }}
      />
    </>
  );
}
