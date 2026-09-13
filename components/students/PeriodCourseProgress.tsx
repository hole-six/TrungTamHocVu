"use client";

import { useState } from "react";
import { ACTION_CLASS } from "@/components/ui/DetailDrawerParts";

export type PeriodCourse = { total: number | null; billed: number; remaining: number | null };

// Đóng theo tháng nhưng học theo SỐ BUỔI CỦA KHÓA: cho biết đã lập phiếu bao nhiêu buổi,
// còn bao nhiêu thì thôi thu. Ghi danh cũ chưa có số này thì đặt ngay tại đây.
export default function PeriodCourseProgress({
  enrollmentId,
  value,
  suggestedTotal,
  canManageFinance,
  onSaved,
}: {
  enrollmentId: string;
  value: PeriodCourse;
  suggestedTotal: number | null;
  canManageFinance: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(String(value.total ?? suggestedTotal ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/enrollments/${enrollmentId}/period-course`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodCourseSessionCount: Number(input) }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Không lưu được.");
      return;
    }
    setEditing(false);
    onSaved();
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            className="input h-9 w-24"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            aria-label="Số buổi của khóa"
          />
          <span className="text-sm text-[#475569]">buổi</span>
          <button type="button" onClick={() => void save()} disabled={saving} className="btn-primary-sm">
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="btn-ghost-sm">
            Hủy
          </button>
        </div>
        <p className="text-xs text-[#64748b]">Tính cho lớp hiện tại: đã lập phiếu {value.billed} buổi ở lớp này.</p>
        {error ? <p className="text-xs text-[#dc2626]">{error}</p> : null}
      </div>
    );
  }

  const editButton = canManageFinance ? (
    <button type="button" onClick={() => setEditing(true)} className="ml-2 text-xs font-bold text-[#0f1729] underline underline-offset-2">
      {value.total == null ? "Đặt số buổi khóa" : "Sửa"}
    </button>
  ) : null;

  if (value.total == null) {
    return (
      <span className="text-[#b45309]">
        Chưa đặt — đang thu liên tục theo lịch lớp{editButton}
      </span>
    );
  }
  return (
    <span>
      Đã lập phiếu {value.billed}/{value.total} buổi ·{" "}
      <strong className={value.remaining === 0 ? "text-[#0f1729]" : undefined}>
        {value.remaining === 0 ? "đã lập phiếu đủ khóa" : `còn ${value.remaining} buổi`}
      </strong>
      {editButton}
    </span>
  );
}

export function CourseFinishedAdvice({
  total,
  walletBalance,
  unpaidAmount,
  nextClassName,
}: {
  total: number;
  walletBalance: number | null;
  unpaidAmount: number;
  nextClassName?: string | null;
}) {
  if (unpaidAmount > 0) {
    return (
      <span className="text-amber-700">
        Đã lập phiếu đủ {total} buổi của khóa — không lập phiếu tháng nữa. Còn nợ {unpaidAmount.toLocaleString("vi-VN")}đ trên các
        phiếu đó, thu nốt là xong tiền khóa.
      </span>
    );
  }
  if ((walletBalance ?? 0) > 0) {
    return (
      <span className="text-[#475569]">
        Đã thu đủ {total} buổi của khóa — không lập phiếu tháng nữa. Còn {walletBalance} buổi đã đóng trong ví để học nốt
        {nextClassName ? `; lớp hết lịch trước thì học nốt ở ${nextClassName}` : ""}.
      </span>
    );
  }
  return (
    <span className="text-amber-700">
      Đã học đủ {total} buổi của khóa. Học tiếp thì ghi danh khóa mới (gán lớp mới), không thì rút lớp / kết thúc.
    </span>
  );
}
