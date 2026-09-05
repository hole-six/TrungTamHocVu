"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import FormGuide from "@/components/ui/FormGuide";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CurrencyInput from "@/components/ui/CurrencyInput";
import { formatVnd } from "@/lib/export-utils";

const CASH_METHOD = "Tiền mặt";
const MAX_CASH_DISCOUNT_PERCENT = 10;

const GUIDE_SECTIONS = [
  {
    title: "Form này dùng để làm gì?",
    items: [
      "Dùng khi trung tâm đã nhận tiền thật từ phụ huynh và cần xác nhận khoản đó vào hệ thống.",
      "Mục tiêu của form là chốt chính xác: đã thu bao nhiêu, thu ngày nào, thu bằng cách nào và có giảm riêng hay không.",
      "Chỉ nên bấm thu tiền khi tiền đã vào tay hoặc đã nhận được xác nhận chuyển khoản rõ ràng.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách nhập an toàn",
    items: [
      "Số tiền thực thu là số tiền trung tâm nhận thực tế, không phải số công nợ đang treo.",
      "Nếu có chiết khấu tiền mặt thì hệ thống sẽ tự giảm công nợ thêm phần chiết khấu, nên phải nhập đúng lý do.",
      "Diễn giải và ghi chú nên đủ rõ để người sau tra lại biết đây là khoản thu nào, từ ai, của kỳ nào.",
    ],
    tone: "success" as const,
  },
  {
    title: "Các lỗi phải tránh",
    items: [
      "Không nhập số tiền lớn hơn công nợ còn lại.",
      "Không dùng chiết khấu tiền mặt cho các hình thức khác như chuyển khoản nếu quy trình nội bộ không cho phép.",
      "Không xác nhận đã thu khi phụ huynh mới hứa chuyển khoản nhưng chưa có bằng chứng đã nhận tiền.",
    ],
    tone: "warning" as const,
  },
];

export default function QuickPaymentButton({
  studentId,
  suggestedAmount,
  autoOpen = false,
  onChanged,
}: {
  studentId: string;
  suggestedAmount: number;
  autoOpen?: boolean;
  /** Nơi hiển thị tự giữ dữ liệu trong state (drawer học viên) phải được báo để nạp
   *  lại — router.refresh() chỉ làm mới server component, không đụng tới state đó. */
  onChanged?: () => void;
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const numericAmount = Number(amount) || 0;
  const maxReceivable = Math.max(0, suggestedAmount);
  const numericDiscountPercent = Math.min(MAX_CASH_DISCOUNT_PERCENT, Math.max(0, Number(discountPercent) || 0));
  const cashDiscountActive = method === CASH_METHOD && enableCashDiscount && numericDiscountPercent > 0;
  const discountAmount = cashDiscountActive ? Math.round((numericAmount * numericDiscountPercent) / 100) : 0;
  const totalDebtReduction = numericAmount + discountAmount;

  const discountSummary = useMemo(() => {
    if (!cashDiscountActive) return null;
    return `Thu thực nhận ${formatVnd(numericAmount)} · Giảm ${numericDiscountPercent}% = ${formatVnd(discountAmount)} · Công nợ giảm ${formatVnd(totalDebtReduction)}`;
  }, [cashDiscountActive, discountAmount, numericAmount, numericDiscountPercent, totalDebtReduction]);

  function validate(): boolean {
    setError(null);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Số tiền thực thu phải lớn hơn 0.");
      return false;
    }
    if (numericAmount > maxReceivable) {
      setError(`Số tiền thực thu không được lớn hơn công nợ còn lại ${formatVnd(maxReceivable)}.`);
      return false;
    }
    if (totalDebtReduction > maxReceivable) {
      setError(`Tổng số tiền giảm công nợ sau chiết khấu là ${formatVnd(totalDebtReduction)}, đang vượt công nợ còn lại ${formatVnd(maxReceivable)}.`);
      return false;
    }
    if (cashDiscountActive && !discountReason.trim()) {
      setError("Cần nhập lý do chiết khấu tiền mặt.");
      return false;
    }
    return true;
  }

  function handleFormSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (validate()) setConfirmOpen(true);
  }

  async function submit() {
    if (!validate()) return;
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

    setConfirmOpen(false);
    setOpen(false);
    setNotes("");
    setDescription("");
    setEnableCashDiscount(false);
    setDiscountPercent("0");
    setDiscountReason("");
    router.refresh();
    onChanged?.();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        Thu tiền
      </button>

      <ResponsiveDrawer 
        open={open}
        onClose={() => setOpen(false)}
        title="Ghi nhận đã thu tiền"
        description="Lưu rõ số tiền đã nhận, ngày thu, hình thức thanh toán và phần giảm riêng cho tiền mặt nếu có."
        guide={<FormGuide title="Hướng dẫn xác nhận đã thu tiền" summary="Đây là bước chốt tiền đã nhận vào hệ thống. Người vận hành chỉ cần hiểu 3 thứ: số tiền thật nhận, hình thức thu và tác động giảm công nợ sau khi lưu." sections={GUIDE_SECTIONS} position="inline" />}
      >
        <form onSubmit={handleFormSubmit} className="space-y-5">
          <div className="rounded-3xl border-2 border-rose-200 bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 px-5 py-4 text-sm text-rose-800 shadow-[0_16px_34px_rgba(244,63,94,0.08)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-700">Giới hạn thu tiền</p>
            <p className="mt-2 text-base font-semibold">
              Còn được thu tối đa <strong>{formatVnd(maxReceivable)}</strong>.
            </p>
            {cashDiscountActive ? <p className="mt-1 text-sm text-rose-700">Tổng giảm công nợ sau chiết khấu hiện là <strong>{formatVnd(totalDebtReduction)}</strong>.</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="label-sm">Số tiền thực thu</span>
              <CurrencyInput required min={1} max={maxReceivable > 0 ? maxReceivable : undefined} value={amount} onChange={(next) => setAmount(String(next))} />
              <p className="text-xs text-ink-muted48">
                {amount ? `Sẽ ghi nhận đã thu ${formatVnd(Number(amount) || 0)}. ` : ""}
                Không được nhập lớn hơn {formatVnd(maxReceivable)}.
              </p>
            </label>

            <label className="space-y-2">
              <span className="label-sm">Ngày thu</span>
              <input type="date" required className="input" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} />
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
              <input className="input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ví dụ: Thu học phí kỳ 8/2026, thu tiền giáo trình bổ sung..." />
            </label>
          </div>

          {method === CASH_METHOD ? (
            <div className="rounded-3xl border border-[#f6d67b] bg-[#fff8e8] p-4">
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
                  <p className="text-sm font-semibold text-[#8a5a00]">Áp dụng chiết khấu tiền mặt</p>
                  <p className="text-xs text-[#c76700]">Chỉ dùng cho thu tiền mặt. Mức giảm bị chặn tối đa {MAX_CASH_DISCOUNT_PERCENT}% và bắt buộc ghi lý do.</p>
                </div>
              </label>

              {enableCashDiscount ? (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="label-sm">Chiết khấu (%)</span>
                    <input type="number" min="0" max={MAX_CASH_DISCOUNT_PERCENT} step="0.1" className="input" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} />
                    <p className="text-xs text-[#c76700]">Tối đa {MAX_CASH_DISCOUNT_PERCENT}%.</p>
                  </label>

                  <label className="space-y-2">
                    <span className="label-sm">Lý do chiết khấu tiền mặt</span>
                    <input className="input" required={cashDiscountActive} value={discountReason} onChange={(event) => setDiscountReason(event.target.value)} placeholder="Ví dụ: ưu đãi thu tiền mặt tại quầy, chốt đủ học phí trong ngày..." />
                  </label>

                  <div className="rounded-2xl border border-white/70 bg-white/80 p-4 md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c76700]">Tác động sau khi thu</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{discountSummary ?? "Chưa có chiết khấu hợp lệ."}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <label className="space-y-2">
            <span className="label-sm">Ghi chú đối soát</span>
            <textarea className="input min-h-[110px]" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ví dụ: phụ huynh chuyển khoản từ ngân hàng A, đã chụp bill; hoặc thu tiền mặt tại quầy lúc 19:30..." />
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
      </ResponsiveDrawer>

      <ConfirmDialog
        open={confirmOpen}
        title="Xác nhận đã thu tiền?"
        description={`Ghi nhận đã thu ${formatVnd(numericAmount)} bằng ${method}${cashDiscountActive ? `, kèm chiết khấu ${numericDiscountPercent}% (giảm công nợ tổng cộng ${formatVnd(totalDebtReduction)})` : ""}. Chỉ xác nhận khi tiền đã thực sự vào tay hoặc đã có bằng chứng chuyển khoản rõ ràng.`}
        confirmLabel="Xác nhận đã thu"
        loading={loading}
        onConfirm={submit}
        onClose={() => {
          if (!loading) setConfirmOpen(false);
        }}
      />
    </>
  );
}
