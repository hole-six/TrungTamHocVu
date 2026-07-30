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
    HR: "FULL", TEACHER: "NONE", TEACHING_ASSISTANT: "NONE", DIRECTOR: "APPROVE_VIEW", RECEPTIONIST: "NONE",
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

// Predicate riêng cho từng capability theo AccessLevel — tách ra để canX() và
// canXWithOverride() dùng chung, tránh lặp lại mảng điều kiện ở 2 chỗ.
function levelAllowsView(level: AccessLevel): boolean {
  return level !== "NONE";
}
function levelAllowsViewFull(level: AccessLevel): boolean {
  return !["NONE", "VIEW_LIMITED"].includes(level);
}
function levelAllowsCreate(level: AccessLevel): boolean {
  return ["FULL", "CREATE_VIEW"].includes(level);
}
function levelAllowsUpdate(level: AccessLevel): boolean {
  return ["FULL", "UPDATE_VIEW", "APPROVE_VIEW"].includes(level);
}
function levelAllowsDelete(level: AccessLevel): boolean {
  return level === "FULL";
}
function levelAllowsApprove(level: AccessLevel): boolean {
  return ["FULL", "APPROVE_VIEW"].includes(level);
}

export function canView(module: ModuleKey, role: string | null | undefined): boolean {
  return levelAllowsView(levelOf(module, role));
}
export function canViewFull(module: ModuleKey, role: string | null | undefined): boolean {
  return levelAllowsViewFull(levelOf(module, role));
}
export function canCreate(module: ModuleKey, role: string | null | undefined): boolean {
  return levelAllowsCreate(levelOf(module, role));
}
export function canUpdate(module: ModuleKey, role: string | null | undefined): boolean {
  return levelAllowsUpdate(levelOf(module, role));
}
export function canDelete(module: ModuleKey, role: string | null | undefined): boolean {
  return levelAllowsDelete(levelOf(module, role));
}
export function canApprove(module: ModuleKey, role: string | null | undefined): boolean {
  return levelAllowsApprove(levelOf(module, role));
}

// --- Biến thể có tính thêm UserModuleOverride ---------------------------------
// Override CHỈ CỘNG THÊM quyền, không bao giờ bớt: merge theo OR từng capability
// với quyền của role, không so sánh "level nào cao hơn" vì AccessLevel không phải
// thang đo tuyến tính (CREATE_VIEW và UPDATE_VIEW không so sánh được với nhau —
// nếu rank rồi chọn 1 bên có thể vô tình MẤT quyền mà role gốc đang có).
//
// Module đã chuyển sang dùng override ở các API route: tuition, cashbook, hr,
// inventory, assets, reports, students. Các module còn lại (leads, schedule,
// timesheet, branches, usersRoles, auditLog, backup) vẫn chỉ dùng canX(module, role)
// thuần — override cho các module đó chưa có tác dụng ở API, đây là ranh giới cố ý
// của đợt triển khai này, không phải thiếu sót.
export function canViewWithOverride(
  module: ModuleKey,
  role: string | null | undefined,
  overrideLevel: AccessLevel | null | undefined
): boolean {
  return canView(module, role) || (!!overrideLevel && levelAllowsView(overrideLevel));
}
export function canViewFullWithOverride(
  module: ModuleKey,
  role: string | null | undefined,
  overrideLevel: AccessLevel | null | undefined
): boolean {
  return canViewFull(module, role) || (!!overrideLevel && levelAllowsViewFull(overrideLevel));
}
export function canCreateWithOverride(
  module: ModuleKey,
  role: string | null | undefined,
  overrideLevel: AccessLevel | null | undefined
): boolean {
  return canCreate(module, role) || (!!overrideLevel && levelAllowsCreate(overrideLevel));
}
export function canUpdateWithOverride(
  module: ModuleKey,
  role: string | null | undefined,
  overrideLevel: AccessLevel | null | undefined
): boolean {
  return canUpdate(module, role) || (!!overrideLevel && levelAllowsUpdate(overrideLevel));
}
export function canDeleteWithOverride(
  module: ModuleKey,
  role: string | null | undefined,
  overrideLevel: AccessLevel | null | undefined
): boolean {
  return canDelete(module, role) || (!!overrideLevel && levelAllowsDelete(overrideLevel));
}
export function canApproveWithOverride(
  module: ModuleKey,
  role: string | null | undefined,
  overrideLevel: AccessLevel | null | undefined
): boolean {
  return canApprove(module, role) || (!!overrideLevel && levelAllowsApprove(overrideLevel));
}

// Nhãn tiếng Việt cho từng module — dùng ở UI cấp quyền bổ sung (admin/users/[id]).
export const MODULE_LABEL: Record<ModuleKey, string> = {
  branches: "Chi nhánh",
  usersRoles: "Người dùng & phân quyền",
  schedule: "Lịch học",
  timesheet: "Chấm công",
  leads: "CRM tuyển sinh",
  students: "Học viên",
  tuition: "Học phí",
  cashbook: "Thu chi",
  hr: "Nhân sự & Lương",
  reports: "Báo cáo",
  auditLog: "Nhật ký hệ thống",
  backup: "Sao lưu",
  inventory: "Kho giáo trình",
  assets: "Tài sản & Trang thiết bị",
};

export const ACCESS_LEVEL_LABEL: Record<AccessLevel, string> = {
  NONE: "Không có quyền",
  VIEW_LIMITED: "Xem (giới hạn)",
  VIEW: "Chỉ xem",
  CREATE_VIEW: "Xem + tạo mới",
  UPDATE_VIEW: "Xem + sửa",
  APPROVE_VIEW: "Xem + duyệt",
  FULL: "Toàn quyền",
};

// Module đã wire override ở API (giữ đồng bộ với comment phía trên) — dùng để UI
// cảnh báo khi Giám đốc set override cho module CHƯA có tác dụng thật.
export const OVERRIDE_AWARE_MODULES: ModuleKey[] = ["tuition", "cashbook", "hr", "inventory", "assets", "reports", "students"];
