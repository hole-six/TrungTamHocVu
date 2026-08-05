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

// FR-0009: So_gio_GV = giờ thực của buổi CHỈ khi nhân viên trả lương theo Giờ
// (Ca_Gio="Giờ"); ngược lại tính cố định 1 đơn vị/buổi vì đơn giá lúc đó là tiền/ca,
// không phải tiền/giờ — nhân theo giờ thực sẽ trả sai (thiếu/dư) mỗi khi buổi học
// dài/ngắn hơn khung chuẩn. payMode="SESSION" tương ứng Ca_Gio khác "Giờ" trong Excel.
export function computeSessionBaseHours(
  payMode: string | null | undefined,
  startTime: string | null | undefined,
  endTime: string | null | undefined
): number {
  if (payMode === "SESSION") return 1;
  return startTime && endTime ? computeHoursFromTimeRange(startTime, endTime) : 0;
}

// FR-0148: Tình trạng làm việc suy ra từ ngày nghỉ + hạn hợp đồng hiện hành (hợp đồng
// mới nhất theo signDate) — "Nghỉ ngang" ưu tiên cao nhất, sau đó cảnh báo hợp đồng
// sắp/đã hết hạn để nhân sự chủ động gia hạn, đúng tinh thần cảnh báo của bản Excel gốc.
export type EmployeeContractStatus = "Nghỉ ngang" | "Chưa có info" | "Sắp hết hạn HĐ" | "Đã hết hạn HĐ" | "";
const CONTRACT_WARNING_WINDOW_DAYS = 40;

export function computeContractStatus(
  resignDate: Date | null,
  contractExpiryDate: Date | null,
  now: Date = new Date()
): EmployeeContractStatus {
  if (resignDate) return "Nghỉ ngang";
  if (!contractExpiryDate) return "Chưa có info";
  const daysLeft = (contractExpiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  if (daysLeft < 0) return "Đã hết hạn HĐ";
  if (daysLeft < CONTRACT_WARNING_WINDOW_DAYS) return "Sắp hết hạn HĐ";
  return "";
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

// Dung sai so sánh giờ/công thực tế (SessionAssignment/TimesheetEntry) với số đã đóng băng
// trên PayrollLine — dùng chung cho checklist chốt kỳ và cờ "lệch dữ liệu" trên từng dòng.
export function isCloseEnough(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}
