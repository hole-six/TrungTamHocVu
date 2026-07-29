// Thu chi — nguồn Thu-Chi (T_Thu, T_Chi, T_PhanLoai). Đơn giản hơn Học phí vì đây
// là sổ quỹ độc lập (không có công nợ/phân bổ theo học viên).

export const CASH_TXN_TYPES = ["THU", "CHI"] as const;
export const CASH_TXN_TYPE_LABEL: Record<string, string> = { THU: "Thu", CHI: "Chi" };

export const CASH_TXN_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  CONFIRMED: "Đã xác nhận",
  VOIDED: "Đã hủy",
};
