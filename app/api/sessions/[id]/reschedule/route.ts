import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { computeExtendedEndDate, estimateEndDate, estimateEndDateFromRules } from "@/lib/server/class-rules";
import { computeSessionBaseHours } from "@/lib/server/payroll-rules";
import { getHolidayDateSet } from "@/lib/server/holidays";
import { canAccessBranch } from "@/lib/branch-filter";

// Đổi buổi = 1-1: buổi gốc chuyển RESCHEDULED, tạo đúng 1 buổi bù mới trỏ ngược lại
// (replacesSessionId) — không được để mất buổi hoặc dư buổi so với tổng đã tính.
// Phân công GV/TG copy sang buổi bù (đúng người tiếp tục dạy lớp đó), snapshot lại
// hours/hourlyRate/amount theo khung giờ của buổi BÙ (giống hệt cách class-generation.ts
// và assignments/route.ts snapshot lúc phân công) — buổi gốc đã RESCHEDULED nên bị loại
// khỏi payroll qua filter status COMPLETED, không cần đụng tới số cũ của nó.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền đổi buổi học" }, { status: 403 });
  }

  const original = await prisma.classSession.findUnique({
    where: { id: params.id },
    include: { assignments: { include: { employee: true } }, replacedBySession: true, class: { include: { scheduleRules: true } } },
  });
  if (original && !(await canAccessBranch(original.class.branchId))) {
    return NextResponse.json({ error: "Khong co quyen truy cap co so cua lop nay" }, { status: 403 });
  }
  if (!original) return NextResponse.json({ error: "Không tìm thấy buổi học" }, { status: 404 });
  if (original.status === "CANCELLED" || original.status === "RESCHEDULED") {
    return NextResponse.json({ error: `Buổi đang ở trạng thái "${original.status}", không thể đổi buổi tiếp.` }, { status: 409 });
  }
  if (original.replacedBySession) {
    return NextResponse.json({ error: "Buổi này đã có buổi bù, không thể đổi thêm lần nữa." }, { status: 409 });
  }
  if (original.status === "COMPLETED") {
    return NextResponse.json({ error: "Buoi da hoan thanh khong the doi lich" }, { status: 409 });
  }

  const body = await req.json();
  const newDate = body.newDate ? new Date(body.newDate) : null;
  if (!newDate || Number.isNaN(newDate.getTime())) {
    return NextResponse.json({ error: "Thiếu hoặc sai ngày bù." }, { status: 400 });
  }
  const reason = body.reason ? String(body.reason).trim() : null;
  const nextStartTime = body.startTime || original.startTime;
  const nextEndTime = body.endTime || original.endTime;
  if (!nextStartTime || !nextEndTime || nextStartTime >= nextEndTime) {
    return NextResponse.json({ error: "Khung gio buoi doi khong hop le" }, { status: 400 });
  }
  const conflict = await prisma.classSession.findFirst({
    where: {
      classId: original.classId,
      id: { not: original.id },
      sessionDate: newDate,
      startTime: { lt: nextEndTime },
      endTime: { gt: nextStartTime },
      status: { notIn: ["CANCELLED", "RESCHEDULED"] },
    },
  });
  if (conflict) return NextResponse.json({ error: "Lớp đã có buổi học trùng hoặc chồng giờ" }, { status: 409 });

  const holidayDates = await getHolidayDateSet(original.class.branchId);
  const currentEnd =
    original.class.expectedEndDate ??
    estimateEndDateFromRules(original.class.startDate, original.class.totalSessions, original.class.scheduleRules, holidayDates) ??
    estimateEndDate(original.class.startDate, original.class.totalSessions, original.class.sessionsPerWeek);
  const extendedEnd = computeExtendedEndDate(currentEnd, newDate);

  const result = await prisma.$transaction(async (tx) => {
    const makeupSession = await tx.classSession.create({
      data: {
        classId: original.classId,
        sessionDate: newDate,
        startTime: nextStartTime,
        endTime: nextEndTime,
        room: body.room || original.room,
        status: "PLANNED",
        replacesSessionId: original.id,
        notes: reason,
      },
    });

    if (original.assignments.length > 0) {
      await tx.sessionAssignment.createMany({
        data: original.assignments.map((assignment) => {
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

    const updatedOriginal = await tx.classSession.update({
      where: { id: original.id },
      data: {
        status: "RESCHEDULED",
        notes: reason ? `Đã dời sang ${newDate.toLocaleDateString("vi-VN")}: ${reason}` : `Đã dời sang ${newDate.toLocaleDateString("vi-VN")}`,
      },
    });

    // Buổi dời sang rơi sau ngày kết thúc dự kiến hiện tại — giãn ngày kết thúc theo
    // thực tế thay vì để hiển thị sai lệch với lịch thật của lớp.
    if (extendedEnd) {
      await tx.class.update({ where: { id: original.classId }, data: { expectedEndDate: extendedEnd } });
    }

    return { makeupSession, updatedOriginal };
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId: user.branchId,
      action: "reschedule",
      entityType: "ClassSession",
      entityId: original.id,
      before: JSON.stringify({ status: original.status, sessionDate: original.sessionDate }),
      after: JSON.stringify({ status: "RESCHEDULED", makeupSessionId: result.makeupSession.id, newDate }),
      reason,
    },
  });

  return NextResponse.json({ item: result.makeupSession, original: result.updatedOriginal }, { status: 201 });
}
