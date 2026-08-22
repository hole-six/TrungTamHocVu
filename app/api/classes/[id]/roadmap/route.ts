import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { ensureClassRoadmapItems, inferRoadmapTitle } from "@/lib/server/class-roadmap";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const cls = await prisma.class.findUnique({
    where: { id: params.id },
    select: { id: true, totalSessions: true },
  });
  if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });

  const items = await ensureClassRoadmapItems(cls.id, cls.totalSessions);
  return NextResponse.json({ items });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Bạn không có quyền sửa lộ trình lớp học" }, { status: 403 });
  }

  const cls = await prisma.class.findUnique({
    where: { id: params.id },
    select: { id: true, totalSessions: true },
  });
  if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });

  await ensureClassRoadmapItems(cls.id, cls.totalSessions);

  const body = await req.json();
  const itemId = String(body.itemId ?? "").trim();
  if (!itemId) return NextResponse.json({ error: "Thiếu mục lộ trình cần cập nhật" }, { status: 400 });

  const existing = await prisma.classRoadmapItem.findFirst({
    where: { id: itemId, classId: cls.id },
  });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy mục lộ trình" }, { status: 404 });

  const title = inferRoadmapTitle(existing.sessionNumber, body.title);
  const item = await prisma.classRoadmapItem.update({
    where: { id: existing.id },
    data: {
      title,
      objective: String(body.objective ?? "").trim() || null,
      materials: String(body.materials ?? "").trim() || null,
      teacherGuide: String(body.teacherGuide ?? "").trim() || null,
      homeworkGuide: String(body.homeworkGuide ?? "").trim() || null,
      teacherRequirement: String(body.teacherRequirement ?? "").trim() || null,
    },
  });

  return NextResponse.json({ item });
}
