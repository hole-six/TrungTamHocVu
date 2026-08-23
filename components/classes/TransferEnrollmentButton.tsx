"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { formatVnd } from "@/lib/export-utils";
import { computeEffectiveUnitPrice } from "@/lib/server/tuition-rules";

type ClassOption = {
  id: string;
  className: string;
  classCode: string;
  courseId: string | null;
  tuitionPerSession: number | null;
  course?: { name: string; tuitionPerSession: number } | null;
};

export default function TransferEnrollmentButton({
  enrollmentId,
  currentClassName,
  currentCourseId,
  remainingSessions,
  paidRemainingSessions,
  manualExtraRemainingSessions = 0,
  oldUnitPrice,
  scholarshipPct = 0,
  defaultTargetClassId,
  classOptions,
}: {
  enrollmentId: string;
  currentClassName: string;
  currentCourseId?: string | null;
  remainingSessions: number;
  paidRemainingSessions?: number;
  manualExtraRemainingSessions?: number;
  oldUnitPrice: number;
  scholarshipPct?: number;
  defaultTargetClassId?: string | null;
  classOptions: ClassOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetClassId, setTargetClassId] = useState(defaultTargetClassId ?? "");
  const [carryScholarship, setCarryScholarship] = useState(scholarshipPct > 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sameCourseOptions = classOptions.filter((item) => currentCourseId && item.courseId === currentCourseId);
  const otherCourseOptions = classOptions.filter((item) => !currentCourseId || item.courseId !== currentCourseId);

  const targetClass = classOptions.find((item) => item.id === targetClassId) ?? null;
  const rawNewUnitPrice = targetClass?.tuitionPerSession ?? targetClass?.course?.tuitionPerSession ?? 0;
  // Xem trước phải khớp đúng công thức server dùng (xem app/api/enrollments/[id]/transfer/route.ts):
  // nếu giữ học bổng, giá quy đổi là giá ĐÃ trừ %, không phải giá gốc — nếu không, số xem
  // trước ở đây và số thật sau khi xác nhận sẽ lệch nhau.
  const newUnitPrice = carryScholarship ? computeEffectiveUnitPrice(rawNewUnitPrice, scholarshipPct, 0) : rawNewUnitPrice;
  const paidSessionsForValue = Math.max(0, paidRemainingSessions ?? remainingSessions);
  const remainingValue = paidSessionsForValue * Math.max(0, oldUnitPrice);
  const convertedSessions = newUnitPrice > 0 ? Math.floor(remainingValue / newUnitPrice) : 0;
  const remainingCash = newUnitPrice > 0 ? remainingValue - convertedSessions * newUnitPrice : remainingValue;
  const canSubmit = Boolean(targetClassId) && !loading && (convertedSessions > 0 || manualExtraRemainingSessions > 0);

  async function submit() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/enrollments/${enrollmentId}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetClassId, carryScholarship }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Không chuyển lớp được.");
      setConfirmOpen(false);
      return;
    }
    setConfirmOpen(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-w-[104px] items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-100"
      >
        Chuyển lớp
      </button>

      <ResponsiveDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Chuyển lớp theo tiền còn lại"
        description="Hệ thống quy phần buổi đã mua thành tiền, rồi quy sang số buổi ở lớp mới. Buổi cộng linh động còn dư sẽ được mang theo riêng."
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#e5eaf7] bg-[#f8faff] p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Lớp hiện tại</p>
            <p className="mt-1 font-bold text-[#0f1729]">{currentClassName}</p>
            <p className="mt-2 text-sm text-[#64748b]">
              Còn {remainingSessions} buổi. Phần có tiền: {paidSessionsForValue} buổi x {formatVnd(oldUnitPrice)} = {formatVnd(remainingValue)}
            </p>
            {manualExtraRemainingSessions > 0 ? (
              <p className="mt-1 text-sm font-semibold text-emerald-700">
                Mang theo {manualExtraRemainingSessions} buổi cộng linh động.
              </p>
            ) : null}
          </div>

          <label className="form-group">
            <span className="label">Lớp mới</span>
            <select className="input" value={targetClassId} onChange={(event) => setTargetClassId(event.target.value)}>
              <option value="">Chọn lớp tiếp theo</option>
              {sameCourseOptions.length > 0 ? (
                <optgroup label="Cùng khóa học">
                  {sameCourseOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.classCode} - {item.className}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {otherCourseOptions.length > 0 ? (
                <optgroup label="Khóa học khác (nâng cấp/chuyển hướng)">
                  {otherCourseOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.classCode} - {item.className}
                      {item.course?.name ? ` · ${item.course.name}` : ""}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>

          {scholarshipPct > 0 ? (
            <label className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
              <input
                type="checkbox"
                checked={carryScholarship}
                onChange={(event) => setCarryScholarship(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-600"
              />
              <span className="text-sm">
                <span className="block font-semibold text-emerald-900">
                  Giữ nguyên học bổng {Math.round(scholarshipPct * 100)}% cho lớp mới
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-emerald-700">
                  Học viên đang có học bổng {Math.round(scholarshipPct * 100)}% ở lớp hiện tại. Bỏ tick nếu lớp mới không áp dụng ưu đãi này nữa.
                </span>
              </span>
            </label>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#e5eaf7] bg-white p-3">
              <p className="text-xs font-bold text-[#64748b]">Đơn giá mới</p>
              <p className="mt-1 font-bold text-[#0f1729]">{formatVnd(newUnitPrice)}</p>
            </div>
            <div className="rounded-xl border border-[#e5eaf7] bg-white p-3">
              <p className="text-xs font-bold text-[#64748b]">Quy đổi</p>
              <p className="mt-1 font-bold text-[#0f1729]">{convertedSessions} buổi</p>
            </div>
            <div className="rounded-xl border border-[#e5eaf7] bg-white p-3">
              <p className="text-xs font-bold text-[#64748b]">Tiền lẻ</p>
              <p className="mt-1 font-bold text-[#0f1729]">{formatVnd(remainingCash)}</p>
            </div>
          </div>

          {remainingCash > 0 ? (
            <p className="text-xs text-[#64748b]">
              Tiền lẻ sẽ được ghi thành khoản dư cho học viên để CSO xử lý ở các khoản thu sau.
            </p>
          ) : null}

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex gap-3 border-t border-[#e6eefc] pt-4">
            <button type="button" onClick={() => setConfirmOpen(true)} disabled={!canSubmit} className="btn-primary">
              Xác nhận chuyển lớp
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Đóng
            </button>
          </div>
        </div>
      </ResponsiveDrawer>

      <ConfirmDialog
        open={confirmOpen}
        title="Xác nhận chuyển lớp?"
        description={`Chuyển từ "${currentClassName}" sang lớp đã chọn, quy đổi ${convertedSessions} buổi${
          remainingCash > 0 ? ` và ghi dư ${formatVnd(remainingCash)}` : ""
        }${manualExtraRemainingSessions > 0 ? `, mang theo ${manualExtraRemainingSessions} buổi cộng linh động` : ""}${
          scholarshipPct > 0
            ? carryScholarship
              ? `, giữ nguyên học bổng ${Math.round(scholarshipPct * 100)}%`
              : `, KHÔNG mang học bổng ${Math.round(scholarshipPct * 100)}% sang lớp mới`
            : ""
        }. Thao tác này không thể hoàn tác.`}
        confirmLabel={loading ? "Đang chuyển..." : "Chuyển lớp"}
        tone="danger"
        loading={loading}
        onConfirm={submit}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
