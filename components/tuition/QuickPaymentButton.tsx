"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import FormGuide from "@/components/ui/FormGuide";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CurrencyInput from "@/components/ui/CurrencyInput";
import { formatVnd } from "@/lib/export-utils";
import { CASH_METHOD, MAX_CASH_DISCOUNT_PERCENT, computeCashDiscountForTuitionOnly } from "@/lib/cash-discount";

const GUIDE_SECTIONS = [
  {
    title: "Khi nào dùng",
    items: [
      "Dùng khi trung tâm đã nhận tiền thật từ phụ huynh và cần ghi nhận vào công nợ.",
      "Form luôn tách rõ tiền học, tiền sách, phần giảm giá và số còn nợ/đóng trước.",
      "Chỉ nên bấm thu tiền khi tiền đã vào tay hoặc đã nhận được xác nhận chuyển khoản rõ ràng.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách nhập đúng",
    items: [
      "Số tiền thực thu là số tiền trung tâm nhận thực tế, không phải số công nợ đang treo.",
      "Phụ huynh đóng chẵn hoặc đóng trước cho kỳ sau thì cứ nhập đúng số đã cầm; phần vượt công nợ sẽ được giữ lại và tự trừ vào học phí kỳ sau.",
      "Chiết khấu tiền mặt chỉ tính trên phần học phí còn nợ; tiền sách luôn thu đủ, không giảm dù thu tiền mặt hay chuyển khoản.",
      "Diễn giải và ghi chú nên đủ rõ để người sau tra lại biết đây là khoản thu nào, từ ai, của kỳ nào.",
    ],
    tone: "success" as const,
  },
  {
    title: "Dễ sai",
    items: [
      "Không nhập số tiền khác với số tiền thật đã nhận, kể cả khi phụ huynh đóng thừa.",
      "Không dùng chiết khấu cho tiền sách hoặc tiền đóng trước; chiết khấu chỉ giảm phần học phí đang thực nợ.",
      "Không dùng chiết khấu tiền mặt cho các hình thức khác như chuyển khoản nếu quy trình nội bộ không cho phép.",
      "Không xác nhận đã thu khi phụ huynh mới hứa chuyển khoản nhưng chưa có bằng chứng đã nhận tiền.",
    ],
    tone: "warning" as const,
  },
  {
    title: "Kiểm tra xác nhận trước khi lưu",
    items: [
      "Đọc lại phần tóm tắt trước khi bấm xác nhận: Tiền học, Sách, Chiết khấu, Còn nợ hoặc Đóng trước phải đúng với thực tế thu.",
      "Nếu phiếu có tiền sách, hệ thống phải thể hiện sách được thu đủ 100% và không bị giảm bởi chiết khấu tiền mặt.",
      "Nếu số tiền nhập thấp hơn công nợ sau giảm, hệ thống chỉ ghi đúng số thực thu và giữ phần còn lại là công nợ.",
      "Nếu số tiền nhập cao hơn công nợ sau giảm, phần vượt được ghi nhận là đóng trước để đối trừ cho các kỳ tiếp theo.",
    ],
    tone: "success" as const,
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
  const [balance, setBalance] = useState<{
    outstanding: number;
    tuitionOutstanding: number;
    materialsOutstanding: number;
    discountableOutstanding: number;
    advanceBalance: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch(`/api/students/${studentId}/balance`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setBalance({
          outstanding: Number(data.outstanding) || 0,
          tuitionOutstanding: Number(data.tuitionOutstanding) || 0,
          materialsOutstanding: Number(data.materialsOutstanding) || 0,
          discountableOutstanding: Number(data.discountableOutstanding) || 0,
          advanceBalance: Number(data.advanceBalance) || 0,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, studentId]);

  const numericAmount = Number(amount) || 0;
  const outstanding = Math.max(0, balance ? balance.outstanding : suggestedAmount);
  const tuitionOutstanding = Math.max(0, balance ? balance.tuitionOutstanding : suggestedAmount);
  const materialsOutstanding = Math.max(0, balance ? balance.materialsOutstanding : 0);
  const numericDiscountPercent = Math.min(MAX_CASH_DISCOUNT_PERCENT, Math.max(0, Number(discountPercent) || 0));
  const cashDiscountActive = method === CASH_METHOD && enableCashDiscount && numericDiscountPercent > 0;
  const settlement = computeCashDiscountForTuitionOnly({
    cash: numericAmount,
    percent: cashDiscountActive ? numericDiscountPercent : 0,
    tuitionOutstanding,
    materialsOutstanding,
  });
  const discountAmount = settlement.discountAmount;
  const advanceAmount = settlement.advanceAmount;
  const totalDebtReduction = settlement.settledAmount;
  const remainingAfterPayment = Math.max(0, outstanding - totalDebtReduction);

  const discountSummary = useMemo(() => {
    if (!cashDiscountActive) return null;
    return (
      `Thu tiền mặt ${formatVnd(settlement.cashForDebt)} · Giảm ${numericDiscountPercent}% = ${formatVnd(discountAmount)}` +
      ` · Xóa nợ ${formatVnd(totalDebtReduction)} · Còn nợ ${formatVnd(settlement.remainingDebt)}` +
      (settlement.advanceAmount > 0 ? ` · Đóng trước ${formatVnd(settlement.advanceAmount)}` : "")
    );
  }, [cashDiscountActive, discountAmount, numericDiscountPercent, settlement.advanceAmount, settlement.cashForDebt, settlement.remainingDebt, totalDebtReduction]);

  function validate(): boolean {
    setError(null);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Số tiền thực thu phải lớn hơn 0.");
      return false;
    }
    if (cashDiscountActive && outstanding <= 0) {
      setError("Học viên không còn công nợ nên không có gì để chiết khấu. Bỏ chiết khấu rồi thu lại.");
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
        guide={
          <FormGuide
            title="Hướng dẫn xác nhận đã thu tiền"
            summary="Đây là bước chốt tiền đã nhận vào hệ thống. Người vận hành chỉ cần hiểu 3 thứ: số tiền thật nhận, hình thức thu và tác động giảm công nợ sau khi lưu."
            sections={GUIDE_SECTIONS}
            position="inline"
          />
        }
      >
        <form onSubmit={handleFormSubmit} className="space-y-5">
          <div className="overflow-hidden rounded-3xl border border-[#ffd6d6] bg-white shadow-[0_18px_44px_-34px_rgba(15,23,42,0.45)]">
            <div className="bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 px-5 py-4">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-rose-700">Công nợ đang treo</p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-rose-800">Học viên còn nợ</p>
                  <p className="mt-1 text-3xl font-black tabular-nums text-rose-700">{formatVnd(outstanding)}</p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-2 text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Sau khi thu</p>
                  <p className={`mt-0.5 text-xl font-black tabular-nums ${remainingAfterPayment > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                    {remainingAfterPayment > 0 ? formatVnd(remainingAfterPayment) : "Hết nợ"}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 divide-y divide-[#eef2f7] bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="px-5 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tiền học</p>
                <p className="mt-1 text-base font-black tabular-nums text-[#0f1729]">{formatVnd(tuitionOutstanding)}</p>
              </div>
              <div className="px-5 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Sách</p>
                <p className="mt-1 text-base font-black tabular-nums text-[#0f1729]">{formatVnd(materialsOutstanding)}</p>
              </div>
              <div className="px-5 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Giảm/đóng trước</p>
                <p className="mt-1 text-base font-black tabular-nums text-[#0f1729]">
                  {discountAmount > 0 ? `Giảm ${formatVnd(discountAmount)}` : advanceAmount > 0 ? `Dư ${formatVnd(advanceAmount)}` : "—"}
                </p>
              </div>
            </div>
            <div className="px-5 pb-4 pt-3 text-sm">
            {cashDiscountActive ? (
              <p className="text-rose-700">
                Giảm {numericDiscountPercent}% tiền mặt: thu đủ <strong>{formatVnd(settlement.cashToClearAll)}</strong> là hết nợ.
              </p>
            ) : null}
            {balance && balance.advanceBalance > 0 ? (
              <p className="text-rose-700">
                Đang có sẵn <strong>{formatVnd(balance.advanceBalance)}</strong> tiền đóng trước chưa dùng tới.
              </p>
            ) : null}
            {advanceAmount > 0 ? (
              <p className="rounded-2xl bg-amber-50 px-3 py-2 font-semibold text-[#8a5a00]">
                Thu dư {formatVnd(advanceAmount)} · hệ thống giữ lại làm tiền đóng trước và tự trừ vào học phí kỳ sau.
              </p>
            ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="rounded-2xl border border-[#e6eefc] bg-white p-4 shadow-sm">
              <span className="label-sm">Số tiền thực thu</span>
              <div className="mt-2">
                <CurrencyInput required min={1} value={amount} onChange={(next) => setAmount(String(next))} />
              </div>
              <p className="text-xs text-ink-muted48">
                {amount ? `Sẽ ghi nhận đã thu ${formatVnd(Number(amount) || 0)}. ` : ""}
                Nhập đúng số tiền thật đã nhận, kể cả khi nhiều hơn công nợ {formatVnd(outstanding)}.
              </p>
            </label>

            <label className="rounded-2xl border border-[#e6eefc] bg-white p-4 shadow-sm">
              <span className="label-sm">Ngày thu</span>
              <input type="date" required className="input mt-2" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} />
            </label>

            <label className="rounded-2xl border border-[#e6eefc] bg-white p-4 shadow-sm">
              <span className="label-sm">Hình thức</span>
              <select
                className="input mt-2"
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

            <label className="rounded-2xl border border-[#e6eefc] bg-white p-4 shadow-sm">
              <span className="label-sm">Diễn giải phiếu thu</span>
              <input className="input mt-2" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ví dụ: Thu học phí kỳ 8/2026, thu tiền giáo trình bổ sung..." />
            </label>
          </div>

          {method === CASH_METHOD ? (
            <div className="overflow-hidden rounded-3xl border border-[#f6d67b] bg-white shadow-sm">
              <div className="bg-[#fff8e8] px-4 py-4">
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
              </div>

              {enableCashDiscount ? (
                <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="label-sm">Chiết khấu (%)</span>
                    <input type="number" min="0" max={MAX_CASH_DISCOUNT_PERCENT} step="0.1" className="input" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} />
                    <p className="text-xs text-[#c76700]">Tối đa {MAX_CASH_DISCOUNT_PERCENT}%.</p>
                  </label>

                  <label className="space-y-2">
                    <span className="label-sm">Lý do chiết khấu tiền mặt</span>
                    <input className="input" required={cashDiscountActive} value={discountReason} onChange={(event) => setDiscountReason(event.target.value)} placeholder="Ví dụ: ưu đãi thu tiền mặt tại quầy, chốt đủ học phí trong ngày..." />
                  </label>

                  <div className="rounded-2xl border border-[#fde7a7] bg-[#fffdf7] p-4 md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c76700]">Tác động sau khi thu</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{discountSummary ?? "Chưa có chiết khấu hợp lệ."}</p>
                    {cashDiscountActive && outstanding > 0 && numericAmount !== settlement.cashToClearAll ? (
                      <button type="button" className="btn-ghost-sm mt-2" onClick={() => setAmount(String(settlement.cashToClearAll))}>
                        Điền {formatVnd(settlement.cashToClearAll)} · thu đủ để hết nợ sau giảm {numericDiscountPercent}%
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <label className="rounded-2xl border border-[#e6eefc] bg-white p-4 shadow-sm">
            <span className="label-sm">Ghi chú đối soát</span>
            <textarea className="input mt-2 min-h-[120px]" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ví dụ: phụ huynh chuyển khoản từ ngân hàng A, đã chụp bill; hoặc thu tiền mặt tại quầy lúc 19:30..." />
          </label>

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="slideover-footer justify-between">
            <p className="text-sm font-semibold text-slate-500">
              Thu {formatVnd(numericAmount)} · sau thu {remainingAfterPayment > 0 ? `còn ${formatVnd(remainingAfterPayment)}` : "hết nợ"}
            </p>
            <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Đang lưu..." : "Xác nhận đã thu"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Đóng
            </button>
            </div>
          </div>
        </form>
      </ResponsiveDrawer>

      <ConfirmDialog
        open={confirmOpen}
        title="Xác nhận đã thu tiền?"
        description={[
          `Số tiền thu: ${formatVnd(numericAmount)} · ${method}`,
          `Tiền học: ${formatVnd(tuitionOutstanding)} · Sách: ${formatVnd(materialsOutstanding)}`,
          cashDiscountActive
            ? `Chiết khấu ${numericDiscountPercent}%: giảm ${formatVnd(discountAmount)} trên phiếu học phí · tổng công nợ được xóa ${formatVnd(totalDebtReduction)}`
            : "",
          `Công nợ hiện tại: ${formatVnd(outstanding)} -> sau khi thu: ${formatVnd(Math.max(0, outstanding - totalDebtReduction))}`,
          advanceAmount > 0 ? `Trong đó ${formatVnd(advanceAmount)} là tiền đóng trước, tự trừ vào học phí kỳ sau.` : "",
          "Tiền vào phiếu đóng theo tháng sẽ tự nạp ví buổi học theo đơn giá của chính phiếu đó.",
          "",
          "Chỉ xác nhận khi tiền đã thực sự vào tay hoặc đã có bằng chứng chuyển khoản rõ ràng.",
        ]
          .filter(Boolean)
          .join("\n")}
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
