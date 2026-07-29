// Quy tắc nghiệp vụ CRM tuyển sinh — chuyển hóa trực tiếp từ Formula Catalog
// (DSTest/T_DSTest, xem docs/00_Master_Specification_V2.md §5 FR-0029..FR-0038).
// Đây là gợi ý tự động hóa, KHÔNG phải quyết định cứng — nhân sự vẫn có quyền
// chọn khác (đúng tinh thần "không tự ý biến suy luận thành sự thật" của spec).

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTING",
  "APPOINTED",
  "TESTED",
  "QUALIFIED",
  "UNQUALIFIED",
  "ENROLLED",
  "LOST",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "Mới",
  CONTACTING: "Đang liên hệ",
  APPOINTED: "Đã hẹn lịch",
  TESTED: "Đã test",
  QUALIFIED: "Đạt, chờ xếp lớp",
  UNQUALIFIED: "Chưa đạt",
  ENROLLED: "Đã ghi danh",
  LOST: "Đã mất lead",
};

// State machine theo Master Spec §9. LOST/UNQUALIFIED có thể mở lại về CONTACTING
// vì thực tế phụ huynh hay quay lại liên hệ sau — không nên khóa cứng thành trạng
// thái chết như trong Excel (nơi mọi thứ chỉ là text tự gõ).
const TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ["CONTACTING", "LOST"],
  CONTACTING: ["APPOINTED", "LOST"],
  APPOINTED: ["TESTED", "LOST"],
  TESTED: ["QUALIFIED", "UNQUALIFIED", "LOST"],
  QUALIFIED: ["ENROLLED", "LOST"],
  UNQUALIFIED: ["CONTACTING", "LOST"],
  ENROLLED: [],
  LOST: ["CONTACTING"],
};

export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from as LeadStatus] ?? []).includes(to as LeadStatus);
}

export function nextStatuses(from: string): LeadStatus[] {
  return TRANSITIONS[from as LeadStatus] ?? [];
}

// FR-0029: tuoi = YEAR(TODAY()) - YEAR(DoB)
export function calculateAge(dob: Date | null): number | null {
  if (!dob) return null;
  return new Date().getFullYear() - new Date(dob).getFullYear();
}

// FR-0030: gợi ý lớp = tuổi - 5 (bậc lớp phổ thông); dưới 5 tuổi -> "Mầm non".
// Chỉ là gợi ý hiển thị, không ghi đè lựa chọn lớp thực tế của nhân sự.
export function suggestGradeLevel(age: number | null): string | null {
  if (age === null) return null;
  const grade = age - 5;
  if (grade > 0) return `Lớp ${grade}`;
  if (grade < 0) return "Mầm non";
  return null;
}

// FR-0031: cần liên hệ ngay nếu (a) chưa test và ngày test trong vòng 1 ngày tới,
// hoặc (b) chưa ghi danh (chưa có studentCode) và ngày dự kiến đi học trong vòng
// 1 ngày tới.
export function needsContactNow(lead: {
  status: string;
  testDate: Date | null;
  expectedStartDate: Date | null;
  studentId: string | null;
}): boolean {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (lead.status === "ENROLLED" || lead.status === "LOST") return false;

  if (!lead.testDate) {
    // chưa test — nếu có hẹn ngày dự kiến đi học sắp tới thì vẫn cần liên hệ
    if (lead.expectedStartDate && lead.expectedStartDate.getTime() - now <= oneDayMs) return true;
    return false;
  }
  if (lead.testDate.getTime() - now <= oneDayMs && lead.testDate.getTime() - now >= -oneDayMs) return true;
  if (!lead.studentId && lead.expectedStartDate && lead.expectedStartDate.getTime() - now <= oneDayMs) return true;
  return false;
}
