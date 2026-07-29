import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("name" in body) data.name = String(body.name).trim();
  if ("tuitionPerSession" in body) data.tuitionPerSession = Number(body.tuitionPerSession);
  if ("sessionsPerWeek" in body) data.sessionsPerWeek = Number(body.sessionsPerWeek);
  if ("isActive" in body) data.isActive = !!body.isActive;

  const course = await prisma.course.update({ where: { id: params.id }, data });
  return NextResponse.json({ item: course });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const classCount = await prisma.class.count({ where: { courseId: params.id } });
  if (classCount > 0) {
    return NextResponse.json({ error: "Khóa học đang có lớp sử dụng, không thể xóa." }, { status: 409 });
  }
  await prisma.course.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
