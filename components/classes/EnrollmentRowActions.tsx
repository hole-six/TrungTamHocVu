"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const NEXT: Record<string, { to: string; label: string }[]> = {
  ACTIVE: [
    { to: "PAUSED", label: "Tạm nghỉ" },
    { to: "COMPLETED", label: "Hoàn thành" },
    { to: "WITHDRAWN", label: "Rút lớp" },
  ],
  PAUSED: [
    { to: "ACTIVE", label: "Học lại" },
    { to: "WITHDRAWN", label: "Rút lớp" },
  ],
};

export default function EnrollmentRowActions({ enrollmentId, status }: { enrollmentId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function setStatus(to: string) {
    setLoading(to);
    await fetch(`/api/enrollments/${enrollmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });
    setLoading(null);
    router.refresh();
  }

  const options = NEXT[status] ?? [];
  if (options.length === 0) return null;

  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button key={o.to} onClick={() => setStatus(o.to)} disabled={loading === o.to} className="text-xs text-primary">
          {loading === o.to ? "..." : o.label}
        </button>
      ))}
    </div>
  );
}
