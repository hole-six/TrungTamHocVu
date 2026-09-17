// Quy tắc nghiệp vụ CRM tuyển sinh — đơn giản hóa chỉ theo dõi lead ĐANG xử lý.
// Lead đã ghi danh (ENROLLED) tự động ẩn khỏi CRM, chuyển sang module Học viên.

// 4 nhóm theo cách gọi của trung tâm (chốt 9/2026):
//   Chưa test → Đã test → Đã nhập học, hoặc rẽ sang Không có nhu cầu.
// Tên cột trong CSDL giữ nguyên (CONTACTING/QUALIFIED/...) để không phải chuyển đổi dữ
// liệu cũ; chỉ NHÃN hiển thị đổi. Mỗi nhóm có thêm trạng thái chi tiết ở LEAD_SUB_STATUS.
export const LEAD_STATUSES = [
  "CONTACTING",      // Chưa test (đã hẹn chưa test / chưa liên hệ được)
  "QUALIFIED",       // Đã test (trùng lịch / đợi lớp mới / đã xếp lớp)
  "ENROLLED",        // Đã nhập học → tự động ẩn khỏi CRM
  "LOST",           // Không có nhu cầu
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  CONTACTING: "Chưa test",
  QUALIFIED: "Đã test",
  ENROLLED: "Đã nhập học",
  LOST: "Không có nhu cầu",
};

// ENROLLED không có trong filter groups vì tự động ẩn khỏi CRM (có chip riêng để xem lại nếu cần).
export const LEAD_STATUS_FILTER_GROUPS = [
  { key: "CONTACTING", label: "Chưa test", statuses: ["CONTACTING"] },
  { key: "QUALIFIED", label: "Đã test", statuses: ["QUALIFIED"] },
  { key: "LOST", label: "Không có nhu cầu", statuses: ["LOST"] },
] as const satisfies { key: string; label: string; statuses: LeadStatus[] }[];

// TRẠNG THÁI CHI TIẾT trong từng nhóm (cột leads.sub_status). Chỉ 2 nhóm đang xử lý mới
// có chi tiết; đã nhập học / không có nhu cầu là điểm cuối nên để trống.
export const LEAD_SUB_STATUS = [
  { value: "APPOINTED", label: "Đã hẹn, chưa test", group: "CONTACTING" },
  { value: "UNREACHABLE", label: "Chưa liên hệ được", group: "CONTACTING" },
  { value: "SCHEDULE_CONFLICT", label: "Trùng lịch", group: "QUALIFIED" },
  { value: "WAITING_CLASS", label: "Đợi lớp mới", group: "QUALIFIED" },
  { value: "CLASS_ASSIGNED", label: "Đã xếp lớp", group: "QUALIFIED" },
] as const satisfies { value: string; label: string; group: LeadStatus }[];

export type LeadSubStatus = (typeof LEAD_SUB_STATUS)[number]["value"];

export const LEAD_SUB_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  LEAD_SUB_STATUS.map((item) => [item.value, item.label]),
);

export function leadSubStatusesOf(status: string) {
  return LEAD_SUB_STATUS.filter((item) => item.group === status);
}

/** Trạng thái chi tiết mặc định khi lead vừa rơi vào một nhóm mà chưa ai chọn tay. */
export function defaultSubStatusFor(status: string, hint?: { hasScheduledTest?: boolean; hasClass?: boolean }): LeadSubStatus | null {
  if (status === "CONTACTING") return hint?.hasScheduledTest ? "APPOINTED" : "UNREACHABLE";
  if (status === "QUALIFIED") return hint?.hasClass ? "CLASS_ASSIGNED" : "WAITING_CLASS";
  return null;
}

/** Chỉ giữ trạng thái chi tiết hợp lệ với nhóm — tránh lưu "đã xếp lớp" cho lead chưa test. */
export function normalizeSubStatus(status: string, raw: unknown): LeadSubStatus | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  const found = LEAD_SUB_STATUS.find((item) => item.value === value && item.group === status);
  return found ? found.value : null;
}

export function leadStatusGroupKey(status: string): string {
  return LEAD_STATUS_FILTER_GROUPS.find((group) => (group.statuses as readonly string[]).includes(status))?.key ?? status;
}

// State machine đơn giản: CONTACTING → QUALIFIED → ENROLLED (happy path)
// hoặc CONTACTING → LOST (không có nhu cầu).
// LOST có thể quay lại CONTACTING nếu phụ huynh quay lại liên hệ sau.
// ENROLLED không thể đổi sang status khác (đã tạo Student thật rồi).
const TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  CONTACTING: ["QUALIFIED", "LOST"],
  QUALIFIED: ["ENROLLED", "CONTACTING", "LOST"],  // Cho phép quay lại CONTACTING nếu cần tư vấn thêm
  ENROLLED: [],  // Không thể đổi sau khi đã ghi danh
  LOST: ["CONTACTING"],  // Cho phép mở lại nếu khách quay lại
};

export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from as LeadStatus] ?? []).includes(to as LeadStatus);
}

// Nhân sự cần đổi trạng thái vượt bước (VD: NEW -> QUALIFIED thẳng) khi thực tế đã
// biết trước kết quả, không phải đi tuần tự từng bước như TRANSITIONS gợi ý — đúng
// tinh thần "gợi ý tự động hóa, không phải quyết định cứng" ở đầu file. Chỉ khóa
// đúng 1 chỗ bắt buộc: ENROLLED phải đi qua POST /api/leads/[id]/convert (nơi thực
// sự tạo Student), và một khi đã ENROLLED (đã có Student thật) thì không đổi lung
// tung ra khỏi đó qua PATCH thường được nữa.
export function canManuallySetStatus(from: string, to: string): boolean {
  if (from === "ENROLLED") return false;
  if (to === "ENROLLED") return false;
  return true;
}

// Lọc qua canManuallySetStatus để UI KHÔNG BAO GIỜ hiện nút chuyển trạng thái mà
// API chắc chắn từ chối — trước đây nextStatuses() trả thẳng TRANSITIONS[from],
// nên QUALIFIED -> ENROLLED vẫn hiện thành nút bấm được dù canManuallySetStatus
// luôn chặn ENROLLED qua đường PATCH thường (gây lỗi 409 dù đã điền đủ thông tin).
export function nextStatuses(from: string): LeadStatus[] {
  return (TRANSITIONS[from as LeadStatus] ?? []).filter((to) => canManuallySetStatus(from, to));
}

// Chuẩn hóa "số buổi bổ trợ dự kiến" nhập ở form lead (vd đánh giá "mất gốc") — chặn
// số âm/NaN, và chặn trần hợp lý (60 buổi, tương đương nhiều tháng học) để lỗi nhập
// liệu không vô tình cấp hàng trăm buổi bổ trợ miễn phí khi ghi danh.
export function normalizePendingRemedialSessions(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const num = Math.floor(Number(raw));
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.min(60, num);
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

export const PLACEMENT_TEST_STATUSES = ["SCHEDULED", "PASSED", "FAILED", "NO_NEED", "CANCELLED"] as const;
export type PlacementTestStatus = (typeof PLACEMENT_TEST_STATUSES)[number];
export const PLACEMENT_TEST_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Đã hẹn, chưa test",
  PASSED: "Đạt",
  FAILED: "Không đạt",
  NO_NEED: "Không có nhu cầu",
  CANCELLED: "Đã hủy hẹn",
};

// Màu badge trạng thái test — Đạt xanh lá, Không đạt/Chưa hẹn đỏ (cần hành động),
// Đã hẹn vàng (đang chờ), Không có nhu cầu/Đã hủy xám (đã đóng, không cần chú ý).
export const PLACEMENT_TEST_BADGE_CLASS: Record<string, string> = {
  SCHEDULED: "bg-amber-100 text-amber-700",
  PASSED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  NO_NEED: "bg-ink/5 text-ink-muted48",
  CANCELLED: "bg-ink/5 text-ink-muted48 line-through",
  NONE: "bg-red-100 text-red-700",
};

// BÁO ĐỘNG theo mốc ngày — dùng chung cho NGÀY HẸN TEST và NGÀY NHẬP HỌC DỰ KIẾN
// (2 mốc trung tâm phải gọi điện nhắc). Ba mức đúng như vận hành cần đọc mỗi sáng:
// quá hạn (đỏ), hôm nay (cam đậm), ngày mai (vàng). Ngày gặp KHÔNG dùng thang này —
// gặp rồi thì không còn gì để nhắc.
export type DateUrgency = "overdue" | "today" | "tomorrow" | "none";

export const DATE_URGENCY_LABEL: Record<Exclude<DateUrgency, "none">, string> = {
  overdue: "Quá hạn",
  today: "Hôm nay",
  tomorrow: "Ngày mai",
};

export function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** Mốc [đầu ngày, cuối ngày] của hôm nay / ngày mai — để dựng điều kiện lọc ở CSDL. */
export function dayBounds(offsetDays: number): { start: Date; end: Date } {
  const start = startOfToday();
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function dateUrgency(date: Date | string | null | undefined): DateUrgency {
  if (!date) return "none";
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - startOfToday().getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  return "none";
}

export const DATE_URGENCY_CLASS: Record<DateUrgency, string> = {
  overdue: "bg-red-100 text-red-700 border-red-200",
  today: "bg-orange-100 text-orange-700 border-orange-200",
  tomorrow: "bg-amber-100 text-amber-700 border-amber-200",
  none: "",
};
