"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

const WITHDRAWABLE_STATUSES = new Set(["ACTIVE", "PAUSED"]);

export default function EnrollmentRowActions({
  enrollmentId,
  status,
  onSuccess,
}: {
  enrollmentId: string;
  status: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function withdrawEnrollment() {
    setLoading(true);

    const res = await fetch(`/api/enrollments/${enrollmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "WITHDRAWN" }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      alert(data.error ?? "Không thể rút lớp lúc này.");
      return;
    }

    if (data.sessionCreditsGranted) {
      alert(`Đã chuyển ${data.sessionCreditsGranted} buổi chưa học thành buổi bổ trợ.`);
    }

    router.refresh();
    onSuccess?.();
  }

  if (!WITHDRAWABLE_STATUSES.has(status)) return null;

  return (
    <ConfirmActionButton
      title="Xác nhận rút lớp?"
      description="Các buổi chưa học đủ điều kiện sẽ được chuyển thành buổi bổ trợ cho học viên."
      confirmLabel="Rút lớp"
      tone="danger"
      disabled={loading}
      className="inline-flex min-w-[104px] items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
      onConfirm={withdrawEnrollment}
    >
      {loading ? "Đang xử lý..." : "Rút lớp"}
    </ConfirmActionButton>
  );
}
