"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

export default function AppointmentStatusButtons({ appointmentId, status }: { appointmentId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function setStatus(next: string) {
    setLoading(next);
    await fetch(`/api/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setLoading(null);
    router.refresh();
  }

  if (status !== "SCHEDULED") return null;

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setStatus("DONE")} disabled={!!loading} className="text-xs text-emerald-600">
        {loading === "DONE" ? "..." : "Đã đến"}
      </button>
      <button onClick={() => setStatus("MISSED")} disabled={!!loading} className="text-xs text-red-600">
        {loading === "MISSED" ? "..." : "Vắng"}
      </button>
      <ConfirmActionButton
        title="Xác nhận hủy lịch hẹn?"
        description="Lịch hẹn này sẽ được đánh dấu đã hủy."
        confirmLabel="Hủy lịch hẹn"
        tone="danger"
        disabled={!!loading}
        className="text-xs text-ink-muted48"
        onConfirm={() => setStatus("CANCELLED")}
      >
        {loading === "CANCELLED" ? "..." : "Hủy"}
      </ConfirmActionButton>
    </div>
  );
}
