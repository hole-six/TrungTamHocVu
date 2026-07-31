"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";

function formatVnd(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

const CASH_METHOD = "Tiền mặt";
const MAX_CASH_DISCOUNT_PERCENT = 10;

export default function QuickPaymentButton({
  studentId,
  suggestedAmount,
  autoOpen = false,
}: {
  studentId: string;
  suggestedAmount: number;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [amount, setAmount] = useState(String(Math.max(0, suggestedAmount)));
  const [method, setMethod] = useState(CASH_METHOD);
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [enableCashDiscount, setEnableCashDiscount] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericAmount = Number(amount) || 0;
  const maxReceivable = Math.max(0, suggestedAmount);
  const numericDiscountPercent = Math.min(MAX_CASH_DISCOUNT_PERCENT, Math.max(0, Number(discountPercent) || 0));
  const cashDiscountActive = method === CASH_METHOD && enableCashDiscount && numericDiscountPercent > 0;
  const discountAmount = cashDiscountActive ? Math.round((numericAmount * numericDiscountPercent) / 100) : 0;
  const totalDebtReduction = numericAmount + discountAmount;

  const discountSummary = useMemo(() => {
    if (!cashDiscountActive) return null;
    return `Thu thực nhận ${formatVnd(numericAmount)} · Giảm ${numericDiscountPercent}% = ${formatVnd(
      discountAmount,
    )} · Công nợ giảm ${formatVnd(totalDebtReduction)}`;
  }, [cashDiscountActive, discountAmount, numericAmount, numericDiscountPercent, totalDebtReduction]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Số tiền thực thu phải lớn hơn 0.");
      return;
    }
    if (numericAmount > maxReceivable) {
      setError(`Số tiền thực thu không được lớn hơn công nợ còn lại ${formatVnd(maxReceivable)}.`);
      return;
    }
    if (totalDebtReduction > maxReceivable) {
      setError(
        `Tổng số tiền giảm công nợ sau chiết khấu là ${formatVnd(totalDebtReduction)}, đang vượt công nợ còn lại ${formatVnd(maxReceivable)}.`,
      );
      return;
    }
    if (cashDiscountActive && !discountReason.trim()) {
      setError("Cần nhập lý do chiết khấu tiền mặt.");
      return;
    }

    setLoading(true);

    const response = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        amount: numericAmount,
        method,
        paidDate,
        notes,
        description,
        discountPercent: cashDiscountActive ? numericDiscountPercent : 0,
        discountReason: cashDiscountActive ? discountReason.trim() : "",
      }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Không thể ghi nhận thanh toán.");
      return;
    }

    setOpen(false);
    setNotes("");
    setDescription("");
    setEnableCashDiscount(false);
    setDiscountPercent("0");
    setDiscountReason("");
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        Thu tiền
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Ghi nhận đã thu tiền"
        description="Lưu rõ số tiền đã nhận, ngày thu, hình thức thanh toán và phần giảm riêng cho tiền mặt nếu có."
      >
        <form onSubmit={submit} className="space-y-5">
          <div className="rounded-3xl border-2 border-rose-200 bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 px-5 py-4 text-sm text-rose-800 shadow-[0_16px_34px_rgba(244,63,94,0.08)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-700">Giới hạn thu tiền</p>
            <p className="mt-2 text-base font-semibold">
              Còn được thu tối đa <strong>{formatVnd(maxReceivable)}</strong>.
            </p>
            {cashDiscountActive ? (
              <p className="mt-1 text-sm text-rose-700">
                Tổng giảm công nợ sau chiết khấu hiện là <strong>{formatVnd(totalDebtReduction)}</strong>.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="label-sm">Số tiền thực thu</span>
              <input
                type="number"
                required
                min="1"
                max={maxReceivable > 0 ? maxReceivable : undefined}
                className="input"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <p className="text-xs text-ink-muted48">Không được nhập lớn hơn {formatVnd(maxReceivable)}.</p>
            </label>

            <label className="space-y-2">
              <span className="label-sm">Ngày thu</span>
              <input
                type="date"
                required
                className="input"
                value={paidDate}
                onChange={(event) => setPaidDate(event.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="label-sm">Hình thức</span>
              <select
                className="input"
                value={method}
                onChange={(event) => {
                  const nextMethod = event.target.value;
                  setMethod(nextMethod);
                  if (nextMethod !== CASH_METHOD) {
                    setEnableCashDiscount(false);
                    setDiscountPercent("0");
                    setDiscountReason("");
                  }
                }}
              >
                <option>{CASH_METHOD}</option>
                <option>Chuyển khoản</option>
                <option>Quẹt thẻ</option>
                <option>Ví điện tử</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="label-sm">Diễn giải phiếu thu</span>
              <input
                className="input"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Ví dụ: Thu học phí kỳ 8/2026, thu tiền giáo trình bổ sung..."
              />
            </label>
          </div>

          {method === CASH_METHOD ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-[#c8d5ec] text-primary"
                  checked={enableCashDiscount}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setEnableCashDiscount(checked);
                    if (!checked) {
                      setDiscountPercent("0");
                      setDiscountReason("");
                    }
                  }}
                />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-900">Áp dụng chiết khấu tiền mặt</p>
                  <p className="text-xs text-amber-800">
                    Chỉ dùng cho thu tiền mặt. Mức giảm bị chặn tối đa {MAX_CASH_DISCOUNT_PERCENT}% và bắt buộc ghi lý do.
                  </p>
                </div>
              </label>

              {enableCashDiscount ? (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="label-sm">Chiết khấu (%)</span>
                    <input
                      type="number"
                      min="0"
                      max={MAX_CASH_DISCOUNT_PERCENT}
                      step="0.1"
                      className="input"
                      value={discountPercent}
                      onChange={(event) => setDiscountPercent(event.target.value)}
                    />
                    <p className="text-xs text-amber-700">Tối đa {MAX_CASH_DISCOUNT_PERCENT}%.</p>
                  </label>

                  <label className="space-y-2">
                    <span className="label-sm">Lý do chiết khấu tiền mặt</span>
                    <input
                      className="input"
                      required={cashDiscountActive}
                      value={discountReason}
                      onChange={(event) => setDiscountReason(event.target.value)}
                      placeholder="Ví dụ: ưu đãi thu tiền mặt tại quầy, chốt đủ học phí trong ngày..."
                    />
                  </label>

                  <div className="rounded-2xl border border-white/70 bg-white/80 p-4 md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Tác động sau khi thu</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{discountSummary ?? "Chưa có chiết khấu hợp lệ."}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <label className="space-y-2">
            <span className="label-sm">Ghi chú đối soát</span>
            <textarea
              className="input min-h-[110px]"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ví dụ: phụ huynh chuyển khoản từ ngân hàng A, đã chụp bill; hoặc thu tiền mặt tại quầy lúc 19:30..."
            />
          </label>

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex gap-3 border-t border-hairline pt-4">
            <button type="submit" disabled={loading || maxReceivable <= 0} className="btn-primary">
              {loading ? "Đang lưu..." : "Xác nhận đã thu"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Đóng
            </button>
          </div>
        </form>
      </SlideOver>
    </>
  );
}
