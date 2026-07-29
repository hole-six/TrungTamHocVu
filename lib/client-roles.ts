// Helper dùng chung ở các Client Component (bảng danh sách, form...) để quyết định
// hiện/ẩn hành động theo vai trò — tập trung MỘT chỗ thay vì so sánh chuỗi rải rác
// khắp nơi. Lý do: seed roles từng đổi 2 lần trong dự án này, mỗi lần so sánh chuỗi
// hardcode ở một component riêng lẻ lại lệch theo danh sách role thật trong DB, gây
// ẩn nhầm nút bấm cho đúng người có quyền. Khi role thay đổi chỉ cần sửa ở đây.
//
// Về lâu dài nên chuyển hẳn sang kiểm tra permission key (resource.action.scope) như
// tầng API đã làm, thay vì so vai trò — nhưng cần chuẩn hóa lại 1 bộ permission key
// duy nhất trước (hiện đang có 2 taxonomy permission song song trong DB).

export const MANAGEMENT_ROLES = ["SUPER_ADMIN", "BOARD", "DIRECTOR", "BRANCH_MANAGER"] as const;
export const TEACHING_STAFF_ROLES = ["TEACHER", "TEACHING_ASSISTANT"] as const;
// Kế toán/thu ngân + quản lý — thao tác tài chính (xuất/nhập kho có giá trị, chốt kỳ học phí...)
export const FINANCE_ROLES = [...MANAGEMENT_ROLES, "ACCOUNTANT"] as const;
// Nhân sự trực tiếp làm việc với phụ huynh/học viên tiềm năng + quản lý
export const FRONT_DESK_ROLES = [...MANAGEMENT_ROLES, "RECEPTIONIST", "ADMISSIONS", "REGISTRAR"] as const;

export function isManagementRole(role: string | null | undefined): boolean {
  return !!role && (MANAGEMENT_ROLES as readonly string[]).includes(role);
}

export function isTeachingStaffRole(role: string | null | undefined): boolean {
  return !!role && (TEACHING_STAFF_ROLES as readonly string[]).includes(role);
}

export function isFinanceRole(role: string | null | undefined): boolean {
  return !!role && (FINANCE_ROLES as readonly string[]).includes(role);
}

export function isFrontDeskRole(role: string | null | undefined): boolean {
  return !!role && (FRONT_DESK_ROLES as readonly string[]).includes(role);
}

// Dùng cho các trang chỉ có 1 mức "được sửa hay không" (không phân biệt sâu theo
// permission) — mọi vai trò trừ giáo viên/trợ giảng được sửa hồ sơ vận hành.
export function canEditOperationalRecords(role: string | null | undefined): boolean {
  return !isTeachingStaffRole(role);
}
