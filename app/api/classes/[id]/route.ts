import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate, canDelete } from "@/lib/server/role-matrix";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const cls = await prisma.class.findUnique({
    where: { id: params.id },
    include: {
      course: true,
      scheduleRules: { orderBy: { weekday: "asc" } },
      sessions: { orderBy: { sessionDate: "desc" }, take: 30, include: { attendances: true } },
      enrollments: { include: { student: true }, orderBy: { enrollDate: "desc" } },
    },
  });
  if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });

  const completedSessions = await prisma.classSession.count({ where: { classId: cls.id, status: "COMPLETED" } });
  const activeStudents = cls.enrollments.filter((e) => e.status === "ACTIVE").length;

  return NextResponse.json({ item: cls, completedSessions, activeStudents });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa lớp" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of ["className", "classGroup", "status", "notes"]) {
    if (field in body) data[field] = body[field] || null;
  }
  for (const field of ["totalSessions", "sessionsPerWeek", "tuitionPerSession"]) {
    if (field in body) data[field] = body[field] === "" || body[field] === null ? null : Number(body[field]);
  }
  for (const field of ["startDate", "expectedEndDate"]) {
    if (field in body) data[field] = body[field] ? new Date(body[field]) : null;
  }

  const updated = await prisma.class.update({ where: { id: params.id }, data });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canDelete("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa lớp" }, { status: 403 });
  }

  const [enrollmentCount, sessionCount] = await Promise.all([
    prisma.enrollment.count({ where: { classId: params.id } }),
    prisma.classSession.count({ where: { classId: params.id } }),
  ]);
  if (enrollmentCount > 0 || sessionCount > 0) {
    return NextResponse.json(
      { error: "Lớp đã có học viên ghi danh hoặc buổi học, chuyển trạng thái sang 'Đã hủy' thay vì xóa." },
      { status: 409 }
    );
  }
  await prisma.class.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
