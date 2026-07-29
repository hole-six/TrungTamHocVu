# 🚀 Setup Roles & Permissions

## Bước 1: Chạy Seed Script

### Windows (CMD):
```cmd
cd C:\Users\ACER\Downloads\TACH
npm run prisma:seed
```

Hoặc double-click file:
```
scripts\seed-roles.bat
```

### Output mong đợi:
```
🌱 Seeding roles and permissions...
📝 Creating permissions...
✅ Created 50+ permissions
👥 Creating roles...
✅ Created 5 roles
🔗 Assigning permissions to roles...
  ✓ DIRECTOR: 45 permissions
  ✓ ACCOUNTANT: 18 permissions
  ✓ RECEPTIONIST: 16 permissions
  ✓ TEACHER: 5 permissions
  ✓ BRANCH_MANAGER: 40 permissions
✨ Roles and permissions seeded successfully!
```

## Bước 2: Gán Role cho User

### Option A: Qua Database (Manual)

```sql
-- 1. Lấy ID của role
SELECT id, code, name FROM roles;

-- 2. Update user với roleId
UPDATE users 
SET roleId = 'role-id-here' 
WHERE email = 'admin@example.com';
```

### Option B: Qua UI Admin (Recommended)

1. Đăng nhập với admin account
2. Vào `/admin/users`
3. Chỉnh sửa user
4. Chọn Role từ dropdown
5. Lưu

## Bước 3: Test Permissions

### Test sidebar filtering:

**DIRECTOR** sẽ thấy:
- ✅ Tất cả menu items
- ✅ BranchSelector để switch cơ sở
- ✅ Footer hiển thị "Role: DIRECTOR"

**ACCOUNTANT** sẽ thấy:
- ✅ Dashboard
- ✅ Học viên (view only)
- ✅ Học phí
- ✅ Kho giáo trình
- ✅ Thu chi
- ✅ Nhân sự & Lương
- ✅ Báo cáo
- ❌ KHÔNG thấy: Leads, Phụ huynh, Admin

**RECEPTIONIST** sẽ thấy:
- ✅ Dashboard
- ✅ CRM Leads
- ✅ Học viên
- ✅ Phụ huynh
- ✅ Lớp & Lịch
- ✅ Lịch tổng
- ✅ Học phí (thu tiền)
- ✅ Kho giáo trình (xuất sách)
- ❌ KHÔNG thấy: Thu chi, Lương, Admin

**TEACHER** sẽ thấy:
- ✅ Dashboard (chỉ lịch dạy)
- ✅ Học viên (chỉ lớp mình)
- ✅ Lớp & Lịch (chỉ lớp mình)
- ✅ Lịch tổng
- ✅ Chấm công (xem giờ công mình)
- ✅ Nhân sự & Lương (xem lương mình)
- ❌ KHÔNG thấy: Leads, Phụ huynh, Học phí, Kho, Thu chi, Admin

**BRANCH_MANAGER** sẽ thấy:
- ✅ Tất cả menu (như DIRECTOR)
- ✅ Nhưng chỉ xem cơ sở của mình
- ✅ Admin (quản lý users trong cơ sở)

## Bước 4: Protect API Routes

### Thêm permission check vào API:

```typescript
// app/api/students/route.ts
import { withPermission } from "@/lib/middleware/permissions-middleware";

export const GET = withPermission("student.view.branch", async (req) => {
  // Your handler code
  const students = await prisma.student.findMany();
  return NextResponse.json({ students });
});

export const POST = withPermission("student.create.branch", async (req) => {
  // Your create logic
});
```

### Hoặc check manual:

```typescript
import { checkPermissionFromSession } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const { allowed, user } = await checkPermissionFromSession("student.view.branch");
  
  if (!allowed) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }
  
  // Your handler code
}
```

## Bước 5: Verify Setup

### Checklist:

- [ ] Seed script chạy thành công
- [ ] 5 roles được tạo trong database
- [ ] 50+ permissions được tạo
- [ ] RolePermissions được gán đúng
- [ ] User có roleId
- [ ] Sidebar hiển thị đúng menu theo role
- [ ] Footer sidebar hiển thị role name
- [ ] BranchSelector chỉ hiển thị cho DIRECTOR/BRANCH_MANAGER
- [ ] API routes được protect

## Troubleshooting

### Lỗi: "Cannot find module 'tsx'"
```cmd
npm install tsx --save-dev
```

### Lỗi: "Permission denied when accessing /admin"
- Check user có roleId không
- Check role có permissions không
- Check API middleware

### Sidebar không filter theo role
- Check Layout component đã pass `navItems` và `userRole` chưa
- Check `getFilteredNavItems()` return đúng routes chưa
- Clear browser cache và reload

### User không thấy BranchSelector
- Check user có role là DIRECTOR hoặc BRANCH_MANAGER không
- Check có nhiều hơn 1 branch trong database không

## Next Steps

1. **Tạo Organization & Branch đầu tiên:**
   - Vào `/admin/branches`
   - Tạo cơ sở đầu tiên

2. **Assign users vào branches:**
   - Vào `/admin/users`
   - Gán branchId cho từng user

3. **Test permission matrix:**
   - Login với các role khác nhau
   - Verify sidebar và API access

4. **Customize permissions nếu cần:**
   - Edit `prisma/seeds/roles-permissions.ts`
   - Chạy lại `npm run prisma:seed`

## Permission Format

```
resource.action.scope

Examples:
- student.view.all       # Xem học viên tất cả cơ sở
- student.view.branch    # Xem học viên cơ sở mình
- student.view.own       # Xem học viên lớp mình dạy
- tuition.refund.branch  # Hoàn tiền trong cơ sở
- admin.manage_roles.all # Quản lý roles (toàn hệ thống)
```

## Role Matrix

| Resource | DIRECTOR | ACCOUNTANT | RECEPTIONIST | TEACHER | BRANCH_MGR |
|----------|----------|------------|--------------|---------|------------|
| Dashboard | all | branch | branch | own | branch |
| Student | all | branch | branch | own | branch |
| Lead | branch | ❌ | branch | ❌ | branch |
| Class | all | ❌ | branch | own | branch |
| Tuition | all | branch | view | ❌ | branch |
| Cashbook | all | branch | ❌ | ❌ | branch |
| Payroll | all | branch | ❌ | own | branch |
| Admin | all | ❌ | ❌ | ❌ | branch |

---

✅ **Done!** Hệ thống phân quyền đã được setup hoàn chỉnh.
