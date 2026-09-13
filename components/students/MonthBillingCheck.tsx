"use client";

import { useState } from "react";
import { BILLING_PERIOD_STATUS_LABEL } from "@/lib/server/tuition-rules";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { formatVnd } from "@/lib/export-utils";
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
  unitPrice,
  canManageFinance,
  onDone,
}: {
  enrollmentId: string;
  value: MonthBilling;
  /** Đơn giá/buổi của ghi danh — để nói trước số tiền sẽ phát sinh khi lập phiếu. */
  unitPrice?: number | null;
  canManageFinance: boolean;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  // Lập phiếu là làm PHÁT SINH công nợ — phải xác nhận và nói trước số buổi, số tiền.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const month = Number(value.periodName.split("-")[1]);
  const statusLabel = value.periodStatus ? BILLING_PERIOD_STATUS_LABEL[value.periodStatus] ?? value.periodStatus : null;

  // Ước tính phần còn thiếu để nói trước số tiền trong hộp xác nhận.
  const missingSessions = Math.max(0, value.scheduledThisMonth - (value.billedScheduled ?? 0));
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
    setConfirmOpen(false);
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
        <button type="button" onClick={() => setConfirmOpen(true)} disabled={loading} className={ACTION_CLASS}>
          {loading ? "Đang lập phiếu..." : `Lập phiếu tháng ${month}`}
        </button>
      ) : null}
      {result ? <p className={result.ok ? "text-[#0f1729]" : "text-[#dc2626]"}>{result.text}</p> : null}

      <ConfirmDialog
        open={confirmOpen}
        title={`Lập phiếu học phí tháng ${month}?`}
        description={[
          `Lớp có ${value.scheduledThisMonth} buổi trong tháng ${month}.`,
          value.billedScheduled == null
            ? "Hiện chưa có phiếu tháng này."
            : `Phiếu hiện tại mới tính ${value.billedScheduled} buổi.`,
          missingSessions > 0
            ? `Sẽ phát sinh thêm khoảng ${missingSessions} buổi${unitPrice ? ` × ${formatVnd(unitPrice)} = ${formatVnd(missingSessions * unitPrice)}` : ""}.`
            : "",
          "",
          "Số buổi cuối cùng do hệ thống tính lại theo lịch lớp và số buổi còn dư trong ví, có thể lệch con số ước tính ở trên.",
        ]
          .filter(Boolean)
          .join("\n")}
        confirmLabel="Lập phiếu"
        loading={loading}
        onConfirm={() => void generate()}
        onClose={() => {
          if (!loading) setConfirmOpen(false);
        }}
      />
    </div>
  );
}
