import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canDelete } from "@/lib/server/role-matrix";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const role = await getUserRole(user.id);
  if (!canDelete("timesheet", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa chấm công." }, { status: 403 });
  }

  const existing = await prisma.timesheetEntry.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy chấm công" }, { status: 404 });

  await prisma.timesheetEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
