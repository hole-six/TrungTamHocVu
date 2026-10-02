// VAI TRÒ PHÂN CÔNG GV/TG — một nguồn duy nhất cho mọi chỗ ghi phân công buổi học.
//
// Có HAI loại tên vai trò, đừng lẫn:
//   - "Ô" nhân sự mặc định của lớp (ClassDefaultAssignment.role): TEACHER_1, TEACHER_2,
//     ASSISTANT_1... — chỉ để phân biệt giáo viên 1, giáo viên 2 trong form lớp.
//   - Vai trò trên BUỔI HỌC (SessionAssignment.role): chỉ TEACHER | ASSISTANT | ASSISTANT2.
//     Bảng lương, bảng công, đánh giá trợ giảng, thẻ lịch đều lọc đúng 3 giá trị này.
//
// Lỗi cũ: sinh buổi chép nguyên "TEACHER_1" xuống buổi học → giáo viên bị chốt nhầm đơn
// giá trợ giảng (vì so role === "TEACHER") và KHÔNG có dòng lương nào (vì lương lọc đúng
// "TEACHER"). Mọi chỗ ghi phân công phải đi qua toSessionRole/hourlyRateForRole ở đây.
// File không import prisma để dùng được cả ở component phía trình duyệt.

export const SESSION_ROLES = ["TEACHER", "ASSISTANT", "ASSISTANT2"] as const;
export type SessionRole = (typeof SESSION_ROLES)[number];

export function assignmentRoleType(role: string): "TEACHER" | "ASSISTANT" | null {
  const normalized = role.trim().toUpperCase();
  if (normalized === "TEACHER" || /^TEACHER_\d+$/.test(normalized)) return "TEACHER";
  if (normalized === "ASSISTANT" || normalized === "ASSISTANT2" || /^ASSISTANT_\d+$/.test(normalized)) return "ASSISTANT";
  return null;
}

/** Ô nhân sự mặc định của lớp → vai trò ghi trên buổi học. */
export function toSessionRole(role: string): SessionRole | null {
  const normalized = role.trim().toUpperCase();
  if (normalized === "ASSISTANT2") return "ASSISTANT2";
  const type = assignmentRoleType(normalized);
  return type === "TEACHER" ? "TEACHER" : type === "ASSISTANT" ? "ASSISTANT" : null;
}

export function hourlyRateForRole(
  role: string,
  employee: { teachingHourlyRate: number | null; assistantHourlyRate: number | null },
): number {
  return assignmentRoleType(role) === "TEACHER" ? employee.teachingHourlyRate ?? 0 : employee.assistantHourlyRate ?? 0;
}

/** Nhân sự còn được xếp dạy vào ngày này không (đã nghỉ việc thì không). */
export function isEmployeeWorkingOn(
  employee: { workStatus: string | null; resignDate: Date | null },
  date: Date,
): boolean {
  if (employee.resignDate) return date.getTime() <= employee.resignDate.getTime();
  return employee.workStatus !== "RESIGNED";
}

// ---------------------------------------------------------------------------------
// AI ĐƯỢC XẾP VÀO BUỔI HỌC
//
// Ô chọn người ở thời khoá biểu/phân công trước đây đổ ra TOÀN BỘ nhân sự — kế toán, lễ
// tân, Ban Giám Đốc đều hiện ra và xếp nhầm được vào lớp, mà xếp nhầm là vào thẳng bảng
// lương. Chỉ giữ lại người đứng lớp: Giáo viên và Trợ giảng.

const NO_DIACRITICS = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** Vị trí có đứng lớp hay không (bỏ dấu, không phân biệt hoa thường). */
export function isTeachingStaff(position: string | null | undefined): boolean {
  if (!position) return false;
  const normalized = NO_DIACRITICS(position);
  return normalized.includes("giao vien") || normalized.includes("tro giang");
}

/**
 * Lọc danh sách người có thể xếp vào buổi học.
 *
 * Hồ sơ chưa khai vị trí thì lọc ra rỗng — lúc đó TRẢ LẠI NGUYÊN DANH SÁCH thay vì để ô
 * chọn trống trơn không xếp được ai (dữ liệu thiếu không được làm màn hình hỏng).
 */
export function filterTeachingStaff<T extends { position: string | null }>(employees: T[]): T[] {
  const teaching = employees.filter((employee) => isTeachingStaff(employee.position));
  return teaching.length > 0 ? teaching : employees;
}
