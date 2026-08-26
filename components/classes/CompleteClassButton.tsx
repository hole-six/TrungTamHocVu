"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { formatVnd } from "@/lib/export-utils";
import { computeEffectiveUnitPrice } from "@/lib/server/tuition-rules";

export type CompleteClassTransferStudent = {
  enrollmentId: string;
  studentName: string;
  paidRemainingSessions: number;
  manualExtraRemainingSessions: number;
  oldUnitPrice: number;
  scholarshipPct: number;
};

export default function CompleteClassButton({
  classId,
  className,
  nextClassName,
  needTransferStudents,
  completedCount,
  newUnitPrice,
}: {
  classId: string;
  className: string;
  nextClassName?: string | null;
  needTransferStudents: CompleteClassTransferStudent[];
  completedCount: number;
  /** Đơn giá/buổi ĐẦY ĐỦ (chưa trừ học bổng) của lớp tiếp theo — dùng để xem trước quy đổi. */
  newUnitPrice: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mặc định để trống = chưa quyết định gì — admin phải chủ động bấm "Giữ nguyên" hoặc
  // nhập % khác cho từng học viên, đúng yêu cầu không tự động/im lặng giữ hay bỏ.
  const [scholarshipInputs, setScholarshipInputs] = useState<Record<string, string>>({});

  const needTransferCount = needTransferStudents.length;
  const transferValueAmount = needTransferStudents.reduce(
    (sum, item) => sum + item.paidRemainingSessions * item.oldUnitPrice,
    0,
  );
  const freeExtraSessions = needTransferStudents.reduce((sum, item) => sum + item.manualExtraRemainingSessions, 0);
  const withScholarship = needTransferStudents.filter((item) => item.scholarshipPct > 0);
  const missingDecision = withScholarship.filter((item) => !scholarshipInputs[item.enrollmentId]?.trim());

  function chosenPctFor(item: CompleteClassTransferStudent) {
    const raw = scholarshipInputs[item.enrollmentId]?.trim();
    if (!raw) return 0;
    return Math.min(item.scholarshipPct, Math.max(0, Number(raw) / 100));
  }

  function previewFor(item: CompleteClassTransferStudent) {
    const chosenPct = chosenPctFor(item);
    const effectiveNewUnitPrice = chosenPct > 0 ? computeEffectiveUnitPrice(newUnitPrice, chosenPct, 0) : newUnitPrice;
    const remainingValue = item.paidRemainingSessions * item.oldUnitPrice;
    const convertedSessions = effectiveNewUnitPrice > 0 ? Math.floor(remainingValue / effectiveNewUnitPrice) : 0;
    const remainingCash = effectiveNewUnitPrice > 0 ? remainingValue - convertedSessions * effectiveNewUnitPrice : remainingValue;
    return { chosenPct, effectiveNewUnitPrice, convertedSessions, remainingCash };
  }

  async function submit() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/classes/${classId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "CSO kết thúc lớp và chuyển học viên còn buổi",
        decisions: needTransferStudents.map((item) => ({ enrollmentId: item.enrollmentId, scholarshipPct: chosenPctFor(item) })),
      }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Không kết thúc lớp được.");
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
        className="inline-flex items-center gap-1.5 rounded-xl border-2 border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 sm:px-4 sm:py-2.5 sm:text-sm"
      >
        Kết thúc lớp
      </button>

      <ResponsiveDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={`Kết thúc lớp ${className}`}
        description="Học viên đủ buổi sẽ được đánh dấu hoàn thành. Học viên còn buổi sẽ chuyển sang lớp tiếp theo — với học viên đang có học bổng, chọn rõ giữ nguyên/giảm/bỏ trước khi xác nhận."
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#e5eaf7] bg-[#f8faff] p-4 text-sm text-[#334155]">
            <p>{completedCount} học viên đã đủ buổi sẽ được đánh dấu hoàn thành.</p>
            <p className="mt-1">
              {needTransferCount > 0
                ? `${needTransferCount} học viên còn buổi sẽ chuyển sang ${nextClassName ?? "lớp tiếp theo chưa cấu hình"}.`
                : "Không có học viên cần chuyển lớp."}
            </p>
            {transferValueAmount > 0 ? <p className="mt-1">Tổng giá trị học phí còn lại: {formatVnd(transferValueAmount)}.</p> : null}
            {freeExtraSessions > 0 ? <p className="mt-1 font-semibold text-emerald-700">Có {freeExtraSessions} buổi cộng linh động sẽ được mang theo.</p> : null}
          </div>

          {needTransferStudents.length > 0 ? (
            <div className="space-y-3">
              {needTransferStudents.map((item) => {
                const currentPercent = Math.round(item.scholarshipPct * 100);
                const preview = previewFor(item);
                return (
                  <div key={item.enrollmentId} className="rounded-2xl border border-[#e5eaf7] bg-white p-3">
                    <p className="font-bold text-[#0f1729]">{item.studentName}</p>
                    <p className="mt-0.5 text-xs text-[#64748b]">
                      Còn {item.paidRemainingSessions} buổi x {formatVnd(item.oldUnitPrice)} = {formatVnd(item.paidRemainingSessions * item.oldUnitPrice)}
                      {item.manualExtraRemainingSessions > 0 ? ` · +${item.manualExtraRemainingSessions} buổi cộng linh động` : ""}
                    </p>

                    {item.scholarshipPct > 0 ? (
                      <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Học bổng hiện tại: {currentPercent}%</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setScholarshipInputs((prev) => ({ ...prev, [item.enrollmentId]: String(currentPercent) }))}
                            className={`rounded-lg border-2 px-3 py-1.5 text-xs font-bold transition ${
                              scholarshipInputs[item.enrollmentId] === String(currentPercent)
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            Giữ nguyên {currentPercent}%
                          </button>
                          <span className="text-xs text-emerald-700">hoặc nhập % khác</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={currentPercent}
                              value={scholarshipInputs[item.enrollmentId] ?? ""}
                              onChange={(event) =>
                                setScholarshipInputs((prev) => ({ ...prev, [item.enrollmentId]: event.target.value }))
                              }
                              placeholder="0"
                              className="input w-20 py-1.5 text-sm"
                            />
                            <span className="text-sm text-emerald-700">%</span>
                          </div>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-emerald-700">
                          Để trống hoặc để 0 = không mang học bổng sang lớp mới. Không nhập được cao hơn {currentPercent}%.
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg bg-[#f8faff] p-2">
                        <p className="font-bold text-[#64748b]">Đơn giá mới</p>
                        <p className="mt-0.5 font-bold text-[#0f1729]">{formatVnd(preview.effectiveNewUnitPrice)}</p>
                      </div>
                      <div className="rounded-lg bg-[#f8faff] p-2">
                        <p className="font-bold text-[#64748b]">Quy đổi</p>
                        <p className="mt-0.5 font-bold text-[#0f1729]">{preview.convertedSessions} buổi</p>
                      </div>
                      <div className="rounded-lg bg-[#f8faff] p-2">
                        <p className="font-bold text-[#64748b]">Tiền lẻ</p>
                        <p className="mt-0.5 font-bold text-[#0f1729]">{formatVnd(preview.remainingCash)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex gap-3 border-t border-[#e6eefc] pt-4">
            <button type="button" onClick={() => setConfirmOpen(true)} disabled={missingDecision.length > 0} className="btn-primary">
              Kết thúc lớp
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Đóng
            </button>
          </div>
          {missingDecision.length > 0 ? (
            <p className="text-xs font-semibold text-rose-600">
              Còn {missingDecision.length} học viên có học bổng chưa chọn giữ nguyên/giảm/bỏ ở trên.
            </p>
          ) : null}
        </div>
      </ResponsiveDrawer>

      <ConfirmDialog
        open={confirmOpen}
        title={`Xác nhận kết thúc lớp ${className}?`}
        description="Thao tác này sẽ chuyển trạng thái lớp thành đã hoàn thành và không thể hoàn tác."
        confirmLabel={loading ? "Đang kết thúc..." : "Kết thúc lớp"}
        tone="danger"
        loading={loading}
        onConfirm={submit}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
