import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getBranchWhereClause, getValidBranchIdForCreation } from "@/lib/branch-filter";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";
import { estimateEndDate, estimateEndDateFromRules } from "@/lib/server/class-rules";
import { syncClassDerivedFields } from "@/lib/server/database-sync";
import { ensureClassRoadmapItems, normalizeRoadmapItemsInput } from "@/lib/server/class-roadmap";
import { isValidClassAssignmentRole } from "@/lib/server/class-default-assignments";

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
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const items = await prisma.class.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      course: { select: { code: true, name: true } },
      scheduleRules: {
        where: { isActive: true },
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      },
      sessions: {
        where: {
          sessionDate: { gte: today },
          status: { not: "CANCELLED" },
        },
        orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
        take: 1,
      },
      _count: {
        select: {
          enrollments: { where: { status: "ACTIVE" } },
          sessions: { where: { status: "COMPLETED" } },
        },
      },
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
  const scheduleRules = Array.isArray(body.scheduleRules) ? body.scheduleRules : [];

  if (body.courseId) {
    const course = await prisma.course.findUnique({ where: { id: body.courseId } });
    if (course) {
      tuitionPerSession = tuitionPerSession ?? course.tuitionPerSession;
      sessionsPerWeek = sessionsPerWeek ?? course.sessionsPerWeek;
    }
  }

  if (scheduleRules.length > 0) {
    sessionsPerWeek = scheduleRules.length;
  }

  for (const [index, rule] of scheduleRules.entries()) {
    const weekday = Number(rule.weekday);
    const startTime = String(rule.startTime ?? "").trim();
    const endTime = String(rule.endTime ?? "").trim();
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return NextResponse.json({ error: `Buổi cố định ${index + 1} có thứ không hợp lệ.` }, { status: 400 });
    }
    if (!startTime || !endTime || startTime >= endTime) {
      return NextResponse.json({ error: `Buổi cố định ${index + 1} có giờ học không hợp lệ.` }, { status: 400 });
    }
  }

  const normalizedStartDate = body.startDate ? new Date(body.startDate) : null;
  const normalizedTotalSessions = body.totalSessions ? Number(body.totalSessions) : null;
  const normalizedRules = scheduleRules.map((rule: { weekday: number; startTime: string; endTime: string; room?: string | null }) => ({
    weekday: Number(rule.weekday),
    startTime: String(rule.startTime).trim(),
    endTime: String(rule.endTime).trim(),
    room: rule.room ? String(rule.room).trim() : null,
  }));
  const expectedEndDate =
    estimateEndDateFromRules(normalizedStartDate, normalizedTotalSessions, normalizedRules) ??
    estimateEndDate(normalizedStartDate, normalizedTotalSessions, sessionsPerWeek);
  const roadmapItems = normalizeRoadmapItemsInput(body.roadmapItems, normalizedTotalSessions);
  const defaultAssignments = Array.isArray(body.defaultAssignments)
    ? body.defaultAssignments
        .map((item: { role?: string; employeeId?: string | null; notes?: string | null }) => ({
          role: String(item.role ?? "").trim(),
          employeeId: item.employeeId ? String(item.employeeId).trim() : "",
          notes: String(item.notes ?? "").trim() || null,
        }))
        .filter((item: { role: string; employeeId: string }) => item.employeeId && isValidClassAssignmentRole(item.role))
    : [];

  const created = await prisma.class.create({
    data: {
      branchId,
      courseId: body.courseId || null,
      classCode,
      classGroup: body.classGroup || null,
      className,
      totalSessions: normalizedTotalSessions,
      startDate: normalizedStartDate,
      expectedEndDate,
      sessionsPerWeek,
      tuitionPerSession,
      notes: body.notes || null,
      scheduleRules: scheduleRules.length
        ? {
            create: normalizedRules,
          }
        : undefined,
      roadmapItems: roadmapItems.length
        ? {
            create: roadmapItems,
          }
        : undefined,
      defaultAssignments: defaultAssignments.length
        ? {
            create: defaultAssignments,
          }
        : undefined,
    },
  });

  if (roadmapItems.length === 0) {
    await ensureClassRoadmapItems(created.id, normalizedTotalSessions);
  }
  const synced = await syncClassDerivedFields(created.id);
  return NextResponse.json({ item: synced ?? created }, { status: 201 });
}
