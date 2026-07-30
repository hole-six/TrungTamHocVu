// Ma trận phân quyền theo vai trò — chuyển thẳng từ PDF gốc §6 "Ma Trận Phân Quyền"
// (docs/markdown-preview (3).pdf, trang 20-21) thành dữ liệu có thể tra cứu ở cả UI (ẩn/hiện
// nút, field) lẫn API (double-check cạnh hasPermission()). Dùng CHUNG một nguồn duy nhất thay
// vì rải rác các câu if (role === "...") khắp nơi — khi cần sửa quyền chỉ sửa ở đây.
//
// Level nghĩa là mức truy cập với TỪNG MODULE (không phải quyền tuyệt đối):
//   FULL         — xem/thêm/sửa/xóa/duyệt đầy đủ (trong phạm vi branch nếu có)
//   APPROVE_VIEW — xem + duyệt/hủy (không tự tạo mới), vd Quản lý cơ sở duyệt học phí/thu chi
//   UPDATE_VIEW  — xem + sửa được record đã có, KHÔNG tạo mới / xóa, vd Giáo vụ sửa lead có sẵn
//   CREATE_VIEW  — xem + tạo mới, KHÔNG sửa/xóa, vd Giáo vụ chấm công (chỉ tạo bản ghi công)
//   VIEW         — chỉ xem
//   VIEW_LIMITED — xem nhưng field/scope bị giới hạn (vd Kế toán chỉ xem công nợ của học viên,
//                  không xem hồ sơ đầy đủ) — UI cần tự lược field theo case này, level chỉ đánh
//                  dấu "có xem nhưng hẹp hơn VIEW thường"
//   NONE         — không có quyền, module/mục đó nên ẩn hẳn khỏi UI của vai trò này

export type AccessLevel = "FULL" | "APPROVE_VIEW" | "UPDATE_VIEW" | "CREATE_VIEW" | "VIEW" | "VIEW_LIMITED" | "NONE";

export type ModuleKey =
  | "branches" // Quản lý cơ sở
  | "usersRoles" // Quản lý người dùng/phân quyền
  | "schedule" // Lịch học (lớp/buổi)
  | "timesheet" // Chấm công
  | "leads" // Danh sách test (CRM tuyển sinh)
  | "students" // Hồ sơ học sinh
  | "tuition" // Học phí/công nợ
  | "cashbook" // Thu chi
  | "hr" // Nhân sự (bao gồm lương)
  | "reports" // Báo cáo
  | "auditLog" // Audit log
  | "backup" // Backup
  // 2 module không có dòng riêng trong ma trận PDF (chỉ 12 dòng gốc) — suy ra hợp lý theo
  // nav routing đã seed (lib/permissions.ts ROLE_ROUTES) và bộ quyền book.*/stock.*/asset.*.
  | "inventory" // Kho giáo trình
  | "assets"; // Tài sản & Trang thiết bị

export type RoleCode =
  | "SUPER_ADMIN"
  | "BOARD"
  | "BRANCH_MANAGER"
  | "REGISTRAR"
  | "ADMISSIONS"
  | "ACCOUNTANT"
  | "HR"
  | "TEACHER"
  | "TEACHING_ASSISTANT"
  // 2 role không thuộc PDF gốc nhưng đang tồn tại thật trong hệ thống (xem memory
  // project_tach_overview) — xếp tương đương vai trò PDF gần nhất để không bị NONE oan.
  | "DIRECTOR" // ~ BOARD/SUPER_ADMIN (toàn quyền xem, được thao tác như Quản lý cơ sở trở lên)
  | "RECEPTIONIST"; // ~ ADMISSIONS + REGISTRAR gộp (CRM + hồ sơ học viên cơ bản)

// Nguồn: PDF §6, trang 20-21 (6 role đầu). HR/TEACHER/TEACHING_ASSISTANT không có cột riêng
// trong bảng đó — suy ra tối thiểu, nhất quán với permission đã seed (xem seed roles).
// DIRECTOR/RECEPTIONIST suy từ vai trò PDF gần nhất tương ứng.
export const ROLE_MATRIX: Record<ModuleKey, Record<RoleCode, AccessLevel>> = {
  branches: {
    SUPER_ADMIN: "FULL", BOARD: "VIEW", BRANCH_MANAGER: "VIEW_LIMITED", REGISTRAR: "NONE", ADMISSIONS: "NONE", ACCOUNTANT: "NONE",
    HR: "NONE", TEACHER: "NONE", TEACHING_ASSISTANT: "NONE", DIRECTOR: "FULL", RECEPTIONIST: "NONE",
  },
  usersRoles: {
    SUPER_ADMIN: "FULL", BOARD: "VIEW", BRANCH_MANAGER: "VIEW_LIMITED", REGISTRAR: "NONE", ADMISSIONS: "NONE", ACCOUNTANT: "NONE",
    HR: "VIEW", TEACHER: "NONE", TEACHING_ASSISTANT: "NONE", DIRECTOR: "FULL", RECEPTIONIST: "NONE",
  },
  schedule: {
    SUPER_ADMIN: "FULL", BOARD: "VIEW", BRANCH_MANAGER: "FULL", REGISTRAR: "FULL", ADMISSIONS: "VIEW", ACCOUNTANT: "VIEW",
    HR: "VIEW", TEACHER: "VIEW_LIMITED", TEACHING_ASSISTANT: "VIEW_LIMITED", DIRECTOR: "FULL", RECEPTIONIST: "VIEW",
  },
  timesheet: {
    SUPER_ADMIN: "FULL", BOARD: "VIEW", BRANCH_MANAGER: "APPROVE_VIEW", REGISTRAR: "CREATE_VIEW", ADMISSIONS: "NONE", ACCOUNTANT: "VIEW",
    HR: "FULL", TEACHER: "CREATE_VIEW", TEACHING_ASSISTANT: "CREATE_VIEW", DIRECTOR: "APPROVE_VIEW", RECEPTIONIST: "NONE",
  },
  leads: {
    SUPER_ADMIN: "FULL", BOARD: "VIEW", BRANCH_MANAGER: "FULL", REGISTRAR: "UPDATE_VIEW", ADMISSIONS: "FULL", ACCOUNTANT: "VIEW",
    HR: "NONE", TEACHER: "NONE", TEACHING_ASSISTANT: "NONE", DIRECTOR: "FULL", RECEPTIONIST: "FULL",
  },
  students: {
    SUPER_ADMIN: "FULL", BOARD: "VIEW", BRANCH_MANAGER: "FULL", REGISTRAR: "FULL", ADMISSIONS: "UPDATE_VIEW", ACCOUNTANT: "VIEW_LIMITED",
    HR: "NONE", TEACHER: "VIEW_LIMITED", TEACHING_ASSISTANT: "VIEW_LIMITED", DIRECTOR: "FULL", RECEPTIONIST: "FULL",
  },
  tuition: {
    SUPER_ADMIN: "FULL", BOARD: "VIEW", BRANCH_MANAGER: "APPROVE_VIEW", REGISTRAR: "VIEW", ADMISSIONS: "VIEW_LIMITED", ACCOUNTANT: "FULL",
    HR: "NONE", TEACHER: "NONE", TEACHING_ASSISTANT: "NONE", DIRECTOR: "APPROVE_VIEW", RECEPTIONIST: "VIEW_LIMITED",
  },
  cashbook: {
    SUPER_ADMIN: "FULL", BOARD: "VIEW", BRANCH_MANAGER: "APPROVE_VIEW", REGISTRAR: "NONE", ADMISSIONS: "NONE", ACCOUNTANT: "FULL",
    HR: "NONE", TEACHER: "NONE", TEACHING_ASSISTANT: "NONE", DIRECTOR: "APPROVE_VIEW", RECEPTIONIST: "NONE",
  },
  // Nhân sự = hồ sơ NV + xử lý bảng lương gộp chung (PDF không tách riêng dòng "Lương").
  // BRANCH_MANAGER/ACCOUNTANT được APPROVE_VIEW (không phải VIEW_LIMITED thuần) vì đã cấp
  // quyền payroll.approve/post/reopen cho 2 role này từ đợt khôi phục permission trước —
  // giữ nhất quán với quyết định đã kiểm chứng đó thay vì đọc lại "View theo cơ sở" theo
  // nghĩa hẹp nhất và làm mất khả năng họ đã có.
  hr: {
    SUPER_ADMIN: "FULL", BOARD: "VIEW", BRANCH_MANAGER: "APPROVE_VIEW", REGISTRAR: "NONE", ADMISSIONS: "NONE", ACCOUNTANT: "APPROVE_VIEW",
    HR: "FULL", TEACHER: "VIEW_LIMITED", TEACHING_ASSISTANT: "VIEW_LIMITED", DIRECTOR: "APPROVE_VIEW", RECEPTIONIST: "NONE",
  },
  reports: {
    SUPER_ADMIN: "FULL", BOARD: "FULL", BRANCH_MANAGER: "VIEW", REGISTRAR: "VIEW_LIMITED", ADMISSIONS: "VIEW_LIMITED", ACCOUNTANT: "VIEW_LIMITED",
    HR: "VIEW_LIMITED", TEACHER: "NONE", TEACHING_ASSISTANT: "NONE", DIRECTOR: "FULL", RECEPTIONIST: "VIEW_LIMITED",
  },
  auditLog: {
    SUPER_ADMIN: "FULL", BOARD: "VIEW", BRANCH_MANAGER: "VIEW_LIMITED", REGISTRAR: "NONE", ADMISSIONS: "NONE", ACCOUNTANT: "NONE",
    HR: "NONE", TEACHER: "NONE", TEACHING_ASSISTANT: "NONE", DIRECTOR: "FULL", RECEPTIONIST: "NONE",
  },
  backup: {
    SUPER_ADMIN: "FULL", BOARD: "NONE", BRANCH_MANAGER: "NONE", REGISTRAR: "NONE", ADMISSIONS: "NONE", ACCOUNTANT: "NONE",
    HR: "NONE", TEACHER: "NONE", TEACHING_ASSISTANT: "NONE", DIRECTOR: "NONE", RECEPTIONIST: "NONE",
  },
  inventory: {
    SUPER_ADMIN: "FULL", BOARD: "VIEW", BRANCH_MANAGER: "FULL", REGISTRAR: "NONE", ADMISSIONS: "NONE", ACCOUNTANT: "FULL",
    HR: "NONE", TEACHER: "NONE", TEACHING_ASSISTANT: "NONE", DIRECTOR: "FULL", RECEPTIONIST: "CREATE_VIEW",
  },
  assets: {
    SUPER_ADMIN: "FULL", BOARD: "VIEW", BRANCH_MANAGER: "FULL", REGISTRAR: "NONE", ADMISSIONS: "NONE", ACCOUNTANT: "FULL",
    HR: "FULL", TEACHER: "NONE", TEACHING_ASSISTANT: "NONE", DIRECTOR: "FULL", RECEPTIONIST: "NONE",
  },
};

function levelOf(module: ModuleKey, role: string | null | undefined): AccessLevel {
  if (!role) return "NONE";
  return ROLE_MATRIX[module][role as RoleCode] ?? "NONE";
}

export function canView(module: ModuleKey, role: string | null | undefined): boolean {
  return levelOf(module, role) !== "NONE";
}
export function canViewFull(module: ModuleKey, role: string | null | undefined): boolean {
  return !["NONE", "VIEW_LIMITED"].includes(levelOf(module, role));
}
export function canCreate(module: ModuleKey, role: string | null | undefined): boolean {
  return ["FULL", "CREATE_VIEW"].includes(levelOf(module, role));
}
export function canUpdate(module: ModuleKey, role: string | null | undefined): boolean {
  return ["FULL", "UPDATE_VIEW", "APPROVE_VIEW"].includes(levelOf(module, role));
}
export function canDelete(module: ModuleKey, role: string | null | undefined): boolean {
  return levelOf(module, role) === "FULL";
}
export function canApprove(module: ModuleKey, role: string | null | undefined): boolean {
  return ["FULL", "APPROVE_VIEW"].includes(levelOf(module, role));
}
