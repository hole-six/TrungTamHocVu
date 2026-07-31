import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate, canDelete } from "@/lib/server/role-matrix";
import { estimateEndDate } from "@/lib/server/class-rules";
import { syncClassDerivedFields } from "@/lib/server/database-sync";
import { ensureClassRoadmapItems } from "@/lib/server/class-roadmap";
import { isValidClassAssignmentRole } from "@/lib/server/class-default-assignments";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const cls = await prisma.class.findUnique({
    where: { id: params.id },
    include: {
      course: true,
      scheduleRules: { orderBy: { weekday: "asc" } },
      defaultAssignments: { where: { isActive: true }, include: { employee: true }, orderBy: { role: "asc" } },
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

  const existing = await prisma.class.findUnique({
    where: { id: params.id },
    include: { course: true },
  });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of ["className", "classGroup", "status", "notes"]) {
    if (field in body) data[field] = body[field] || null;
  }
  if ("courseId" in body) data.courseId = body.courseId || null;
  for (const field of ["totalSessions", "sessionsPerWeek", "tuitionPerSession"]) {
    if (field in body) data[field] = body[field] === "" || body[field] === null ? null : Number(body[field]);
  }
  for (const field of ["startDate", "expectedEndDate"]) {
    if (field in body) data[field] = body[field] ? new Date(body[field]) : null;
  }

  const nextCourse =
    "courseId" in body
      ? body.courseId
        ? await prisma.course.findUnique({ where: { id: body.courseId } })
        : null
      : existing.course;
  const nextSessionsPerWeek =
    "sessionsPerWeek" in body
      ? body.sessionsPerWeek === "" || body.sessionsPerWeek === null
        ? nextCourse?.sessionsPerWeek ?? null
        : Number(body.sessionsPerWeek)
      : existing.sessionsPerWeek ?? nextCourse?.sessionsPerWeek ?? null;
  const nextTotalSessions =
    "totalSessions" in body
      ? body.totalSessions === "" || body.totalSessions === null
        ? null
        : Number(body.totalSessions)
      : existing.totalSessions;
  const nextStartDate =
    "startDate" in body ? (body.startDate ? new Date(body.startDate) : null) : existing.startDate;

  if (!("expectedEndDate" in body)) {
    const previousDerived = estimateEndDate(existing.startDate, existing.totalSessions, existing.sessionsPerWeek);
    if (!existing.expectedEndDate || existing.expectedEndDate.getTime() === previousDerived?.getTime()) {
      data.expectedEndDate = estimateEndDate(nextStartDate, nextTotalSessions, nextSessionsPerWeek);
    }
  }

  const defaultAssignments = Array.isArray(body.defaultAssignments) ? body.defaultAssignments : null;

  const updated = await prisma.$transaction(async (tx) => {
    const classUpdated = await tx.class.update({ where: { id: params.id }, data });

    if (defaultAssignments) {
      const normalizedAssignments: Array<{ role: string; employeeId: string; notes: string | null }> = defaultAssignments
        .map((item: { role?: string; employeeId?: string | null; notes?: string | null }) => ({
          role: String(item.role ?? "").trim(),
          employeeId: item.employeeId ? String(item.employeeId).trim() : "",
          notes: String(item.notes ?? "").trim() || null,
        }))
        .filter((item: { role: string }) => isValidClassAssignmentRole(item.role));

      const seenRoles = new Set<string>();
      for (const assignment of normalizedAssignments) {
        if (seenRoles.has(assignment.role)) {
          throw new Error(`Vai trò ${assignment.role} đang bị gửi trùng.`);
        }
        seenRoles.add(assignment.role);
      }

      await tx.classDefaultAssignment.updateMany({
        where: { classId: params.id, role: { notIn: normalizedAssignments.map((item: { role: string }) => item.role) } },
        data: { isActive: false },
      });

      for (const assignment of normalizedAssignments) {
        if (!assignment.employeeId) continue;
        await tx.classDefaultAssignment.upsert({
          where: { classId_role: { classId: params.id, role: assignment.role } },
          create: {
            classId: params.id,
            employeeId: assignment.employeeId,
            role: assignment.role,
            notes: assignment.notes,
            isActive: true,
          },
          update: {
            employeeId: assignment.employeeId,
            notes: assignment.notes,
            isActive: true,
          },
        });
      }
    }

    return classUpdated;
  });
  await ensureClassRoadmapItems(updated.id, nextTotalSessions);
  const synced = await syncClassDerivedFields(updated.id);
  return NextResponse.json({ item: synced ?? updated });
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
