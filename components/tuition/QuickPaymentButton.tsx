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
    title: "Form n�y d�ng để l�m g�?",
    items: [
      "D�ng khi trung t�m đ� nhận tiền thật từ phụ huynh v� cần x�c nhận khoản đ� v�o hệ thống.",
      "Mục ti�u của form l� chốt ch�nh x�c: đ� thu bao nhi�u, thu ng�y n�o, thu bằng c�ch n�o v� c� giảm ri�ng hay kh�ng.",
      "Chỉ n�n bấm thu tiền khi tiền đ� v�o tay hoặc đ� nhận được x�c nhận chuyển khoản r� r�ng.",
    ],
    tone: "info" as const,
  },
  {
    title: "C�ch nhập an to�n",
    items: [
      "Số tiền thực thu l� số tiền trung t�m nhận thực tế, kh�ng phải số c�ng nợ đang treo.",
      "Phụ huynh đ�ng chẵn hoặc đ�ng trước cho kỳ sau th� cứ nhập đ�ng số đ� cầm � phần vượt c�ng nợ sẽ được giữ lại v� tự trừ v�o học ph� kỳ sau.",
      "Nếu c� chiết khấu tiền mặt th� hệ thống sẽ tự giảm c�ng nợ th�m phần chiết khấu, n�n phải nhập đ�ng l� do.",
      "Diễn giải v� ghi ch� n�n đủ r� để người sau tra lại biết đ�y l� khoản thu n�o, từ ai, của kỳ n�o.",
    ],
    tone: "success" as const,
  },
  {
    title: "C�c lỗi phải tr�nh",
    items: [
      "Kh�ng nhập số tiền kh�c với số tiền thật đ� nhận, kể cả khi phụ huynh đ�ng thừa.",
      "Kh�ng d�ng chiết khấu cho phần tiền đ�ng trước � chiết khấu chỉ giảm được phần đang thực nợ.",
      "Kh�ng d�ng chiết khấu tiền mặt cho c�c h�nh thức kh�c như chuyển khoản nếu quy tr�nh nội bộ kh�ng cho ph�p.",
      "Kh�ng x�c nhận đ� thu khi phụ huynh mới hứa chuyển khoản nhưng chưa c� bằng chứng đ� nhận tiền.",
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
  /** Nơi hiển thị tự giữ dữ liệu trong state (drawer học vi�n) phải được b�o để nạp
   *  lại � router.refresh() chỉ l�m mới server component, kh�ng đụng tới state đ�. */
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
  // C�ng nợ v� tiền đ�ng trước lấy từ đ�ng nguồn với API thu tiền � suggestedAmount chỉ
  // d�ng l�m số gợi � điền sẵn, v� t�y chỗ gọi m� n� l� c�ng nợ cả học vi�n hay chỉ l�
  // phần c�n thiếu của một phiếu học ph�.
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
  // C�ng nợ đang treo. KH�NG c�n l� trần thu tiền: phụ huynh đ�ng chẵn hoặc đ�ng trước
  // cho kỳ sau l� chuyện h�ng ng�y, phần vượt được giữ lại th�nh tiền đ�ng trước v� tự
  // trừ v�o phiếu học ph� kỳ sau � xem lib/server/advance-payment.ts.
  const outstanding = Math.max(0, balance ? balance.outstanding : suggestedAmount);
  const tuitionOutstanding = Math.max(0, balance ? balance.tuitionOutstanding : suggestedAmount);
  const materialsOutstanding = Math.max(0, balance ? balance.materialsOutstanding : 0);
  const numericDiscountPercent = Math.min(MAX_CASH_DISCOUNT_PERCENT, Math.max(0, Number(discountPercent) || 0));
  const cashDiscountActive = method === CASH_METHOD && enableCashDiscount && numericDiscountPercent > 0;
  // D�ng CHUNG một ph�p t�nh với API thu tiền (lib/cash-discount.ts) để m�n h�nh v� số thực
  // ghi nhận kh�ng bao giờ lệch nhau: giảm x% nghĩa l� phụ huynh trả (100 − x)% khoản nợ
  // được x�a, kh�ng phải cộng th�m x% v�o số tiền mặt.
  const settlement = computeCashDiscountForTuitionOnly({
    cash: numericAmount,
    percent: cashDiscountActive ? numericDiscountPercent : 0,
    tuitionOutstanding,
    materialsOutstanding,
  });
  const discountAmount = settlement.discountAmount;
  const advanceAmount = settlement.advanceAmount;
  const totalDebtReduction = settlement.settledAmount;

  const discountSummary = useMemo(() => {
    if (!cashDiscountActive) return null;
    return (
      `Thu tiền mặt ${formatVnd(settlement.cashForDebt)} � Giảm ${numericDiscountPercent}% = ${formatVnd(discountAmount)}` +
      ` � X�a nợ ${formatVnd(totalDebtReduction)} � C�n nợ ${formatVnd(settlement.remainingDebt)}` +
      (settlement.advanceAmount > 0 ? ` � Đ�ng trước ${formatVnd(settlement.advanceAmount)}` : "")
    );
  }, [cashDiscountActive, discountAmount, numericDiscountPercent, settlement.advanceAmount, settlement.cashForDebt, settlement.remainingDebt, totalDebtReduction]);

  function validate(): boolean {
    setError(null);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Số tiền thực thu phải lớn hơn 0.");
      return false;
    }
    if (cashDiscountActive && outstanding <= 0) {
      setError("Học vi�n kh�ng c�n c�ng nợ n�n kh�ng c� g� để chiết khấu. Bỏ chiết khấu rồi thu lại.");
      return false;
    }
    if (cashDiscountActive && !discountReason.trim()) {
      setError("Cần nhập l� do chiết khấu tiền mặt.");
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
      setError(data.error ?? "Kh�ng thể ghi nhận thanh to�n.");
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
        title="Ghi nhận đ� thu tiền"
        description="Lưu r� số tiền đ� nhận, ng�y thu, h�nh thức thanh to�n v� phần giảm ri�ng cho tiền mặt nếu c�."
        guide={<FormGuide title="Hướng dẫn x�c nhận đ� thu tiền" summary="Đ�y l� bước chốt tiền đ� nhận v�o hệ thống. Người vận h�nh chỉ cần hiểu 3 thứ: số tiền thật nhận, h�nh thức thu v� t�c động giảm c�ng nợ sau khi lưu." sections={GUIDE_SECTIONS} position="inline" />}
      >
        <form onSubmit={handleFormSubmit} className="space-y-5">
          <div className="rounded-3xl border-2 border-rose-200 bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 px-5 py-4 text-sm text-rose-800 shadow-[0_16px_34px_rgba(244,63,94,0.08)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-700">C�ng nợ đang treo</p>
            <p className="mt-2 text-base font-semibold">
              Học vi�n c�n nợ <strong>{formatVnd(outstanding)}</strong>.
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-rose-700 sm:grid-cols-2">
              <p>Tiền học: <strong>{formatVnd(tuitionOutstanding)}</strong></p>
              <p>Sách: <strong>{formatVnd(materialsOutstanding)}</strong></p>
            </div>
            {cashDiscountActive ? (
              <p className="mt-1 text-sm text-rose-700">
                Giảm {numericDiscountPercent}% tiền mặt: thu đủ <strong>{formatVnd(settlement.cashToClearAll)}</strong> l� hết nợ.
              </p>
            ) : null}
            {balance && balance.advanceBalance > 0 ? (
              <p className="mt-2 text-sm text-rose-700">
                Đang c� sẵn <strong>{formatVnd(balance.advanceBalance)}</strong> tiền đ�ng trước chưa d�ng tới.
              </p>
            ) : null}
            {advanceAmount > 0 ? (
              <p className="mt-2 rounded-2xl bg-white/80 px-3 py-2 text-sm font-semibold text-[#8a5a00]">
                Thu dư {formatVnd(advanceAmount)} � hệ thống giữ lại l�m tiền đ�ng trước v� tự trừ v�o học ph� kỳ sau.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="label-sm">Số tiền thực thu</span>
              <CurrencyInput required min={1} value={amount} onChange={(next) => setAmount(String(next))} />
              <p className="text-xs text-ink-muted48">
                {amount ? `Sẽ ghi nhận đ� thu ${formatVnd(Number(amount) || 0)}. ` : ""}
                Nhập đ�ng số tiền thật đ� nhận, kể cả khi nhiều hơn c�ng nợ {formatVnd(outstanding)}.
              </p>
            </label>

            <label className="space-y-2">
              <span className="label-sm">Ng�y thu</span>
              <input type="date" required className="input" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} />
            </label>

            <label className="space-y-2">
              <span className="label-sm">H�nh thức</span>
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
                <option>V� điện tử</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="label-sm">Diễn giải phiếu thu</span>
              <input className="input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="V� dụ: Thu học ph� kỳ 8/2026, thu tiền gi�o tr�nh bổ sung..." />
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
                  <p className="text-sm font-semibold text-[#8a5a00]">�p dụng chiết khấu tiền mặt</p>
                  <p className="text-xs text-[#c76700]">Chỉ d�ng cho thu tiền mặt. Mức giảm bị chặn tối đa {MAX_CASH_DISCOUNT_PERCENT}% v� bắt buộc ghi l� do.</p>
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
                    <span className="label-sm">L� do chiết khấu tiền mặt</span>
                    <input className="input" required={cashDiscountActive} value={discountReason} onChange={(event) => setDiscountReason(event.target.value)} placeholder="V� dụ: ưu đ�i thu tiền mặt tại quầy, chốt đủ học ph� trong ng�y..." />
                  </label>

                  <div className="rounded-2xl border border-white/70 bg-white/80 p-4 md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c76700]">T�c động sau khi thu</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{discountSummary ?? "Chưa c� chiết khấu hợp lệ."}</p>
                    {cashDiscountActive && outstanding > 0 && numericAmount !== settlement.cashToClearAll ? (
                      <button
                        type="button"
                        className="btn-ghost-sm mt-2"
                        onClick={() => setAmount(String(settlement.cashToClearAll))}
                      >
                        Điền {formatVnd(settlement.cashToClearAll)} � thu đủ để hết nợ sau giảm {numericDiscountPercent}%
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <label className="space-y-2">
            <span className="label-sm">Ghi ch� đối so�t</span>
            <textarea className="input min-h-[110px]" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="V� dụ: phụ huynh chuyển khoản từ ng�n h�ng A, đ� chụp bill; hoặc thu tiền mặt tại quầy l�c 19:30..." />
          </label>

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex gap-3 border-t border-hairline pt-4">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Đang lưu..." : "X�c nhận đ� thu"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Đ�ng
            </button>
          </div>
        </form>
      </ResponsiveDrawer>

      <ConfirmDialog
        open={confirmOpen}
        title="X�c nhận đ� thu tiền?"
        description={[
          `Số tiền thu: ${formatVnd(numericAmount)} � ${method}`,
          `Tiền học: ${formatVnd(tuitionOutstanding)} · Sách: ${formatVnd(materialsOutstanding)}`,
          cashDiscountActive
            ? `Chiết khấu ${numericDiscountPercent}%: giảm ${formatVnd(discountAmount)} tr�n phiếu học ph� � tổng c�ng nợ được x�a ${formatVnd(totalDebtReduction)}`
            : "",
          // N�i thẳng c�ng nợ trước v� sau khi thu � nh�n vi�n đối chiếu ngay với số tiền
          // đang cầm tr�n tay, kh�ng phải tự trừ nhẩm.
          `C�ng nợ hiện tại: ${formatVnd(outstanding)} → sau khi thu: ${formatVnd(Math.max(0, outstanding - totalDebtReduction))}`,
          advanceAmount > 0 ? `Trong đ� ${formatVnd(advanceAmount)} l� tiền đ�ng trước, tự trừ v�o học ph� kỳ sau.` : "",
          "Tiền v�o phiếu đ�ng theo th�ng sẽ tự nạp v� buổi học theo đơn gi� của ch�nh phiếu đ�.",
          "",
          "Chỉ x�c nhận khi tiền đ� thực sự v�o tay hoặc đ� c� bằng chứng chuyển khoản r� r�ng.",
        ]
          .filter(Boolean)
          .join("\n")}
        confirmLabel="X�c nhận đ� thu"
        loading={loading}
        onConfirm={submit}
        onClose={() => {
          if (!loading) setConfirmOpen(false);
        }}
      />
    </>
  );
}
