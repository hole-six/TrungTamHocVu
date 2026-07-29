// Nhân sự & Lương — nguồn NhanSu/T_NS, ChiTietLopHoc (công GV/TG), Report_Cong_Luong.

// FR-0008: So_Gio = (giờ kết thúc - giờ bắt đầu, dạng "HH:MM") tính theo giờ thập phân
export function computeHoursFromTimeRange(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  return Math.max(0, eh + em / 60 - (sh + sm / 60));
}

// Report_Cong_Luong có cột riêng "Trừ giờ GV/TG" (đi muộn, về sớm...) và "Cộng giờ GV/TG"
// (chuẩn bị thêm...) cộng/trừ vào giờ theo khung ca — áp dụng như nhau cho GV lẫn TG thay vì
// hardcode +0.5h cố định cho TG như bản Excel gốc (giá trị đó chỉ là 1 lần "Cộng giờ TG" cụ thể,
// không phải quy tắc cứng).
export function computeAdjustedHours(baseHours: number, deductedHours: number, addedHours: number): number {
  return Math.max(0, baseHours - (deductedHours || 0) + (addedHours || 0));
}

export const SESSION_ROLE_LABEL: Record<string, string> = {
  TEACHER: "Giáo viên",
  ASSISTANT: "Trợ giảng",
  ASSISTANT2: "Trợ giảng 2",
};

export const PAYROLL_RUN_STATUSES = ["DRAFT", "CALCULATED", "REVIEWED", "APPROVED", "LOCKED", "PAID"] as const;
export type PayrollRunStatus = (typeof PAYROLL_RUN_STATUSES)[number];
export const PAYROLL_RUN_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  CALCULATED: "Đã tính",
  REVIEWED: "Đã soát",
  APPROVED: "Đã duyệt",
  LOCKED: "Đã khóa",
  PAID: "Đã trả lương",
};

const PAYROLL_TRANSITIONS: Record<PayrollRunStatus, PayrollRunStatus[]> = {
  DRAFT: ["CALCULATED"],
  CALCULATED: ["REVIEWED", "CALCULATED"],
  REVIEWED: ["APPROVED", "CALCULATED"],
  APPROVED: ["LOCKED"],
  LOCKED: ["PAID"],
  PAID: [],
};

export function canTransitionPayrollRun(from: string, to: string): boolean {
  return (PAYROLL_TRANSITIONS[from as PayrollRunStatus] ?? []).includes(to as PayrollRunStatus);
}

export function canEditPayroll(status: string): boolean {
  return status === "DRAFT" || status === "CALCULATED" || status === "REVIEWED";
}
