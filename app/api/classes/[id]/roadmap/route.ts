import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { inferRoadmapTitle, resolveClassRoadmap } from "@/lib/server/class-roadmap";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const cls = await prisma.class.findUnique({
    where: { id: params.id },
    select: { id: true, totalSessions: true },
  });
  if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });

  // Trả về tiến trình THỰC TẾ của lớp: buổi nào lớp ghi đè thì lấy của lớp, còn lại
  // lấy của khóa (source cho biết buổi nào đang "theo khóa" để màn hình nói rõ).
  const [resolved, classItems] = await Promise.all([
    resolveClassRoadmap(prisma, cls.id),
    prisma.classRoadmapItem.findMany({ where: { classId: cls.id }, select: { id: true, sessionNumber: true } }),
  ]);
  const idBySession = new Map(classItems.map((item) => [item.sessionNumber, item.id]));
  const items = resolved.map((item) => ({ ...item, id: idBySession.get(item.sessionNumber) ?? null }));
  return NextResponse.json({ items });
}

/** Bỏ bản ghi đè của một buổi để buổi đó quay về bám theo tiến trình của khóa. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Bạn không có quyền sửa lộ trình lớp học" }, { status: 403 });
  }

  const sessionNumber = Number(new URL(req.url).searchParams.get("sessionNumber"));
  if (!Number.isInteger(sessionNumber) || sessionNumber <= 0) {
    return NextResponse.json({ error: "Thiếu số buổi cần trả về theo khóa" }, { status: 400 });
  }

  const cls = await prisma.class.findUnique({ where: { id: params.id }, select: { id: true, courseId: true } });
  if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });
  if (!cls.courseId) {
    return NextResponse.json({ error: "Lớp chưa gắn khóa học nên không có tiến trình chung để trả về." }, { status: 409 });
  }

  await prisma.classRoadmapItem.deleteMany({ where: { classId: cls.id, sessionNumber } });
  return NextResponse.json({ ok: true });
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

  const body = await req.json();
  const itemId = String(body.itemId ?? "").trim();
  const askedSession = Number(body.sessionNumber);

  // Sửa một buổi của lớp = GHI ĐÈ đúng buổi đó lên tiến trình của khóa. Lớp bám theo
  // khóa thì chưa có dòng nào, nên nhận cả `sessionNumber` để tạo bản ghi đè mới —
  // trước đây bắt buộc có itemId nên buổi đang theo khóa không sửa riêng được.
  const existing = itemId
    ? await prisma.classRoadmapItem.findFirst({ where: { id: itemId, classId: cls.id } })
    : Number.isInteger(askedSession) && askedSession > 0
      ? ((await prisma.classRoadmapItem.findFirst({ where: { classId: cls.id, sessionNumber: askedSession } })) ??
        (await prisma.classRoadmapItem.create({
          data: { classId: cls.id, sessionNumber: askedSession, title: inferRoadmapTitle(askedSession, body.title) },
        })))
      : null;
  if (!existing) return NextResponse.json({ error: "Thiếu mục lộ trình cần cập nhật" }, { status: 400 });

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
