// Quy tắc nghiệp vụ Học phí — nguồn TheoDoiHP/T_HP (Master Spec §5 FR-0091..FR-0121).
// Đây là sheet phức tạp và lỗi nhiều nhất trong Excel gốc (133,367 ô công thức,
// #N/A 49,801 + #VALUE! 17,901 + #REF! 3,902) — nguyên nhân chính là "Cong don"
// (công nợ dồn) được tính bằng SUMIFS cộng dồn thủ công theo thứ tự dòng, rất dễ
// vỡ khi chèn/xóa dòng. Ở đây thay bằng công nợ tính động (SUM charges - SUM
// allocations) — không có khái niệm "thứ tự dòng" nên không thể lệch kiểu đó.
//
// spec §14 liệt kê "Công thức học phí có ngoại lệ nghỉ/chuyển lớp" là điểm KHÔNG
// được tự động quyết định trước khi chốt — vì vậy so_buoi/buoi_nghi/buoi_tru tính
// gợi ý từ dữ liệu thật (ClassSession/StudentAttendance) nhưng vẫn cho sửa tay
// trước khi chốt kỳ (period status GENERATED, chưa POSTED).

export function computeEffectiveUnitPrice(
  basePrice: number,
  scholarshipPct: number,
  adjustmentPct: number
): number {
  const rate = Math.max(0, 1 - scholarshipPct - adjustmentPct);
  return Math.round(basePrice * rate);
}

// FR-0094: HP thang hien tai = (So buoi - Buoi nghi - Buoi tru) * ĐG
export function computeTuitionAmount(
  sessionCount: number,
  absentCount: number,
  deductedCount: number,
  unitPrice: number
): number {
  return Math.max(0, sessionCount - absentCount - deductedCount) * unitPrice;
}

// FR-0096: TongHP = HP thang hien tai + TienGiaoTrinh + HP dau ky
export function computeTotalAmount(tuitionAmount: number, materialsAmount: number, openingBalance: number): number {
  return tuitionAmount + materialsAmount + openingBalance;
}

// Phần công nợ THẬT SỰ mới phát sinh của riêng charge này (tiền học + tiền giáo trình
// kỳ này) — KHÔNG gồm openingBalance. openingBalance chỉ là bản chụp lại (snapshot)
// đúng khoản nợ của (các) charge kỳ TRƯỚC để hiển thị "tổng phải nộp" cho phụ huynh dễ
// thấy, KHÔNG PHẢI một khoản nợ mới độc lập — khoản nợ đó đã được tính đủ ở chính
// charge kỳ trước rồi (computeOutstandingBalance cộng tuitionAmount+materialsAmount
// trên TOÀN BỘ charge, không cộng openingBalance, để tránh đúng lỗi đếm trùng này).
// Dùng hàm này (KHÔNG dùng totalAmount) làm cơ sở cho: (1) vòng lặp phân bổ thanh toán
// FIFO — nếu không, tiền trả đủ công nợ thật vẫn có thể để lại charge kỳ sau hiện "còn
// nợ" dù đã trả hết; (2) trạng thái đã/chưa thu (chargePaymentStatus) và "còn cần nộp"
// hiển thị của TỪNG charge riêng lẻ. totalAmount vẫn giữ nguyên để hiển thị dòng "Tổng
// phải nộp" gồm cả nợ cũ trên hóa đơn — chỉ không dùng nó để tính đã-thu-đủ-chưa.
export function chargeOwnDueAmount(charge: { tuitionAmount: number; materialsAmount: number }): number {
  return charge.tuitionAmount + charge.materialsAmount;
}

export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID";

// FR-0099 (Tình trạng đóng học phí), áp dụng trên số tiền đã phân bổ thực tế cho
// từng Charge thay vì "Cong don" cộng dồn thủ công theo thứ tự dòng.
export function chargePaymentStatus(totalAmount: number, paidAmount: number): PaymentStatus {
  if (paidAmount <= 0) return "UNPAID";
  if (paidAmount < totalAmount) return "PARTIAL";
  if (paidAmount === totalAmount) return "PAID";
  return "OVERPAID";
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: "Chưa thu",
  PARTIAL: "Đã thu một phần",
  PAID: "Đã thu hết",
  OVERPAID: "Thu dư",
};

export const BILLING_PERIOD_STATUSES = ["DRAFT", "GENERATED", "REVIEWED", "POSTED", "CLOSED", "REOPENED"] as const;
export type BillingPeriodStatus = (typeof BILLING_PERIOD_STATUSES)[number];
export const BILLING_PERIOD_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  GENERATED: "Đã sinh học phí",
  REVIEWED: "Đã soát",
  POSTED: "Đã chốt sổ",
  CLOSED: "Đã đóng kỳ",
  REOPENED: "Mở lại",
};

const BILLING_TRANSITIONS: Record<BillingPeriodStatus, BillingPeriodStatus[]> = {
  DRAFT: ["GENERATED"],
  GENERATED: ["REVIEWED", "GENERATED"], // cho phép sinh lại (upsert) khi còn ở GENERATED
  REVIEWED: ["POSTED", "GENERATED"],
  POSTED: ["CLOSED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["GENERATED"],
};

export function canTransitionBillingPeriod(from: string, to: string): boolean {
  return (BILLING_TRANSITIONS[from as BillingPeriodStatus] ?? []).includes(to as BillingPeriodStatus);
}

// Chỉ cho phép sinh/sửa Charge khi kỳ chưa chốt sổ — POSTED/CLOSED phải mở lại
// (REOPENED) mới được sửa tiếp, đúng yêu cầu "Close period" ở Non-functional §11.
export function canEditCharges(periodStatus: string): boolean {
  return periodStatus === "DRAFT" || periodStatus === "GENERATED" || periodStatus === "REVIEWED" || periodStatus === "REOPENED";
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Dùng chung để phát hiện 2 khoảng effectiveFrom/effectiveTo (Scholarship, Adjustment)
// có chồng lấn ngày hay không — effectiveTo=null nghĩa là "vô thời hạn".
export function overlapsWindow(
  effectiveFrom: Date,
  effectiveTo: Date | null,
  windowStart: Date,
  windowEnd: Date | null,
): boolean {
  const startsBeforeWindowEnds = !windowEnd || effectiveFrom <= windowEnd;
  const endsAfterWindowStarts = !effectiveTo || effectiveTo >= windowStart;
  return startsBeforeWindowEnds && endsAfterWindowStarts;
}

export function monthRange(periodName: string): { start: Date; end: Date } {
  const [y, m] = periodName.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end };
}
