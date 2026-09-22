// CHIẾT KHẤU KHI THU TIỀN MẶT — phần tính toán thuần, dùng chung cho màn thu tiền và API
// /api/payments để hai bên không bao giờ nói hai con số khác nhau.
//
// Ý nghĩa nghiệp vụ: "giảm 3% cho phụ huynh đóng tiền mặt" = phụ huynh chỉ phải trả 97% của
// khoản nợ được xóa. Nghĩa là:
//     tiền mặt  =  khoản nợ được xóa × (100% − %chiết khấu)
//     chiết khấu =  khoản nợ được xóa − tiền mặt
//
// CÁCH TÍNH CŨ SAI: lấy %chiết khấu nhân với TIỀN MẶT rồi cộng vào để ra phần nợ được xóa.
// Hậu quả thật (nợ 3.775.000đ, giảm 3%):
//   - gõ đúng số nợ 3.775.000đ → màn hình báo "xóa nợ 3.888.250đ" (nhiều hơn cả số nợ) và
//     API chặn không cho lưu;
//   - thu 97% số nợ (3.660.750đ) → chỉ giảm 109.823đ, phụ huynh đóng đủ mà vẫn còn nợ 4.427đ;
//   - muốn hết nợ phải gõ đúng 3.665.049đ — không ai đoán được.
// Nay tính ngược đúng chiều, và có sẵn "thu bao nhiêu thì hết nợ" để bấm 1 nút.

export const MAX_CASH_DISCOUNT_PERCENT = 10;
export const CASH_METHOD = "Tiền mặt";

export type CashDiscountInput = {
  /** Tiền mặt thật nhận của phụ huynh. */
  cash: number;
  /** % chiết khấu tiền mặt (0–10). */
  percent: number;
  /** Công nợ đang treo của học viên. */
  outstanding: number;
};

export type CashDiscountResult = {
  /** Phần tiền mặt dùng để trả nợ (phần vượt nằm ở advanceAmount). */
  cashForDebt: number;
  /** Tiền thu vượt công nợ — để dành trừ vào phiếu học phí kỳ sau. */
  advanceAmount: number;
  /** Tổng công nợ được xóa = cashForDebt + discountAmount. */
  settledAmount: number;
  discountAmount: number;
  /** Công nợ còn lại sau khi thu. */
  remainingDebt: number;
  /** Thu đúng bao nhiêu tiền mặt thì hết sạch nợ (đã tính chiết khấu). */
  cashToClearAll: number;
};

export type TuitionOnlyCashDiscountInput = {
  cash: number;
  percent: number;
  tuitionOutstanding: number;
  materialsOutstanding: number;
};

export type TuitionOnlyCashDiscountResult = CashDiscountResult & {
  tuitionCash: number;
  materialsCash: number;
  tuitionSettled: number;
  materialsSettled: number;
  totalSettledAmount: number;
  totalRemainingDebt: number;
};

function clampPercent(percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.min(MAX_CASH_DISCOUNT_PERCENT, percent);
}

export function computeCashDiscount(input: CashDiscountInput): CashDiscountResult {
  const percent = clampPercent(input.percent);
  const outstanding = Math.max(0, Math.round(input.outstanding) || 0);
  const cash = Math.max(0, Math.round(input.cash) || 0);
  const rate = percent / 100;
  const cashToClearAll = Math.round(outstanding * (1 - rate));

  // Không có chiết khấu: tiền mặt trả nợ tới đâu hay tới đó, phần vượt là đóng trước.
  if (percent === 0) {
    const cashForDebt = Math.min(cash, outstanding);
    return {
      cashForDebt,
      advanceAmount: cash - cashForDebt,
      settledAmount: cashForDebt,
      discountAmount: 0,
      remainingDebt: outstanding - cashForDebt,
      cashToClearAll: outstanding,
    };
  }

  // Có chiết khấu: tiền mặt chỉ cần bằng (100% − %) của phần nợ muốn xóa. Tiền thu nhiều hơn
  // mức xóa hết nợ thì phần dư KHÔNG được nhân chiết khấu nữa (không có nợ để giảm).
  const cashForDebt = Math.min(cash, cashToClearAll);
  const settledAmount = cashForDebt >= cashToClearAll ? outstanding : Math.round(cashForDebt / (1 - rate));
  const cappedSettled = Math.min(outstanding, settledAmount);
  return {
    cashForDebt,
    advanceAmount: cash - cashForDebt,
    settledAmount: cappedSettled,
    discountAmount: cappedSettled - cashForDebt,
    remainingDebt: outstanding - cappedSettled,
    cashToClearAll,
  };
}

export function computeCashDiscountForTuitionOnly(input: TuitionOnlyCashDiscountInput): TuitionOnlyCashDiscountResult {
  const cash = Math.max(0, Math.round(input.cash) || 0);
  const tuitionOutstanding = Math.max(0, Math.round(input.tuitionOutstanding) || 0);
  const materialsOutstanding = Math.max(0, Math.round(input.materialsOutstanding) || 0);
  const materialsCash = Math.min(cash, materialsOutstanding);
  const tuitionDiscount = computeCashDiscount({
    cash: cash - materialsCash,
    percent: input.percent,
    outstanding: tuitionOutstanding,
  });

  const tuitionCash = tuitionDiscount.cashForDebt;
  const materialsSettled = materialsCash;
  const tuitionSettled = tuitionDiscount.settledAmount;
  const totalSettledAmount = materialsSettled + tuitionSettled;
  const totalOutstanding = materialsOutstanding + tuitionOutstanding;

  return {
    ...tuitionDiscount,
    cashForDebt: materialsCash + tuitionCash,
    advanceAmount: tuitionDiscount.advanceAmount,
    settledAmount: totalSettledAmount,
    remainingDebt: Math.max(0, totalOutstanding - totalSettledAmount),
    cashToClearAll: materialsOutstanding + tuitionDiscount.cashToClearAll,
    tuitionCash,
    materialsCash,
    tuitionSettled,
    materialsSettled,
    totalSettledAmount,
    totalRemainingDebt: Math.max(0, totalOutstanding - totalSettledAmount),
  };
}
