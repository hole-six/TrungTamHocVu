import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate, canDelete } from "@/lib/server/role-matrix";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa việc nhắc" }, { status: 403 });
  }

  const existing = await prisma.classTask.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy việc nhắc" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("title" in body) data.title = String(body.title ?? "").trim() || existing.title;
  if ("isActive" in body) data.isActive = Boolean(body.isActive);
  if ("notes" in body) data.notes = body.notes || null;
  if ("dayOfMonth" in body) data.dayOfMonth = body.dayOfMonth ? Number(body.dayOfMonth) : null;
  if ("weekday" in body) data.weekday = body.weekday !== null && body.weekday !== undefined ? Number(body.weekday) : null;
  if ("onceDate" in body) data.onceDate = body.onceDate ? new Date(body.onceDate) : null;

  const updated = await prisma.classTask.update({ where: { id: params.id }, data });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canDelete("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa việc nhắc" }, { status: 403 });
  }
  await prisma.classTask.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
