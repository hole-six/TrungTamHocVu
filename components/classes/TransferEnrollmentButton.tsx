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
  variant = "row",
  onSuccess,
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
  /** "row" (mặc định) cho dòng bảng học viên trong lớp; "quickaction" cho thanh hành động nhanh ở hồ sơ học viên. */
  variant?: "row" | "quickaction";
  /** Gọi thêm sau khi chuyển lớp thành công — dùng cho nơi giữ state riêng (vd
   *  ClassDetailDrawer tự fetch dữ liệu, router.refresh() không đụng tới được). */
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetClassId, setTargetClassId] = useState(defaultTargetClassId ?? "");
  // Để trống = chưa quyết định gì = không giữ học bổng (quy hết thành giá đầy đủ).
  // Admin phải chủ động bấm "Giữ nguyên" hoặc tự gõ 1 mức % khác — không tự ý mặc
  // định giữ hay bỏ, đúng yêu cầu "chính admin quyết định, không tự động/im lặng".
  const [scholarshipInput, setScholarshipInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sameCourseOptions = classOptions.filter((item) => currentCourseId && item.courseId === currentCourseId);
  const otherCourseOptions = classOptions.filter((item) => !currentCourseId || item.courseId !== currentCourseId);

  const currentScholarshipPercent = Math.round(scholarshipPct * 100);
  // Không cho nhập cao hơn % hiện tại qua thao tác chuyển lớp — chuyển lớp không phải
  // chỗ cấp thêm ưu đãi mới, việc đó có form học bổng riêng (ScholarshipAdjustmentForm).
  const chosenScholarshipPct = scholarshipInput.trim()
    ? Math.min(scholarshipPct, Math.max(0, Number(scholarshipInput) / 100))
    : 0;

  const targetClass = classOptions.find((item) => item.id === targetClassId) ?? null;
  const rawNewUnitPrice = targetClass?.tuitionPerSession ?? targetClass?.course?.tuitionPerSession ?? 0;
  // Xem trước phải khớp đúng công thức server dùng (xem app/api/enrollments/[id]/transfer/route.ts):
  // giá quy đổi lấy đúng % học bổng admin vừa chọn (0 nếu để trống), không phải giá gốc — nếu
  // không, số xem trước ở đây và số thật sau khi xác nhận sẽ lệch nhau.
  const newUnitPrice = chosenScholarshipPct > 0 ? computeEffectiveUnitPrice(rawNewUnitPrice, chosenScholarshipPct, 0) : rawNewUnitPrice;
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
      body: JSON.stringify({ targetClassId, scholarshipPct: chosenScholarshipPct }),
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
    onSuccess?.();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={variant === "quickaction" ? "btn-quickaction btn-quickaction--orange" : "status-action"}
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
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Học bổng hiện tại ở lớp này</p>
              <p className="mt-1 text-lg font-black text-emerald-900">{currentScholarshipPercent}%</p>
              <p className="mt-2 text-sm">Học bổng cho lớp mới:</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScholarshipInput(String(currentScholarshipPercent))}
                  className={`rounded-lg border-2 px-3 py-1.5 text-xs font-bold transition ${
                    scholarshipInput === String(currentScholarshipPercent)
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  Giữ nguyên {currentScholarshipPercent}%
                </button>
                <span className="text-xs text-emerald-700">hoặc nhập % khác</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={currentScholarshipPercent}
                    value={scholarshipInput}
                    onChange={(event) => setScholarshipInput(event.target.value)}
                    placeholder="0"
                    className="input w-20 py-1.5 text-sm"
                  />
                  <span className="text-sm text-emerald-700">%</span>
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-emerald-700">
                Để trống hoặc để 0 = không mang học bổng sang lớp mới, quy hết thành giá đầy đủ. Không nhập được cao hơn {currentScholarshipPercent}%.
              </p>
            </div>
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
            ? chosenScholarshipPct > 0
              ? `, mang học bổng ${Math.round(chosenScholarshipPct * 100)}% sang lớp mới`
              : `, KHÔNG mang học bổng ${currentScholarshipPercent}% sang lớp mới`
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
