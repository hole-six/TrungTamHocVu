import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!["OPEN", "DONE", "CANCELLED"].includes(body.status)) {
      return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
    }
    data.status = body.status;
  }
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: "Thiếu tiêu đề việc cần làm" }, { status: 400 });
    data.title = title;
  }
  if (body.description !== undefined) data.description = body.description || null;
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Không có thay đổi nào để lưu" }, { status: 400 });
  }

  const task = await prisma.task.update({ where: { id: params.id }, data });
  return NextResponse.json({ item: task });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const existing = await prisma.task.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy việc cần làm" }, { status: 404 });

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
