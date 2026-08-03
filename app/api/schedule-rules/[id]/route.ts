import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import { recalculateClassScheduleDerivedFields } from "@/lib/server/database-sync";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa lịch học" }, { status: 403 });
  }
  const rule = await prisma.scheduleRule.findUnique({
    where: { id: params.id },
    include: { class: { select: { id: true, branchId: true } } },
  });
  if (!rule) return NextResponse.json({ error: "Khong tim thay lich co dinh" }, { status: 404 });
  if (!(await canAccessBranch(rule.class.branchId))) {
    return NextResponse.json({ error: "Khong co quyen truy cap co so cua lop nay" }, { status: 403 });
  }
  await prisma.scheduleRule.delete({ where: { id: params.id } });
  await recalculateClassScheduleDerivedFields(rule.class.id);
  return NextResponse.json({ ok: true });
}
