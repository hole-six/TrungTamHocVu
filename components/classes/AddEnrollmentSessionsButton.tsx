"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";

export default function AddEnrollmentSessionsButton({
  enrollmentId,
  studentName,
  onSuccess,
}: {
  enrollmentId: string;
  studentName: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sessionCount, setSessionCount] = useState(1);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/enrollments/${enrollmentId}/extra-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionCount, reason }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Không cộng buổi được.");
      return;
    }
    setOpen(false);
    setReason("");
    setSessionCount(1);
    router.refresh();
    onSuccess?.();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-w-[104px] items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
      >
        Cộng buổi
      </button>

      <ResponsiveDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Cộng buổi linh động"
        description={`Cộng thêm quyền học cho ${studentName}. Khoản này không tự tăng học phí, chỉ dùng để xử lý ngoại lệ vận hành.`}
      >
        <div className="space-y-4">
          <label className="form-group">
            <span className="label">Số buổi cộng thêm</span>
            <input
              type="number"
              min={1}
              max={100}
              value={sessionCount}
              onChange={(event) => setSessionCount(Number(event.target.value))}
              className="input"
            />
          </label>

          <label className="form-group">
            <span className="label">Lý do</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="input min-h-[96px]"
              placeholder="Ví dụ: trung tâm nghỉ đột xuất, cần cộng lại quyền học..."
            />
          </label>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Buổi cộng linh động sẽ làm tăng số buổi còn được học và dự kiến kết thúc riêng, nhưng không tạo thêm dòng thu học phí.
          </div>

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex gap-3 border-t border-[#e6eefc] pt-4">
            <button type="button" onClick={submit} disabled={loading || sessionCount <= 0 || !reason.trim()} className="btn-primary">
              {loading ? "Đang cộng..." : "Xác nhận cộng buổi"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Đóng
            </button>
          </div>
        </div>
      </ResponsiveDrawer>
    </>
  );
}
