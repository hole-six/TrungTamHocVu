# Thiết kế Phân quyền & Sidebar theo Vai trò

## 📋 Các Vai trò (Roles) Đề xuất

Dựa trên Master Spec và thực tế trung tâm Anh ngữ:

### 1. **ADMIN / Giám đốc** 
- **Mã**: `DIRECTOR`
- **Mô tả**: Toàn quyền hệ thống, quản lý đa cơ sở
- **Scope**: `all` (xem tất cả cơ sở)

### 2. **KẾ TOÁN / Tài chính**
- **Mã**: `ACCOUNTANT`
- **Mô tả**: Quản lý tài chính, học phí, lương, thu chi
- **Scope**: `branch` (chỉ cơ sở được gán)

### 3. **LỄ TÂN / Nhân viên văn phòng**
- **Mã**: `RECEPTIONIST`
- **Mô tả**: Tiếp khách, tuyển sinh, ghi danh, điểm danh
- **Scope**: `branch`

### 4. **GIÁO VIÊN**
- **Mã**: `TEACHER`
- **Mô tả**: Xem lịch dạy, điểm danh học viên của lớp mình
- **Scope**: `own` (chỉ xem lớp/học viên của mình)

### 5. **TRƯỞNG PHÒNG / Quản lý cơ sở**
- **Mã**: `BRANCH_MANAGER`
- **Mô tả**: Quản lý toàn bộ cơ sở (nhưng không xem cơ sở khác)
- **Scope**: `branch`

---

## 🎯 Ma trận Phân quyền Sidebar

| Module | DIRECTOR | ACCOUNTANT | RECEPTIONIST | TEACHER | BRANCH_MANAGER |
|--------|----------|------------|--------------|---------|----------------|
| **Dashboard** | ✅ Tất cả | ✅ Tài chính | ✅ Tổng quan | ✅ Lịch dạy | ✅ Tất cả |
| **CRM Leads** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Học viên** | ✅ | ✅ View | ✅ | ✅ View own | ✅ |
| **Phụ huynh** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Lớp & Lịch** | ✅ | ❌ | ✅ | ✅ View own | ✅ |
| **Lịch tổng** | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Chấm công** | ✅ | ✅ | ❌ | ✅ Own | ✅ |
| **Học phí** | ✅ | ✅ | ✅ View | ❌ | ✅ |
| **Kho giáo trình** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Tài sản** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Thu chi** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Nhân sự & Lương** | ✅ | ✅ | ❌ | ✅ View own | ✅ |
| **Báo cáo** | ✅ All | ✅ Financial | ✅ Basic | ❌ | ✅ All |
| **Quản trị** | ✅ | ❌ | ❌ | ❌ | ✅ Branch only |

---

## 🔧 Cấu trúc Sidebar theo Vai trò

### 🎨 **Nhóm 1: Vận hành** (Operations)

```typescript
{
  label: "Vận hành",
  items: [
    { href: "/dashboard", roles: ["*"] },              // Tất cả
    { href: "/leads", roles: ["DIRECTOR", "RECEPTIONIST", "BRANCH_MANAGER"] },
    { href: "/students", roles: ["*"] },               // Tất cả (scope khác nhau)
    { href: "/guardians", roles: ["DIRECTOR", "RECEPTIONIST", "BRANCH_MANAGER"] },
    { href: "/classes", roles: ["*"] },                // Tất cả
    { href: "/calendar", roles: ["*"] },               // Tất cả
    { href: "/timesheets", roles: ["*"] },             // Tất cả
  ]
}
```

### 💰 **Nhóm 2: Tài chính** (Finance)

```typescript
{
  label: "Tài chính",
  items: [
    { href: "/tuition", roles: ["DIRECTOR", "ACCOUNTANT", "BRANCH_MANAGER", "RECEPTIONIST"] },
    { href: "/inventory", roles: ["DIRECTOR", "ACCOUNTANT", "RECEPTIONIST", "BRANCH_MANAGER"] },
    { href: "/assets", roles: ["DIRECTOR", "ACCOUNTANT", "BRANCH_MANAGER"] },
    { href: "/cashbook", roles: ["DIRECTOR", "ACCOUNTANT", "BRANCH_MANAGER"] },
    { href: "/payroll", roles: ["DIRECTOR", "ACCOUNTANT", "BRANCH_MANAGER", "TEACHER"] },
  ]
}
```

### ⚙️ **Nhóm 3: Hệ thống** (System)

```typescript
{
  label: "Hệ thống",
  items: [
    { href: "/reports", roles: ["*"] },                // Tất cả (nội dung khác nhau)
    { href: "/admin", roles: ["DIRECTOR", "BRANCH_MANAGER"] },
  ]
}
```

---

## 📊 Permissions Chi tiết

### Dashboard
```typescript
"dashboard.view.all"          // DIRECTOR
"dashboard.view.branch"       // ACCOUNTANT, BRANCH_MANAGER
"dashboard.view.own"          // TEACHER (chỉ lịch dạy)
```

### Students
```typescript
"student.view.all"            // DIRECTOR
"student.view.branch"         // ACCOUNTANT, RECEPTIONIST, BRANCH_MANAGER
"student.view.own"            // TEACHER (chỉ học viên lớp mình)
"student.create.branch"       // DIRECTOR, RECEPTIONIST, BRANCH_MANAGER
"student.update.branch"       // DIRECTOR, RECEPTIONIST, BRANCH_MANAGER
"student.delete.branch"       // DIRECTOR, BRANCH_MANAGER
```

### Tuition (Học phí)
```typescript
"tuition.view.all"            // DIRECTOR
"tuition.view.branch"         // ACCOUNTANT, BRANCH_MANAGER
"tuition.view_summary.branch" // RECEPTIONIST (chỉ xem tổng quan)
"tuition.create_charge.branch" // DIRECTOR, ACCOUNTANT, BRANCH_MANAGER
"tuition.receive_payment.branch" // DIRECTOR, ACCOUNTANT, RECEPTIONIST
"tuition.refund.branch"       // DIRECTOR, ACCOUNTANT (cần approve)
"tuition.view_financial.branch" // DIRECTOR, ACCOUNTANT
```

### Payroll (Lương)
```typescript
"payroll.view.all"            // DIRECTOR
"payroll.view.branch"         // ACCOUNTANT, BRANCH_MANAGER
"payroll.view.own"            // TEACHER (chỉ lương bản thân)
"payroll.create.branch"       // DIRECTOR, ACCOUNTANT, BRANCH_MANAGER
"payroll.approve.branch"      // DIRECTOR, BRANCH_MANAGER
"payroll.view_sensitive.branch" // DIRECTOR, ACCOUNTANT
```

### Admin
```typescript
"admin.manage_branch.all"     // DIRECTOR
"admin.manage_branch.own"     // BRANCH_MANAGER (chỉ cơ sở mình)
"admin.manage_users.all"      // DIRECTOR
"admin.manage_users.branch"   // BRANCH_MANAGER
"admin.manage_roles.all"      // DIRECTOR
"admin.view_audit.all"        // DIRECTOR
"admin.view_audit.branch"     // BRANCH_MANAGER
```

---

## 🛠️ Implementation Plan

### Phase 1: Seed Default Roles
```sql
-- Tạo 5 roles mặc định
INSERT INTO roles (code, name, description, isSystem) VALUES
('DIRECTOR', 'Giám đốc', 'Toàn quyền hệ thống', true),
('ACCOUNTANT', 'Kế toán', 'Quản lý tài chính', true),
('RECEPTIONIST', 'Lễ tân', 'Tiếp khách, tuyển sinh', true),
('TEACHER', 'Giáo viên', 'Dạy học, điểm danh', true),
('BRANCH_MANAGER', 'Quản lý cơ sở', 'Quản lý toàn bộ cơ sở', true);
```

### Phase 2: Create Permissions
```typescript
// Script seed permissions với format: resource.action.scope
const permissions = [
  // Dashboard
  { key: "dashboard.view.all", resource: "dashboard", action: "view", scope: "all" },
  { key: "dashboard.view.branch", resource: "dashboard", action: "view", scope: "branch" },
  { key: "dashboard.view.own", resource: "dashboard", action: "view", scope: "own" },
  
  // Student
  { key: "student.view.all", resource: "student", action: "view", scope: "all" },
  { key: "student.view.branch", resource: "student", action: "view", scope: "branch" },
  { key: "student.view.own", resource: "student", action: "view", scope: "own" },
  { key: "student.create.branch", resource: "student", action: "create", scope: "branch" },
  { key: "student.update.branch", resource: "student", action: "update", scope: "branch" },
  { key: "student.delete.branch", resource: "student", action: "delete", scope: "branch" },
  
  // ... (more permissions)
];
```

### Phase 3: Assign Permissions to Roles
```typescript
const rolePermissions = {
  DIRECTOR: [
    "*.*.all",  // Wildcard: tất cả permissions với scope "all"
  ],
  ACCOUNTANT: [
    "dashboard.view.branch",
    "student.view.branch",
    "tuition.*.branch",
    "cashbook.*.branch",
    "payroll.*.branch",
    "inventory.view.branch",
    "reports.view_financial.branch",
  ],
  RECEPTIONIST: [
    "dashboard.view.branch",
    "lead.*.branch",
    "student.*.branch",
    "guardian.*.branch",
    "class.view.branch",
    "tuition.view_summary.branch",
    "tuition.receive_payment.branch",
    "inventory.issue.branch",
  ],
  TEACHER: [
    "dashboard.view.own",
    "student.view.own",
    "class.view.own",
    "attendance.mark.own",
    "calendar.view.own",
    "payroll.view.own",
  ],
  BRANCH_MANAGER: [
    "*.*branch",  // Tất cả actions với scope "branch"
    "admin.manage_branch.own",
    "admin.manage_users.branch",
  ],
};
```

### Phase 4: Update Sidebar Component
```typescript
// components/Sidebar.tsx
function filterNavByRole(userRole: string, userPermissions: string[]) {
  const ROLE_NAV = {
    DIRECTOR: ["*"],  // All
    ACCOUNTANT: ["/dashboard", "/students", "/tuition", "/cashbook", "/payroll", "/inventory", "/reports"],
    RECEPTIONIST: ["/dashboard", "/leads", "/students", "/guardians", "/classes", "/tuition", "/inventory"],
    TEACHER: ["/dashboard", "/students", "/classes", "/calendar", "/payroll"],
    BRANCH_MANAGER: ["*"],  // All
  };
  
  const allowedPaths = ROLE_NAV[userRole] || [];
  
  if (allowedPaths.includes("*")) {
    return NAV_ITEMS;  // Show all
  }
  
  return NAV_ITEMS.filter(item => allowedPaths.includes(item.href));
}
```

---

## ✅ Action Items

1. ✅ **Tạo seed script** cho 5 roles mặc định
2. ✅ **Tạo permissions** theo ma trận trên
3. ✅ **Gán permissions cho roles**
4. ✅ **Cập nhật Sidebar** để filter theo role
5. ✅ **Cập nhật API middleware** check permissions
6. ✅ **Tạo UI quản lý roles/permissions** trong /admin

---

## 📝 Notes

- **Teacher** cần xem được lớp của mình → cần `class.view.own`
- **Receptionist** thu tiền học phí nhưng không xem lương → split permissions
- **Accountant** xem tất cả tài chính nhưng không quản lý users → admin restricted
- **Branch Manager** toàn quyền cơ sở nhưng không xem cơ sở khác → scope = branch
- **Director** có thể switch giữa các cơ sở qua BranchSelector
