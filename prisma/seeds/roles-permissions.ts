import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Định nghĩa 5 roles chính
const ROLES = [
  {
    code: "DIRECTOR",
    name: "Giám đốc",
    description: "Toàn quyền hệ thống, quản lý đa cơ sở",
    isSystem: true,
  },
  {
    code: "ACCOUNTANT",
    name: "Kế toán",
    description: "Quản lý tài chính, học phí, lương, thu chi",
    isSystem: true,
  },
  {
    code: "RECEPTIONIST",
    name: "Lễ tân",
    description: "Tiếp khách, tuyển sinh, ghi danh học viên",
    isSystem: true,
  },
  {
    code: "TEACHER",
    name: "Giáo viên",
    description: "Xem lịch dạy, điểm danh học viên của lớp mình",
    isSystem: true,
  },
  {
    code: "BRANCH_MANAGER",
    name: "Quản lý cơ sở",
    description: "Quản lý toàn bộ cơ sở (không xem cơ sở khác)",
    isSystem: true,
  },
  {
    code: "SUPER_ADMIN",
    name: "Super Admin",
    description: "Toàn quyền hệ thống, bỏ qua mọi kiểm tra permission",
    isSystem: true,
  },
  {
    code: "BOARD",
    name: "Ban Giám Đốc",
    description: "Xem tổng hợp toàn hệ thống, không thao tác nghiệp vụ hàng ngày",
    isSystem: true,
  },
  {
    code: "REGISTRAR",
    name: "Giáo vụ",
    description: "Vận hành lớp học, học viên, chấm công — không đụng tài chính/lương",
    isSystem: true,
  },
  {
    code: "ADMISSIONS",
    name: "Tư vấn tuyển sinh",
    description: "CRM tuyển sinh là chính",
    isSystem: true,
  },
  {
    code: "HR",
    name: "Nhân sự",
    description: "Chấm công, lương, hợp đồng nhân viên",
    isSystem: true,
  },
  {
    code: "TEACHING_ASSISTANT",
    name: "Trợ giảng",
    description: "Xem lịch dạy, điểm danh học viên của lớp mình hỗ trợ",
    isSystem: true,
  },
];

// Định nghĩa permissions
const PERMISSIONS = [
  // Dashboard
  { key: "dashboard.view.all", resource: "dashboard", action: "view", scope: "all", description: "Xem dashboard tất cả cơ sở" },
  { key: "dashboard.view.branch", resource: "dashboard", action: "view", scope: "branch", description: "Xem dashboard cơ sở" },
  { key: "dashboard.view.own", resource: "dashboard", action: "view", scope: "own", description: "Xem dashboard cá nhân" },

  // Student
  { key: "student.view.all", resource: "student", action: "view", scope: "all", description: "Xem học viên tất cả cơ sở" },
  { key: "student.view.branch", resource: "student", action: "view", scope: "branch", description: "Xem học viên cơ sở" },
  { key: "student.view.own", resource: "student", action: "view", scope: "own", description: "Xem học viên lớp mình" },
  { key: "student.create.branch", resource: "student", action: "create", scope: "branch", description: "Tạo học viên" },
  { key: "student.update.branch", resource: "student", action: "update", scope: "branch", description: "Sửa học viên" },
  { key: "student.delete.branch", resource: "student", action: "delete", scope: "branch", description: "Xóa học viên" },

  // Lead (CRM)
  { key: "lead.view.branch", resource: "lead", action: "view", scope: "branch", description: "Xem lead" },
  { key: "lead.create.branch", resource: "lead", action: "create", scope: "branch", description: "Tạo lead" },
  { key: "lead.update.branch", resource: "lead", action: "update", scope: "branch", description: "Sửa lead" },
  { key: "lead.delete.branch", resource: "lead", action: "delete", scope: "branch", description: "Xóa lead" },

  // Guardian
  { key: "guardian.view.branch", resource: "guardian", action: "view", scope: "branch", description: "Xem phụ huynh" },
  { key: "guardian.create.branch", resource: "guardian", action: "create", scope: "branch", description: "Tạo phụ huynh" },
  { key: "guardian.update.branch", resource: "guardian", action: "update", scope: "branch", description: "Sửa phụ huynh" },

  // Class
  { key: "class.view.all", resource: "class", action: "view", scope: "all", description: "Xem lớp tất cả cơ sở" },
  { key: "class.view.branch", resource: "class", action: "view", scope: "branch", description: "Xem lớp cơ sở" },
  { key: "class.view.own", resource: "class", action: "view", scope: "own", description: "Xem lớp mình dạy" },
  { key: "class.create.branch", resource: "class", action: "create", scope: "branch", description: "Tạo lớp" },
  { key: "class.update.branch", resource: "class", action: "update", scope: "branch", description: "Sửa lớp" },
  { key: "class.delete.branch", resource: "class", action: "delete", scope: "branch", description: "Xóa lớp" },

  // Attendance
  { key: "attendance.mark.branch", resource: "attendance", action: "mark", scope: "branch", description: "Điểm danh" },
  { key: "attendance.mark.own", resource: "attendance", action: "mark", scope: "own", description: "Điểm danh lớp mình" },

  // Tuition
  { key: "tuition.view.all", resource: "tuition", action: "view", scope: "all", description: "Xem học phí tất cả" },
  { key: "tuition.view.branch", resource: "tuition", action: "view", scope: "branch", description: "Xem học phí cơ sở" },
  { key: "tuition.view_summary.branch", resource: "tuition", action: "view_summary", scope: "branch", description: "Xem tổng quan học phí" },
  { key: "tuition.create_charge.branch", resource: "tuition", action: "create_charge", scope: "branch", description: "Sinh học phí" },
  { key: "tuition.receive_payment.branch", resource: "tuition", action: "receive_payment", scope: "branch", description: "Thu tiền" },
  { key: "tuition.refund.branch", resource: "tuition", action: "refund", scope: "branch", description: "Hoàn tiền" },
  { key: "tuition.view_financial.branch", resource: "tuition", action: "view_financial", scope: "branch", description: "Xem báo cáo tài chính" },

  // Inventory
  { key: "inventory.view.branch", resource: "inventory", action: "view", scope: "branch", description: "Xem kho" },
  { key: "inventory.create.branch", resource: "inventory", action: "create", scope: "branch", description: "Nhập kho" },
  { key: "inventory.issue.branch", resource: "inventory", action: "issue", scope: "branch", description: "Xuất kho" },

  // Cashbook
  { key: "cashbook.view.all", resource: "cashbook", action: "view", scope: "all", description: "Xem thu chi tất cả" },
  { key: "cashbook.view.branch", resource: "cashbook", action: "view", scope: "branch", description: "Xem thu chi cơ sở" },
  { key: "cashbook.create.branch", resource: "cashbook", action: "create", scope: "branch", description: "Tạo phiếu thu chi" },
  { key: "cashbook.approve.branch", resource: "cashbook", action: "approve", scope: "branch", description: "Duyệt phiếu thu chi" },

  // Payroll
  { key: "payroll.view.all", resource: "payroll", action: "view", scope: "all", description: "Xem lương tất cả" },
  { key: "payroll.view.branch", resource: "payroll", action: "view", scope: "branch", description: "Xem lương cơ sở" },
  { key: "payroll.view.own", resource: "payroll", action: "view", scope: "own", description: "Xem lương bản thân" },
  { key: "payroll.create.branch", resource: "payroll", action: "create", scope: "branch", description: "Tạo bảng lương" },
  { key: "payroll.approve.branch", resource: "payroll", action: "approve", scope: "branch", description: "Duyệt lương" },
  { key: "payroll.view_sensitive.branch", resource: "payroll", action: "view_sensitive", scope: "branch", description: "Xem thông tin nhạy cảm" },

  // Reports
  { key: "report.view.all", resource: "report", action: "view", scope: "all", description: "Xem báo cáo tất cả" },
  { key: "report.view.branch", resource: "report", action: "view", scope: "branch", description: "Xem báo cáo cơ sở" },
  { key: "report.view_financial.branch", resource: "report", action: "view_financial", scope: "branch", description: "Xem báo cáo tài chính" },
  { key: "report.export.branch", resource: "report", action: "export", scope: "branch", description: "Xuất báo cáo" },

  // Admin
  { key: "admin.manage_branch.all", resource: "admin", action: "manage_branch", scope: "all", description: "Quản lý tất cả cơ sở" },
  { key: "admin.manage_branch.own", resource: "admin", action: "manage_branch", scope: "own", description: "Quản lý cơ sở của mình" },
  { key: "admin.manage_users.all", resource: "admin", action: "manage_users", scope: "all", description: "Quản lý tất cả users" },
  { key: "admin.manage_users.branch", resource: "admin", action: "manage_users", scope: "branch", description: "Quản lý users cơ sở" },
  { key: "admin.manage_roles.all", resource: "admin", action: "manage_roles", scope: "all", description: "Quản lý roles" },
  { key: "admin.view_audit.all", resource: "admin", action: "view_audit", scope: "all", description: "Xem audit log tất cả" },
  { key: "admin.view_audit.branch", resource: "admin", action: "view_audit", scope: "branch", description: "Xem audit log cơ sở" },
];

// Gán permissions cho từng role
const ROLE_PERMISSIONS: Record<string, string[]> = {
  DIRECTOR: [
    // Toàn quyền - tất cả permissions với scope "all"
    "dashboard.view.all",
    "student.view.all",
    "class.view.all",
    "tuition.view.all",
    "cashbook.view.all",
    "payroll.view.all",
    "report.view.all",
    "admin.manage_branch.all",
    "admin.manage_users.all",
    "admin.manage_roles.all",
    "admin.view_audit.all",
    // Plus all branch-level permissions
    "student.create.branch",
    "student.update.branch",
    "student.delete.branch",
    "lead.view.branch",
    "lead.create.branch",
    "lead.update.branch",
    "lead.delete.branch",
    "guardian.view.branch",
    "guardian.create.branch",
    "guardian.update.branch",
    "class.create.branch",
    "class.update.branch",
    "class.delete.branch",
    "attendance.mark.branch",
    "tuition.create_charge.branch",
    "tuition.receive_payment.branch",
    "tuition.refund.branch",
    "tuition.view_financial.branch",
    "inventory.view.branch",
    "inventory.create.branch",
    "inventory.issue.branch",
    "cashbook.create.branch",
    "cashbook.approve.branch",
    "payroll.create.branch",
    "payroll.approve.branch",
    "payroll.view_sensitive.branch",
    "report.view_financial.branch",
    "report.export.branch",
  ],

  ACCOUNTANT: [
    "dashboard.view.branch",
    "student.view.branch",
    "tuition.view.branch",
    "tuition.create_charge.branch",
    "tuition.receive_payment.branch",
    "tuition.refund.branch",
    "tuition.view_financial.branch",
    "inventory.view.branch",
    "cashbook.view.branch",
    "cashbook.create.branch",
    "cashbook.approve.branch",
    "payroll.view.branch",
    "payroll.create.branch",
    "payroll.approve.branch",
    "payroll.view_sensitive.branch",
    "report.view.branch",
    "report.view_financial.branch",
    "report.export.branch",
  ],

  RECEPTIONIST: [
    "dashboard.view.branch",
    "lead.view.branch",
    "lead.create.branch",
    "lead.update.branch",
    "student.view.branch",
    "student.create.branch",
    "student.update.branch",
    "guardian.view.branch",
    "guardian.create.branch",
    "guardian.update.branch",
    "class.view.branch",
    "attendance.mark.branch",
    "tuition.view_summary.branch",
    "tuition.receive_payment.branch",
    "inventory.view.branch",
    "inventory.issue.branch",
  ],

  TEACHER: [
    "dashboard.view.own",
    "student.view.own",
    "class.view.own",
    "attendance.mark.own",
    "payroll.view.own",
  ],

  BRANCH_MANAGER: [
    // Toàn quyền cơ sở
    "dashboard.view.branch",
    "student.view.branch",
    "student.create.branch",
    "student.update.branch",
    "student.delete.branch",
    "lead.view.branch",
    "lead.create.branch",
    "lead.update.branch",
    "lead.delete.branch",
    "guardian.view.branch",
    "guardian.create.branch",
    "guardian.update.branch",
    "class.view.branch",
    "class.create.branch",
    "class.update.branch",
    "class.delete.branch",
    "attendance.mark.branch",
    "tuition.view.branch",
    "tuition.create_charge.branch",
    "tuition.receive_payment.branch",
    "tuition.refund.branch",
    "tuition.view_financial.branch",
    "inventory.view.branch",
    "inventory.create.branch",
    "inventory.issue.branch",
    "cashbook.view.branch",
    "cashbook.create.branch",
    "cashbook.approve.branch",
    "payroll.view.branch",
    "payroll.create.branch",
    "payroll.approve.branch",
    "payroll.view_sensitive.branch",
    "report.view.branch",
    "report.view_financial.branch",
    "report.export.branch",
    "admin.manage_branch.own",
    "admin.manage_users.branch",
    "admin.view_audit.branch",
  ],

  // SUPER_ADMIN không cần entry ở đây — role.role="admin" bypass hasPermission()
  // hoàn toàn (xem lib/server/permissions.ts), gán permission cho role này không
  // có tác dụng và dễ gây hiểu nhầm là đã giới hạn được quyền của Super Admin.

  BOARD: [
    // Chủ yếu xem tổng hợp — quyền ghi vẫn theo permission.branch/all cụ thể của role-matrix
    "dashboard.view.all",
    "student.view.all",
    "class.view.all",
    "tuition.view.all",
    "cashbook.view.all",
    "payroll.view.all",
    "report.view.all",
    "report.view_financial.branch",
    "admin.view_audit.all",
  ],

  REGISTRAR: [
    "dashboard.view.branch",
    "lead.update.branch",
    "student.view.branch",
    "student.create.branch",
    "student.update.branch",
    "guardian.view.branch",
    "class.view.branch",
    "class.create.branch",
    "class.update.branch",
    "attendance.mark.branch",
    "report.view.branch",
  ],

  ADMISSIONS: [
    "dashboard.view.branch",
    "lead.view.branch",
    "lead.create.branch",
    "lead.update.branch",
    "lead.delete.branch",
    "guardian.view.branch",
    "guardian.create.branch",
    "guardian.update.branch",
    "class.view.branch",
    "tuition.view_summary.branch",
    "report.view.branch",
  ],

  HR: [
    "dashboard.view.branch",
    "payroll.view.branch",
    "payroll.create.branch",
    "payroll.approve.branch",
    "payroll.view_sensitive.branch",
    "report.view.branch",
    "inventory.view.branch",
  ],

  TEACHING_ASSISTANT: [
    "dashboard.view.own",
    "class.view.own",
    "attendance.mark.own",
    "payroll.view.own",
  ],
};

export async function seedRolesAndPermissions() {
  console.log("🌱 Seeding roles and permissions...");

  // 1. Create or update permissions
  console.log("📝 Creating permissions...");
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: perm,
      create: perm,
    });
  }
  console.log(`✅ Created ${PERMISSIONS.length} permissions`);

  // 2. Create or update roles
  console.log("👥 Creating roles...");
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
      },
      create: role,
    });
  }
  console.log(`✅ Created ${ROLES.length} roles`);

  // 3. Assign permissions to roles
  console.log("🔗 Assigning permissions to roles...");
  for (const [roleCode, permissionKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) continue;

    // Delete existing assignments
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    // Create new assignments
    for (const permKey of permissionKeys) {
      const permission = await prisma.permission.findUnique({
        where: { key: permKey },
      });
      if (!permission) {
        console.warn(`⚠️  Permission not found: ${permKey}`);
        continue;
      }

      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }

    console.log(`  ✓ ${roleCode}: ${permissionKeys.length} permissions`);
  }

  console.log("✨ Roles and permissions seeded successfully!");
}

// Run if called directly
if (require.main === module) {
  seedRolesAndPermissions()
    .catch((e) => {
      console.error("❌ Error seeding:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
