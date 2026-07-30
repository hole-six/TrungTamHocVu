import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { syncCourseClasses } from "@/lib/server/database-sync";
import { getUserRole } from "@/lib/permissions";
import { canUpdate, canDelete } from "@/lib/server/role-matrix";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa khóa học" }, { status: 403 });
  }

  const existing = await prisma.course.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("name" in body) data.name = String(body.name).trim();
  if ("tuitionPerSession" in body) data.tuitionPerSession = Number(body.tuitionPerSession);
  if ("sessionsPerWeek" in body) data.sessionsPerWeek = Number(body.sessionsPerWeek);
  if ("isActive" in body) data.isActive = !!body.isActive;

  const course = await prisma.course.update({ where: { id: params.id }, data });
  await syncCourseClasses(course.id, {
    tuitionPerSession: existing.tuitionPerSession,
    sessionsPerWeek: existing.sessionsPerWeek,
  });

  return NextResponse.json({ item: course });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canDelete("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa khóa học" }, { status: 403 });
  }

  const classCount = await prisma.class.count({ where: { courseId: params.id } });
  if (classCount > 0) {
    return NextResponse.json({ error: "Khóa học đang có lớp sử dụng, không thể xóa." }, { status: 409 });
  }
  await prisma.course.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
