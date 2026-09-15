import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findNextClassCycle } from "@/lib/server/class-pipeline";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView, canUpdate, canDelete } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import { estimateEndDate } from "@/lib/server/class-rules";
import { syncClassDerivedFields } from "@/lib/server/database-sync";
import { ensureClassRoadmapItems, normalizeRoadmapItemsInput } from "@/lib/server/class-roadmap";
import { normalizeDefaultStaffInput, saveDefaultStaff } from "@/lib/server/class-default-assignments";
import { lastTaughtNumber } from "@/lib/session-numbering";

class StaffSyncBlocked extends Error {}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (user && !canView("schedule", role)) return NextResponse.json({ error: "Khong co quyen xem lop" }, { status: 403 });
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

  if (!(await canAccessBranch(cls.branchId))) return NextResponse.json({ error: "Khong co quyen truy cap co so" }, { status: 403 });
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
  if ("nextClassId" in body) {
    const nextClassId = body.nextClassId ? String(body.nextClassId).trim() : null;
    if (nextClassId === params.id) {
      return NextResponse.json({ error: "Lop tiep theo khong duoc la chinh lop hien tai." }, { status: 400 });
    }
    if (nextClassId) {
      const nextClass = await prisma.class.findUnique({ where: { id: nextClassId }, select: { branchId: true, isRemedial: true, status: true } });
      if (!nextClass || nextClass.branchId !== existing.branchId || nextClass.isRemedial || nextClass.status !== "ACTIVE") {
        return NextResponse.json({ error: "Lop tiep theo khong hop le hoac khong cung co so." }, { status: 400 });
      }
      // Sửa lớp kế của MỘT lớp cũng khép được vòng lặp với chuỗi đã có (A1→A2 rồi đặt
      // A2→A1) — trước đây route này không kiểm tra gì. Dùng chung đúng hàm với màn sắp xếp.
      const cycle = await findNextClassCycle(prisma, [{ classId: params.id, nextClassId }]);
      if (cycle) {
        return NextResponse.json(
          { error: `Chọn lớp này sẽ tạo vòng lặp: ${cycle.classCodes.join(" → ")}. Chọn lớp khác làm lớp tiếp theo.` },
          { status: 400 },
        );
      }
    }
    data.nextClassId = nextClassId;
  }
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

  // Không cho giảm tổng số buổi xuống DƯỚI số buổi đã dạy. Xóa buổi trong lộ trình làm tổng
  // số buổi giảm theo, và nội dung nối với buổi học theo vị trí — nếu cho giảm quá mức này
  // thì buổi đã dạy mất nội dung, lịch sử buổi học hiện trống. Giao diện đã khóa các buổi
  // đã dạy, đây là chốt cuối phòng gọi API trực tiếp.
  if (nextTotalSessions !== null && nextTotalSessions !== existing.totalSessions) {
    const classSessions = await prisma.classSession.findMany({
      where: { classId: params.id },
      orderBy: { sessionDate: "asc" },
      select: { id: true, sessionDate: true, startTime: true, status: true, replacesSessionId: true },
    });
    const lastTaughtPosition = lastTaughtNumber(classSessions);
    if (nextTotalSessions < lastTaughtPosition) {
      return NextResponse.json(
        {
          error:
            `Lớp đã dạy tới buổi ${lastTaughtPosition}, không giảm tổng số buổi xuống ${nextTotalSessions} được. ` +
            `Chỉ xóa được các buổi sau buổi ${lastTaughtPosition}.`,
        },
        { status: 409 },
      );
    }
  }

  // Nhân sự mặc định: lưu kèm đổi người ở các buổi chưa dạy (xem saveDefaultStaff). Màn
  // "Chỉnh nhân sự" dùng /api/classes/[id]/default-assignments để xem trước rồi mới lưu.
  const defaultStaff = Array.isArray(body.defaultAssignments) ? normalizeDefaultStaffInput(body.defaultAssignments) : null;
  if (defaultStaff?.error) return NextResponse.json({ error: defaultStaff.error }, { status: 400 });
  let staffErrors: string[] = [];
  const roadmapItems = "roadmapItems" in body ? normalizeRoadmapItemsInput(body.roadmapItems, nextTotalSessions) : null;

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const classUpdated = await tx.class.update({ where: { id: params.id }, data });

      if (defaultStaff) {
        const saved = await saveDefaultStaff(tx, params.id, defaultStaff.items);
        if (!saved.ok) {
          staffErrors = saved.plan.errors;
          throw new StaffSyncBlocked();
        }
      }

      if (roadmapItems) {
        await tx.classRoadmapItem.deleteMany({ where: { classId: params.id } });
        if (roadmapItems.length > 0) {
          await tx.classRoadmapItem.createMany({
            data: roadmapItems.map((item) => ({
              classId: params.id,
              sessionNumber: item.sessionNumber,
              title: item.title,
              objective: item.objective,
              materials: item.materials,
              teacherGuide: item.teacherGuide,
              homeworkGuide: item.homeworkGuide,
              teacherRequirement: item.teacherRequirement,
            })),
          });
        }
      }

      return classUpdated;
    });
  } catch (error) {
    if (error instanceof StaffSyncBlocked) return NextResponse.json({ error: staffErrors.join(" ") }, { status: 409 });
    throw error;
  }
  if (existing && !(await canAccessBranch(existing.branchId))) {
    return NextResponse.json({ error: "Khong co quyen truy cap co so" }, { status: 403 });
  }
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

  const existing = await prisma.class.findUnique({ where: { id: params.id }, select: { branchId: true } });
  if (!existing) return NextResponse.json({ error: "Khong tim thay lop" }, { status: 404 });
  if (!(await canAccessBranch(existing.branchId))) {
    return NextResponse.json({ error: "Khong co quyen truy cap co so" }, { status: 403 });
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
