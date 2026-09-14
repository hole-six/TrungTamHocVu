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
