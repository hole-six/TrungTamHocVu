import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getBranchWhereClause, getValidBranchIdForCreation } from "@/lib/branch-filter";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");

  // Áp dụng branch filter
  const branchWhere = await getBranchWhereClause(searchParams.get("branchId"));

  const where = {
    ...branchWhere,
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ className: { contains: q } }, { classCode: { contains: q } }] } : {}),
  };

  const items = await prisma.class.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      course: true,
      _count: { select: { enrollments: true, sessions: true } },
      enrollments: { where: { status: "ACTIVE" }, select: { id: true } },
    },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canCreate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền tạo lớp mới" }, { status: 403 });
  }

  const body = await req.json();

  // Lấy branchId hợp lệ
  const branchId = await getValidBranchIdForCreation(body.branchId);
  if (!branchId) {
    return NextResponse.json({ error: "Không xác định được cơ sở" }, { status: 400 });
  }

  const classCode = String(body.classCode ?? "").trim();
  const className = String(body.className ?? "").trim();
  if (!classCode || !className) return NextResponse.json({ error: "Thiếu mã hoặc tên lớp" }, { status: 400 });

  const existing = await prisma.class.findUnique({ where: { classCode } });
  if (existing) return NextResponse.json({ error: "Mã lớp đã tồn tại" }, { status: 409 });

  let tuitionPerSession = body.tuitionPerSession ? Number(body.tuitionPerSession) : null;
  let sessionsPerWeek = body.sessionsPerWeek ? Number(body.sessionsPerWeek) : null;

  if (body.courseId) {
    const course = await prisma.course.findUnique({ where: { id: body.courseId } });
    if (course) {
      tuitionPerSession = tuitionPerSession ?? course.tuitionPerSession;
      sessionsPerWeek = sessionsPerWeek ?? course.sessionsPerWeek;
    }
  }

  const created = await prisma.class.create({
    data: {
      branchId,
      courseId: body.courseId || null,
      classCode,
      classGroup: body.classGroup || null,
      className,
      totalSessions: body.totalSessions ? Number(body.totalSessions) : null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      sessionsPerWeek,
      tuitionPerSession,
      notes: body.notes || null,
    },
  });

  return NextResponse.json({ item: created }, { status: 201 });
}
