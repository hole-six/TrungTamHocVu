// CƠ SỞ LÀM VIỆC CỦA MỘT NHÂN SỰ.
//
// Tách riêng khỏi PATCH /api/employees/[id] (route đó còn kéo theo việc tính lại đơn giá
// buổi chưa dạy và kiểm tra ngày nghỉ) — gắn/bỏ cơ sở là việc độc lập, không được đụng
// tới tiền của buổi học. Gắn nhiều cơ sở KHÔNG gộp số liệu: lương và chỉ số vẫn tính
// riêng từng cơ sở, đây chỉ là danh sách nơi người đó được phép làm.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { setEmployeeBranches } from "@/lib/server/employee-branches";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const [employee, branches] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: params.id },
      select: { branchId: true, branchLinks: { select: { branchId: true } } },
    }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  if (!employee) return NextResponse.json({ error: "Không tìm thấy nhân sự" }, { status: 404 });

  const branchIds = Array.from(new Set([employee.branchId, ...employee.branchLinks.map((link) => link.branchId)]));
  return NextResponse.json({ primaryBranchId: employee.branchId, branchIds, branches });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canUpdateWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa cơ sở làm việc" }, { status: 403 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: params.id }, select: { id: true, branchId: true } });
  if (!employee) return NextResponse.json({ error: "Không tìm thấy nhân sự" }, { status: 404 });

  const body = await req.json();
  const requested: string[] = Array.isArray(body.branchIds) ? body.branchIds.map((item: unknown) => String(item)) : [];
  const valid = await prisma.branch.findMany({ where: { id: { in: requested } }, select: { id: true } });
  const validIds = valid.map((branch) => branch.id);

  // Cơ sở CHÍNH luôn được giữ (setEmployeeBranches tự thêm lại) — bỏ nó ra thì hồ sơ
  // biến mất khỏi chính nơi đang quản lý người này.
  const branchIds = await setEmployeeBranches(employee.id, validIds);

  return NextResponse.json({ primaryBranchId: employee.branchId, branchIds });
}
