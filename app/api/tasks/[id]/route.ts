import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await req.json();
  if (!["OPEN", "DONE", "CANCELLED"].includes(body.status)) {
    return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
  }

  const task = await prisma.task.update({ where: { id: params.id }, data: { status: body.status } });
  return NextResponse.json({ item: task });
}
