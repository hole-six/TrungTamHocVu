// TIẾN TRÌNH CHUẨN CỦA KHÓA HỌC — soạn một lần, mọi lớp cùng khóa dùng chung.
//
// Sửa ở đây là MỌI LỚP đang chạy khóa này đổi theo (trừ những buổi lớp đã ghi đè riêng),
// nên GET trả kèm số lớp bị ảnh hưởng để màn hình cảnh báo trước khi lưu.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { inferRoadmapTitle, normalizeRoadmapItemsInput } from "@/lib/server/class-roadmap";

/** Số buổi của tiến trình khóa: lấy theo buổi đã soạn, tối thiểu là số buổi dự kiến của khóa. */
async function roadmapLength(courseId: string, requested?: unknown) {
  const [maxItem, longestClass] = await Promise.all([
    prisma.courseRoadmapItem.findFirst({ where: { courseId }, orderBy: { sessionNumber: "desc" }, select: { sessionNumber: true } }),
    prisma.class.findFirst({ where: { courseId }, orderBy: { totalSessions: "desc" }, select: { totalSessions: true } }),
  ]);
  const asked = Number(requested ?? 0);
  return Math.max(Number.isInteger(asked) ? asked : 0, maxItem?.sessionNumber ?? 0, longestClass?.totalSessions ?? 0, 0);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const course = await prisma.course.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!course) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });

  const total = await roadmapLength(course.id, new URL(req.url).searchParams.get("totalSessions"));
  const [stored, classCount] = await Promise.all([
    prisma.courseRoadmapItem.findMany({ where: { courseId: course.id }, orderBy: { sessionNumber: "asc" } }),
    prisma.class.count({ where: { courseId: course.id, status: "ACTIVE" } }),
  ]);

  const bySession = new Map(stored.map((item) => [item.sessionNumber, item]));
  const items = Array.from({ length: total }, (_, index) => {
    const sessionNumber = index + 1;
    const found = bySession.get(sessionNumber);
    return {
      sessionNumber,
      title: inferRoadmapTitle(sessionNumber, found?.title),
      objective: found?.objective ?? "",
      materials: found?.materials ?? "",
      teacherGuide: found?.teacherGuide ?? "",
      homeworkGuide: found?.homeworkGuide ?? "",
      teacherRequirement: found?.teacherRequirement ?? "",
      alertLevel: found?.alertLevel ?? "NONE",
    };
  });

  return NextResponse.json({ items, totalSessions: total, affectedClasses: classCount, courseName: course.name });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Bạn không có quyền sửa tiến trình khóa học" }, { status: 403 });
  }

  const course = await prisma.course.findUnique({ where: { id: params.id }, select: { id: true, branchId: true } });
  if (!course) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });

  const body = await req.json();
  const total = await roadmapLength(course.id, body.totalSessions);
  const items = normalizeRoadmapItemsInput(body.items, total);
  if (items.length === 0) return NextResponse.json({ error: "Không có nội dung tiến trình nào để lưu." }, { status: 400 });

  // Ghi đè trọn bộ trong một giao dịch: nửa chừng mà hỏng thì tiến trình của khóa còn
  // một nửa cũ một nửa mới, mọi lớp dùng chung sẽ lệch theo.
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      await tx.courseRoadmapItem.upsert({
        where: { courseId_sessionNumber: { courseId: course.id, sessionNumber: item.sessionNumber } },
        create: { courseId: course.id, ...item },
        update: { ...item },
      });
    }
  });

  const affectedClasses = await prisma.class.count({ where: { courseId: course.id, status: "ACTIVE" } });
  return NextResponse.json({ ok: true, saved: items.length, affectedClasses });
}
