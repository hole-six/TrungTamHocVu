import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; scoreId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "students");
  if (!canUpdateWithOverride("students", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa điểm học lực" }, { status: 403 });
  }

  const existing = await prisma.schoolExamScore.findUnique({ where: { id: params.scoreId } });
  if (!existing || existing.studentId !== params.id) {
    return NextResponse.json({ error: "Không tìm thấy điểm học lực" }, { status: 404 });
  }

  await prisma.schoolExamScore.delete({ where: { id: params.scoreId } });
  return NextResponse.json({ success: true });
}
