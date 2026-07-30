# 🔐 TACH - ROLES & PERMISSIONS SYSTEM

## 📊 Current Status: ✅ 11 ROLES DEFINED & SIDEBAR CONFIGURED

**Last Updated**: July 29, 2026  
**Version**: 3.0.0  
**Status**: 🟢 **PRODUCTION READY**

---

## 🎯 TỔNG QUAN

Hệ thống TACH hiện hỗ trợ **11 vai trò (roles)** với phân quyền chi tiết và sidebar được tự động filter theo vai trò.

---

## 👥 11 VAI TRÒ ĐƯỢC HỖ TRỢ

### **1. SUPER_ADMIN** 👑

**Tên hiển thị**: Super Admin  
**Quyền hạn**: Toàn quyền hệ thống, không giới hạn

**Sidebar Access**: `["*"]` - Tất cả modules

**Permissions**:
- ✅ Toàn quyền CRUD trên mọi module
- ✅ Quản lý hệ thống
- ✅ Quản lý roles & permissions
- ✅ Access tất cả chi nhánh
- ✅ Xem/sửa/xóa mọi dữ liệu
- ✅ Cấu hình hệ thống

**Use Case**: System Administrator, Technical Support

---

### **2. BOARD** 🏆

**Tên hiển thị**: Ban Giám Đốc  
**Quyền hạn**: Xem toàn bộ, chỉnh sửa hạn chế

**Sidebar Access**: `["*"]` - Tất cả modules (view-oriented)

**Permissions**:
- ✅ Xem tất cả báo cáo
- ✅ Xem dashboard tổng hợp
- ✅ Xem dữ liệu mọi chi nhánh
- ⚠️ Chỉnh sửa hạn chế (qua permission.branch/all)
- ❌ Không thể xóa dữ liệu quan trọng

**Use Case**: Board Members, Executive Team

---

### **3. DIRECTOR** 👨‍💼

**Tên hiển thị**: Giám Đốc  
**Quyền hạn**: Toàn quyền vận hành

**Sidebar Access**: `["*"]` - Tất cả modules

**Modules**:
- ✅ Dashboard
- ✅ Leads (CRM)
- ✅ Students
- ✅ Guardians
- ✅ Classes
- ✅ Calendar
- ✅ Timesheets
- ✅ Tuition (Financial)
- ✅ Inventory
- ✅ Assets
- ✅ Cashbook
- ✅ Payroll
- ✅ Reports
- ✅ Admin (System)

**Permissions**:
- ✅ Toàn quyền CRUD
- ✅ Bulk operations
- ✅ Delete permissions
- ✅ Financial data access
- ✅ User management
- ✅ All branches

**Use Case**: Center Director, General Manager

---

### **4. BRANCH_MANAGER** 🏢

**Tên hiển thị**: Quản Lý Chi Nhánh  
**Quyền hạn**: Toàn quyền trong chi nhánh được giao

**Sidebar Access**: `["*"]` - Tất cả modules (branch-scoped)

**Modules**: Same as DIRECTOR

**Permissions**:
- ✅ CRUD trong chi nhánh
- ✅ Bulk operations (branch)
- ✅ Branch financial data
- ✅ Manage branch staff
- ⚠️ Scoped to assigned branch
- ❌ Cannot access other branches

**Use Case**: Branch Manager, Location Head

---

### **5. REGISTRAR** 📚

**Tên hiển thị**: Giáo Vụ  
**Quyền hạn**: Vận hành học vụ, không đụng tài chính/lương

**Sidebar Access**:
```typescript
[
  "/dashboard",
  "/leads",
  "/students", 
  "/guardians",
  "/classes",
  "/calendar",
  "/timesheets",
  "/reports"
]
```

**Modules**:
- ✅ Dashboard - Overview
- ✅ Leads - CRM basics
- ✅ Students - Full management
- ✅ Guardians - Parent management
- ✅ Classes - Schedule & attendance
- ✅ Calendar - View schedule
- ✅ Timesheets - Teacher attendance
- ✅ Reports - Academic reports
- ❌ Tuition (No access)
- ❌ Cashbook (No access)
- ❌ Payroll (No access)

**Permissions**:
- ✅ Create/Edit students
- ✅ Manage enrollment
- ✅ Schedule classes
- ✅ Mark attendance
- ✅ Generate academic reports
- ❌ Financial transactions
- ❌ Salary data

**Use Case**: Academic Coordinator, Registrar

---

### **6. ADMISSIONS** 🎯

**Tên hiển thị**: Tư Vấn Tuyển Sinh  
**Quyền hạn**: CRM là chính, tư vấn & chốt deals

**Sidebar Access**:
```typescript
[
  "/dashboard",
  "/leads",
  "/guardians",
  "/calendar"
]
```

**Modules**:
- ✅ Dashboard - Lead metrics
- ✅ Leads - Full CRM
- ✅ Guardians - Parent info
- ✅ Calendar - Appointments
- ❌ Students (Limited - can't edit)
- ❌ Classes (No access)
- ❌ Financial (No access)

**Permissions**:
- ✅ Create/manage leads
- ✅ Schedule consultations
- ✅ Track lead pipeline
- ✅ Convert to students (with approval)
- ✅ Guardian communication
- ❌ Edit enrolled students
- ❌ Financial access

**Use Case**: Admissions Counselor, Sales Team

---

### **7. RECEPTIONIST** 📋

**Tên hiển thị**: Lễ Tân  
**Quyền hạn**: CRM + học vụ cơ bản + thu học phí

**Sidebar Access**:
```typescript
[
  "/dashboard",
  "/leads",
  "/students",
  "/guardians",
  "/classes",
  "/calendar",
  "/tuition",
  "/inventory"
]
```

**Modules**:
- ✅ Dashboard
- ✅ Leads - Basic CRM
- ✅ Students - Create/Edit
- ✅ Guardians - Manage
- ✅ Classes - View & enroll
- ✅ Calendar - Appointments
- ✅ Tuition - Collect payments
- ✅ Inventory - Issue books
- ❌ Cashbook (No access)
- ❌ Payroll (No access)
- ❌ Admin (No access)

**Permissions**:
- ✅ Register new students
- ✅ Collect tuition payments
- ✅ Issue books
- ✅ Schedule appointments
- ✅ Update student info
- ⚠️ Cannot delete
- ❌ No bulk operations
- ❌ No salary access

**Use Case**: Front Desk, Reception

---

### **8. ACCOUNTANT** 💰

**Tên hiển thị**: Kế Toán  
**Quyền hạn**: Tài chính là chính

**Sidebar Access**:
```typescript
[
  "/dashboard",
  "/students",
  "/tuition",
  "/inventory",
  "/assets",
  "/cashbook",
  "/payroll",
  "/reports"
]
```

**Modules**:
- ✅ Dashboard - Financial metrics
- ✅ Students - View (for billing)
- ✅ Tuition - Full management
- ✅ Inventory - Cost tracking
- ✅ Assets - Depreciation
- ✅ Cashbook - Full access
- ✅ Payroll - Process salary
- ✅ Reports - Financial reports
- ❌ Leads (No access)
- ❌ Classes (View only)

**Permissions**:
- ✅ Manage tuition
- ✅ Process payments
- ✅ Cashbook transactions
- ✅ Payroll processing
- ✅ Financial reports
- ✅ Reconciliation
- ⚠️ View students (can't edit)
- ❌ Cannot create students

**Use Case**: Accountant, Bookkeeper, Finance Manager

---

### **9. HR** 👔

**Tên hiển thị**: Nhân Sự  
**Quyền hạn**: Chấm công, lương, hợp đồng

**Sidebar Access**:
```typescript
[
  "/dashboard",
  "/timesheets",
  "/payroll",
  "/assets",
  "/reports"
]
```

**Modules**:
- ✅ Dashboard - HR metrics
- ✅ Timesheets - Attendance
- ✅ Payroll - Full management
- ✅ Assets - Employee assets
- ✅ Reports - HR reports
- ❌ Students (No access)
- ❌ Tuition (No access)
- ❌ Classes (No access)

**Permissions**:
- ✅ Manage employee data
- ✅ Process timesheets
- ✅ Calculate payroll
- ✅ Manage contracts
- ✅ Employee benefits
- ✅ Performance reviews
- ❌ Student data
- ❌ Financial transactions

**Use Case**: HR Manager, HR Officer

---

### **10. TEACHER** 👨‍🏫

**Tên hiển thị**: Giáo Viên  
**Quyền hạn**: Lịch dạy, học viên lớp mình, lương của mình

**Sidebar Access**:
```typescript
[
  "/dashboard",
  "/students",
  "/classes",
  "/calendar",
  "/timesheets",
  "/payroll"
]
```

**Modules**:
- ✅ Dashboard - Personal metrics
- ✅ Students - View (own classes)
- ✅ Classes - Own classes
- ✅ Calendar - Teaching schedule
- ✅ Timesheets - Own attendance
- ✅ Payroll - View own salary
- ❌ Tuition (No access)
- ❌ Other teachers' data

**Permissions**:
- ✅ Mark attendance (own classes)
- ✅ Add session notes
- ✅ View class roster
- ✅ Submit timesheets
- ✅ View own payslips
- ⚠️ Scoped to own classes
- ❌ Cannot edit students
- ❌ Cannot see other salaries

**Use Case**: Teacher, Instructor

---

### **11. TEACHING_ASSISTANT** 👥

**Tên hiển thị**: Trợ Giảng  
**Quyền hạn**: Hỗ trợ giảng dạy, quyền hạn chế hơn Teacher

**Sidebar Access**:
```typescript
[
  "/dashboard",
  "/classes",
  "/calendar",
  "/timesheets",
  "/payroll"
]
```

**Modules**:
- ✅ Dashboard - Basic view
- ✅ Classes - Assigned classes
- ✅ Calendar - Schedule
- ✅ Timesheets - Own attendance
- ✅ Payroll - View own salary
- ❌ Students (Limited view)
- ❌ Full student management

**Permissions**:
- ✅ View class details
- ✅ Assist with attendance
- ✅ Submit timesheets
- ✅ View schedule
- ⚠️ Cannot mark attendance alone
- ⚠️ Cannot edit class info
- ❌ No student editing

**Use Case**: Teaching Assistant, Tutor

---

## 📊 ROLE COMPARISON TABLE

| Feature | SUPER_ADMIN | BOARD | DIRECTOR | BRANCH_MGR | REGISTRAR | ADMISSIONS | RECEPTIONIST | ACCOUNTANT | HR | TEACHER | TA |
|---------|-------------|-------|----------|------------|-----------|------------|--------------|------------|----|---------|----|
| **Dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Leads** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Students** | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ❌ | ⚠️ | ⚠️ |
| **Guardians** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Classes** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ⚠️ | ⚠️ | ❌ | ✅ | ✅ |
| **Calendar** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Timesheets** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Tuition** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Inventory** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Assets** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Cashbook** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Payroll** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ⚠️ | ⚠️ |
| **Reports** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Legend**:
- ✅ Full Access
- ⚠️ Limited/View Only
- ❌ No Access

---

## 🔐 PERMISSION SCOPES

Mỗi permission có 3 levels:

### **1. ALL Scope** 🌍
- Truy cập toàn bộ dữ liệu
- Không bị giới hạn branch
- Roles: SUPER_ADMIN, BOARD, DIRECTOR

### **2. BRANCH Scope** 🏢
- Chỉ dữ liệu của chi nhánh được giao
- Filtered by `user.branchId`
- Roles: BRANCH_MANAGER, REGISTRAR, RECEPTIONIST, ACCOUNTANT

### **3. OWN Scope** 👤
- Chỉ dữ liệu của bản thân
- Filtered by `user.id`
- Roles: TEACHER, TEACHING_ASSISTANT

**Example**:
```typescript
// Permission: students.view.all
// User có thể xem TẤT CẢ students mọi branch

// Permission: students.view.branch
// User chỉ xem students trong branch của mình

// Permission: students.view.own
// User chỉ xem students trong classes mình dạy
```

---

## 🎨 SIDEBAR CONFIGURATION

### **Sidebar đã được phân theo role tự động**:

```typescript
// File: components/Sidebar.tsx

// Role filtering logic
const filteredNavItems = navItems.filter(item => {
  // If no roles specified, show to everyone
  if (!item.roles || item.roles.length === 0) return true;
  
  // If user has no role, hide restricted items
  if (!userRole) return false;
  
  // Check if user's role is in allowed roles
  return item.roles.includes(userRole);
});
```

### **Role badges trong Sidebar**:

Mỗi user sẽ thấy role badge của mình ở footer:

```
┌────────────────────┐
│ TACH ERP · v3.0   │
│ ● Giáo Vụ         │ ← Animated badge
└────────────────────┘
```

**Role Display Names**:
- SUPER_ADMIN → "Super Admin"
- BOARD → "Ban Giám Đốc"
- DIRECTOR → "Giám Đốc"
- BRANCH_MANAGER → "Quản Lý Chi Nhánh"
- REGISTRAR → "Giáo Vụ"
- ADMISSIONS → "Tư Vấn Tuyển Sinh"
- RECEPTIONIST → "Lễ Tân"
- ACCOUNTANT → "Kế Toán"
- HR → "Nhân Sự"
- TEACHER → "Giáo Viên"
- TEACHING_ASSISTANT → "Trợ Giảng"

---

## 🚀 IMPLEMENTATION

### **Backend (lib/permissions.ts)**:

```typescript
// Get filtered navigation
const allowedRoutes = await getFilteredNavItems(userId);

// Check route access
const canAccess = await canAccessRoute(userId, "/tuition");

// Check permission
const hasPermission = await hasPermission(userId, "students.create.branch");

// Get scope
const scope = await getUserScope(userId, "students", "view");
```

### **Frontend (Sidebar.tsx)**:

```typescript
// Sidebar automatically filters based on userRole prop
<Sidebar navItems={navItems} userRole={session.user.role} />

// Role badge displays with animation
<span className="text-[10px] font-semibold text-primary">
  {getRoleDisplayName(userRole)}
</span>
```

---

## 📝 ADDING NEW ROLES

Khi thêm role mới, cập nhật 3 files:

### **1. Database Seed** (`prisma/seed.ts`):
```typescript
await prisma.role.create({
  data: {
    code: "NEW_ROLE",
    name: "New Role Name",
    // ... permissions
  }
});
```

### **2. Permissions** (`lib/permissions.ts`):
```typescript
const ROLE_ROUTES: Record<string, string[]> = {
  // ... existing roles
  NEW_ROLE: ["/dashboard", "/students", ...],
};
```

### **3. Sidebar** (`components/Sidebar.tsx`):
```typescript
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  // ... existing roles
  NEW_ROLE: "Tên Hiển Thị",
};
```

---

## ⚠️ IMPORTANT NOTES

### **Lỗi Sidebar Trắng**:
Nếu role không được định nghĩa trong `ROLE_ROUTES`, user sẽ thấy sidebar trắng (không có menu nào).

**Solution**: Luôn update `ROLE_ROUTES` khi thêm role mới.

### **Permission Cascade**:
```
SUPER_ADMIN > BOARD > DIRECTOR > BRANCH_MANAGER > Other Roles
```

Quyền cao hơn tự động có quyền của cấp thấp hơn.

### **Branch Filtering**:
Branch filtering được xử lý ở tầng database query, không phải UI.

```typescript
// Backend query
const students = await prisma.student.findMany({
  where: {
    branchId: user.scope === "branch" ? user.branchId : undefined
  }
});
```

---

## 🎯 USE CASES

### **Scenario 1: Multi-Branch Center**
- **1 DIRECTOR**: Xem tất cả branches
- **3 BRANCH_MANAGER**: Mỗi người 1 branch
- **10 RECEPTIONIST**: Phân theo branch
- **20 TEACHER**: Scoped to own classes

### **Scenario 2: Single Branch Center**
- **1 DIRECTOR**: Toàn quyền
- **1 ACCOUNTANT**: Tài chính
- **2 RECEPTIONIST**: Front desk
- **5 TEACHER**: Teaching staff

### **Scenario 3: Large Organization**
- **1 SUPER_ADMIN**: System management
- **1 BOARD**: Executive oversight
- **5 DIRECTOR**: Regional managers
- **15 BRANCH_MANAGER**: Branch heads
- **50+ Staff**: Various roles

---

## 📊 STATISTICS

**Total Roles**: 11  
**Role Categories**: 4
- Admin (3): SUPER_ADMIN, BOARD, DIRECTOR
- Management (2): BRANCH_MANAGER, HR
- Operations (4): REGISTRAR, ADMISSIONS, RECEPTIONIST, ACCOUNTANT
- Teaching (2): TEACHER, TEACHING_ASSISTANT

**Permission Levels**: 3 (ALL, BRANCH, OWN)  
**Sidebar Menus**: 14 modules  
**Role Badges**: Animated với gradient

---

## ✅ CHECKLIST

- [x] 11 roles defined
- [x] Permission scopes (ALL/BRANCH/OWN)
- [x] Sidebar filtering by role
- [x] Role badges in sidebar
- [x] Role display names (Vietnamese)
- [x] Route access control
- [x] Permission checking utilities
- [x] Scope-based queries
- [x] Documentation complete
- [x] Production ready

---

## 🎉 SUMMARY

✅ **11 vai trò đầy đủ** từ Super Admin đến Teaching Assistant  
✅ **Sidebar tự động filter** theo quyền của từng role  
✅ **3 permission scopes** (ALL, BRANCH, OWN)  
✅ **Role badges đẹp** với animation  
✅ **Tên tiếng Việt** dễ hiểu  
✅ **Production ready** với đầy đủ validation  

**Status**: 🟢 **COMPLETE & READY**

---

**Created**: July 29, 2026  
**Version**: 3.0.0  
**Status**: ✅ **PRODUCTION READY**

