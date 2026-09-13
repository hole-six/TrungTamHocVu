"use client";

import { useEffect, useState } from "react";
import ShiftPicker from "@/components/timesheets/ShiftPicker";
import { shiftDays, shiftHours, type ShiftTimes } from "@/lib/timesheet-shifts";

// Hộp chấm công: bấm "Chấm công" là CHỌN ĐƯỢC GIỜ ngay tại đây (ca mẫu hoặc gõ tay),
// thấy tổng giờ/công trước khi lưu. Trước đây bấm là ghi luôn ca 08:00–17:00 cố định,
// không ai chọn được giờ và cũng không biết đã ghi giờ nào.
export default function CheckInDialog({
  open,
  title,
  subtitle,
  initialTimes,
  initialNotes = "",
  confirmLabel,
  extra,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  initialTimes: ShiftTimes;
  initialNotes?: string;
  confirmLabel: string;
  /** Ô chọn thêm của từng ngữ cảnh (vd ghi đè ngày đã chấm khi chấm cả tháng). */
  extra?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (times: ShiftTimes, notes: string) => void;
}) {
  const [times, setTimes] = useState<ShiftTimes>(initialTimes);
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => {
    if (!open) return;
    setTimes(initialTimes);
    setNotes(initialNotes);
    // Mở lại hộp thì lấy đúng giờ của ngữ cảnh hiện tại (ngày khác, người khác).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTimes.checkInAm, initialTimes.checkOutAm, initialTimes.checkInPm, initialTimes.checkOutPm, initialNotes]);

  if (!open) return null;
  const hours = shiftHours(times);

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Đóng" className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]" onClick={() => !loading && onClose()} />
      <div className="relative z-[96] w-full max-w-lg rounded-t-2xl border border-[#e2e8f0] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.16)] sm:rounded-2xl">
        <h3 className="text-lg font-black tracking-tight text-[#0f1729]">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-sm text-[#64748b]">{subtitle}</p> : null}

        <div className="mt-4">
          <ShiftPicker value={times} onChange={setTimes} compact />
        </div>

        <label className="mt-3 block space-y-1">
          <span className="label-sm">Ghi chú ngày công</span>
          <input
            className="input"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="VD: đi muộn 15 phút, nghỉ phép buổi sáng, hỗ trợ sự kiện cuối giờ..."
          />
        </label>

        {extra ? <div className="mt-3">{extra}</div> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onConfirm(times, notes)}
            disabled={loading || hours <= 0}
            className="btn-primary flex-1"
          >
            {loading ? "Đang lưu..." : `${confirmLabel} · ${hours.toFixed(2)}h (${shiftDays(hours).toFixed(2)} công)`}
          </button>
          <button type="button" onClick={onClose} disabled={loading} className="btn-ghost">
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}
