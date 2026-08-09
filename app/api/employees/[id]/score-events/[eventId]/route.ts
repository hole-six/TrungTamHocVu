import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; eventId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canUpdateWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa điểm trợ giảng" }, { status: 403 });
  }

  const existing = await prisma.assistantScoreEvent.findUnique({ where: { id: params.eventId } });
  if (!existing || existing.employeeId !== params.id) {
    return NextResponse.json({ error: "Không tìm thấy điểm sự kiện" }, { status: 404 });
  }

  await prisma.assistantScoreEvent.delete({ where: { id: params.eventId } });
  return NextResponse.json({ success: true });
}
