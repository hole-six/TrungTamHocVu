import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { computeExtendedEndDate, estimateEndDate, estimateEndDateFromRules } from "@/lib/server/class-rules";
import { computeSessionBaseHours } from "@/lib/server/payroll-rules";
import { getHolidayDateSet } from "@/lib/server/holidays";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền thêm buổi bù" }, { status: 403 });
  }

  const sourceSession = await prisma.classSession.findUnique({
    where: { id: params.id },
    include: { assignments: { include: { employee: true } }, class: { include: { scheduleRules: true } } },
  });
  if (!sourceSession) {
    return NextResponse.json({ error: "Không tìm thấy buổi học gốc" }, { status: 404 });
  }
  if (sourceSession.status === "CANCELLED") {
    return NextResponse.json({ error: "Buổi đã hủy không thể dùng làm mốc tạo buổi bù" }, { status: 409 });
  }

  const body = await req.json();
  const makeupDate = body.makeupDate ? new Date(body.makeupDate) : null;
  if (!makeupDate || Number.isNaN(makeupDate.getTime())) {
    return NextResponse.json({ error: "Thiếu hoặc sai ngày học bù." }, { status: 400 });
  }

  const startTime = body.startTime ? String(body.startTime).trim() : sourceSession.startTime;
  const endTime = body.endTime ? String(body.endTime).trim() : sourceSession.endTime;
  if (!startTime || !endTime || startTime >= endTime) {
    return NextResponse.json({ error: "Khung giờ buổi bù không hợp lệ." }, { status: 400 });
  }

  const reason = body.reason ? String(body.reason).trim() : null;
  const room = body.room ? String(body.room).trim() : sourceSession.room;
  const notePrefix = `Buổi bù thêm cho buổi ${sourceSession.sessionDate.toLocaleDateString("vi-VN")}`;
  const notes = reason ? `${notePrefix}: ${reason}` : notePrefix;

  const holidayDates = await getHolidayDateSet(sourceSession.class.branchId);
  const currentEnd =
    sourceSession.class.expectedEndDate ??
    estimateEndDateFromRules(sourceSession.class.startDate, sourceSession.class.totalSessions, sourceSession.class.scheduleRules, holidayDates) ??
    estimateEndDate(sourceSession.class.startDate, sourceSession.class.totalSessions, sourceSession.class.sessionsPerWeek);
  const extendedEnd = computeExtendedEndDate(currentEnd, makeupDate);

  const result = await prisma.$transaction(async (tx) => {
    const makeupSession = await tx.classSession.create({
      data: {
        classId: sourceSession.classId,
        sessionDate: makeupDate,
        startTime,
        endTime,
        room: room || null,
        status: "PLANNED",
        notes,
      },
    });

    if (sourceSession.assignments.length > 0) {
      await tx.sessionAssignment.createMany({
        data: sourceSession.assignments.map((assignment) => {
          const hours = computeSessionBaseHours(assignment.employee.payMode, makeupSession.startTime, makeupSession.endTime);
          const hourlyRate =
            assignment.role === "TEACHER" ? assignment.employee.teachingHourlyRate ?? 0 : assignment.employee.assistantHourlyRate ?? 0;
          return {
            sessionId: makeupSession.id,
            employeeId: assignment.employeeId,
            role: assignment.role,
            hours,
            hourlyRate,
            amount: Math.round(hours * hourlyRate),
          };
        }),
      });
    }

    // Buổi bù rơi sau ngày kết thúc dự kiến hiện tại — giãn ngày kết thúc theo thực
    // tế thay vì để hiển thị sai lệch với lịch thật của lớp.
    if (extendedEnd) {
      await tx.class.update({ where: { id: sourceSession.classId }, data: { expectedEndDate: extendedEnd } });
    }

    return makeupSession;
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId: user.branchId,
      action: "create_makeup_session",
      entityType: "ClassSession",
      entityId: result.id,
      before: JSON.stringify({ sourceSessionId: sourceSession.id, sourceSessionDate: sourceSession.sessionDate }),
      after: JSON.stringify({ sessionDate: result.sessionDate, startTime: result.startTime, endTime: result.endTime, room: result.room }),
      reason,
    },
  });

  return NextResponse.json({ item: result }, { status: 201 });
}
