"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import { useToast } from "@/components/ui/Toast";

// BẢO LƯU / ĐI HỌC LẠI — việc xảy ra thường xuyên ở trung tâm (nghỉ hè, về quê, ốm dài
// ngày). Bảo lưu giữ nguyên ghi danh và chỗ trong lớp, chỉ đánh dấu một KHOẢNG thời gian
// học viên không thuộc buổi nào: không có tên trong điểm danh, không bị trừ ví, không sinh
// học phí cho những buổi trong kỳ bảo lưu — kể cả về sau khi đã đi học lại, xem
// lib/server/class-roster.ts và điều kiện bảo lưu trong generateChargesForPeriod.
//
// Cho CHỌN NGÀY (mặc định hôm nay): phụ huynh thường báo trước "từ tuần sau cháu nghỉ",
// "thứ Hai tuần sau đi học lại". Trước đây bấm là tính ngay từ giờ bấm, lại lệch một ngày
// so với buổi học — xem pauseStartBoundary trong lib/server/class-rules.ts.

function todayKey() {
  const vn = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return vn.toISOString().slice(0, 10);
}

function formatKey(key: string) {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

export default function PauseEnrollmentButton({
  enrollmentId,
  status,
  studentName,
  pausedFrom,
  onSuccess,
  className,
}: {
  enrollmentId: string;
  status: string;
  studentName?: string;
  /** Ngày bắt đầu bảo lưu hiện tại (ISO) — để hiện "đang bảo lưu từ ...". */
  pausedFrom?: string | Date | null;
  onSuccess?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dateKey, setDateKey] = useState(todayKey());
  const [reason, setReason] = useState("");

  const isPaused = status === "PAUSED";
  if (status !== "ACTIVE" && !isPaused) return null;

  const pausedFromKey = pausedFrom ? new Date(pausedFrom).toISOString().slice(0, 10) : null;

  async function submit() {
    setLoading(true);
    const next = isPaused ? "ACTIVE" : "PAUSED";
    const response = await fetch(`/api/enrollments/${enrollmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: next,
        ...(isPaused ? { resumeDate: dateKey } : { pausedFrom: dateKey }),
        reason: reason.trim() || (isPaused ? "Đi học lại sau kỳ bảo lưu" : "Bảo lưu theo yêu cầu phụ huynh"),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      toast.blocked(data.error ?? "Không đổi được trạng thái ghi danh.", "Không thực hiện được");
      return;
    }

    toast.success(
      isPaused
        ? `Đã cho${studentName ? ` ${studentName}` : ""} đi học lại từ ${formatKey(dateKey)}. Có tên trong điểm danh và tính học phí từ ngày này.`
        : `Đã bảo lưu${studentName ? ` cho ${studentName}` : ""} từ ${formatKey(dateKey)}. Từ ngày này không có tên trong điểm danh và không tính học phí.`,
      isPaused ? "Đã đi học lại" : "Đã bảo lưu",
    );
    if (Array.isArray(data.billingWarnings) && data.billingWarnings.length) {
      toast.warning(data.billingWarnings.join(" · "), "Lưu ý học phí");
    }
    setOpen(false);
    setReason("");
    onSuccess?.();
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => { setDateKey(todayKey()); setOpen(true); }} className={className ?? "status-action"}>
        {isPaused ? "Đi học lại" : "Bảo lưu"}
      </button>

      <ResponsiveDrawer
        open={open}
        onClose={() => { if (!loading) setOpen(false); }}
        title={isPaused ? "Cho đi học lại" : "Bảo lưu (tạm nghỉ có thời hạn)"}
        description={
          isPaused
            ? `${studentName ?? "Học viên"} đang bảo lưu${pausedFromKey ? ` từ ${formatKey(pausedFromKey)}` : ""}. Các buổi đã diễn ra trong kỳ bảo lưu vẫn giữ nguyên là không học.`
            : `${studentName ?? "Học viên"} GIỮ NGUYÊN chỗ trong lớp. Nếu nghỉ hẳn thì dùng “Rút lớp”, không dùng mục này.`
        }
      >
        <div className="space-y-4">
          <label className="form-group">
            <span className="label">{isPaused ? "Đi học lại từ ngày" : "Bảo lưu từ ngày"}</span>
            <input
              type="date"
              className="input"
              value={dateKey}
              min={isPaused ? pausedFromKey ?? undefined : undefined}
              onChange={(event) => setDateKey(event.target.value)}
            />
            <span className="hint">
              {isPaused
                ? "Buổi học đúng ngày này đã có tên trong điểm danh và được tính học phí."
                : "Buổi học đúng ngày này đã KHÔNG có tên trong điểm danh. Chọn ngày sau nếu phụ huynh báo trước."}
            </span>
          </label>

          <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-xs leading-5 text-[#334155]">
            {isPaused ? (
              <>
                <p>• Có tên trong danh sách điểm danh từ ngày đi học lại.</p>
                <p>• Gói theo tháng: tự lập phiếu học phí cho phần còn lại của tháng, chỉ tính các buổi từ ngày đi học lại; buổi còn dư trong ví được trừ vào.</p>
              </>
            ) : (
              <>
                <p>• Không có tên trong danh sách điểm danh trong kỳ bảo lưu.</p>
                <p>• Ví buổi học không bị trừ; tháng đang học vẫn giữ phiếu đã lập, buổi chưa học nằm lại trong ví để dùng khi đi học lại.</p>
                <p>• Các tháng bảo lưu trọn tháng không sinh học phí.</p>
              </>
            )}
          </div>

          <label className="form-group">
            <span className="label">Lý do (không bắt buộc)</span>
            <input
              className="input"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={isPaused ? "Ví dụ: về quê xong, đi học lại" : "Ví dụ: nghỉ hè về quê 1 tháng"}
            />
          </label>

          <div className="flex gap-3 border-t border-hairline pt-4">
            <button type="button" disabled={loading || !dateKey} onClick={submit} className="btn-primary">
              {loading ? "Đang lưu..." : isPaused ? "Xác nhận đi học lại" : "Xác nhận bảo lưu"}
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={loading} className="btn-ghost">
              Đóng
            </button>
          </div>
        </div>
      </ResponsiveDrawer>
    </>
  );
}
