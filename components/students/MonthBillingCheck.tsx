"use client";

import { useState } from "react";
import { BILLING_PERIOD_STATUS_LABEL } from "@/lib/server/tuition-rules";
import { ACTION_CLASS } from "@/components/ui/DetailDrawerParts";

export type MonthBilling = {
  periodName: string;
  periodStatus: string | null;
  scheduledThisMonth: number;
  billedScheduled: number | null;
};

// Lớp còn buổi trong tháng mà phiếu tháng này chưa có / tính thiếu — nói rõ VÌ SAO và cho
// lập ngay. Trước đây chỉ thấy "ví hết buổi" mà không biết tại sao không có học phí để thu.
export function needsMonthBilling(value: MonthBilling | null | undefined): value is MonthBilling {
  if (!value || value.scheduledThisMonth <= 0) return false;
  return value.billedScheduled == null || value.billedScheduled < value.scheduledThisMonth;
}

export default function MonthBillingCheck({
  enrollmentId,
  value,
  canManageFinance,
  onDone,
}: {
  enrollmentId: string;
  value: MonthBilling;
  canManageFinance: boolean;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const month = Number(value.periodName.split("-")[1]);
  const statusLabel = value.periodStatus ? BILLING_PERIOD_STATUS_LABEL[value.periodStatus] ?? value.periodStatus : null;

  const gap =
    value.billedScheduled == null
      ? `chưa có phiếu tháng ${month}`
      : `phiếu tháng ${month} mới tính ${value.billedScheduled} buổi`;
  const why =
    value.periodStatus === "POSTED" || value.periodStatus === "CLOSED"
      ? `Kỳ thu tháng ${month} đang "${statusLabel}" nên không lập/sửa phiếu được — mở lại kỳ ở trang Học phí trước.`
      : value.periodStatus === "REVIEWED" || value.periodStatus === "REOPENED"
        ? `Kỳ thu tháng ${month} đang "${statusLabel}" nên đợt lập phiếu tự động mỗi đêm bỏ qua — bấm lập phiếu để cập nhật.`
        : "Đợt lập phiếu tự động đêm nay sẽ cập nhật, hoặc bấm lập phiếu ngay.";

  async function generate() {
    setLoading(true);
    setResult(null);
    const res = await fetch(`/api/enrollments/${enrollmentId}/period-charge`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setResult({ ok: false, text: data.error ?? "Không lập được phiếu." });
      return;
    }
    const reasons: string[] = data.reasons ?? [];
    const charge = data.charge as { sessionCount: number; scheduledSessionCount: number } | null;
    if (charge && charge.scheduledSessionCount >= value.scheduledThisMonth) {
      setResult({ ok: true, text: `Đã lập phiếu tháng ${month}: thu ${charge.sessionCount} buổi.` });
      onDone();
      return;
    }
    setResult({ ok: false, text: reasons.length > 0 ? reasons.join(" ") : "Hệ thống không lập thêm được — kiểm tra phiếu tháng này ở mục Học phí." });
    onDone();
  }

  return (
    <div className="space-y-2">
      <p className="text-amber-700">
        Tháng {month} lớp có {value.scheduledThisMonth} buổi nhưng {gap}. {why}
      </p>
      {canManageFinance && value.periodStatus !== "POSTED" && value.periodStatus !== "CLOSED" ? (
        <button type="button" onClick={() => void generate()} disabled={loading} className={ACTION_CLASS}>
          {loading ? "Đang lập phiếu..." : `Lập phiếu tháng ${month}`}
        </button>
      ) : null}
      {result ? <p className={result.ok ? "text-[#0f1729]" : "text-[#dc2626]"}>{result.text}</p> : null}
    </div>
  );
}
