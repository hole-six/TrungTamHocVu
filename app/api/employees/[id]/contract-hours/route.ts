import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";

// Định mức giờ làm/tháng theo hợp đồng — đặt ngay trên bảng "Giờ dự kiến & thực tế" để
// biết ai chưa đủ giờ mà xếp thêm lớp. Để trống = không đặt định mức.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canUpdateWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa định mức giờ" }, { status: 403 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: params.id }, select: { branchId: true } });
  if (!employee) return NextResponse.json({ error: "Không tìm thấy nhân sự" }, { status: 404 });
  if (!(await canAccessBranch(employee.branchId))) {
    return NextResponse.json({ error: "Không có quyền truy cập cơ sở của nhân sự này" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const raw = body.contractHoursPerMonth;
  let value: number | null = null;
  if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
    value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 500) {
      return NextResponse.json({ error: "Định mức giờ phải là số từ 0 đến 500" }, { status: 400 });
    }
  }

  const updated = await prisma.employee.update({
    where: { id: params.id },
    data: { contractHoursPerMonth: value },
    select: { id: true, contractHoursPerMonth: true },
  });
  return NextResponse.json({ ok: true, item: updated });
}
