import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const relatedType = searchParams.get("relatedType");
  const relatedId = searchParams.get("relatedId");
  const status = searchParams.get("status");

  const items = await prisma.task.findMany({
    where: {
      ...(relatedType ? { relatedType } : {}),
      ...(relatedId ? { relatedId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await req.json();
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Thiếu tiêu đề việc cần làm" }, { status: 400 });

  const task = await prisma.task.create({
    data: {
      title,
      description: body.description || null,
      relatedType: body.relatedType || null,
      relatedId: body.relatedId || null,
      assignedToId: body.assignedToId || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
    },
  });

  return NextResponse.json({ item: task }, { status: 201 });
}
