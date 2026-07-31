import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

// Đổi buổi = 1-1: buổi gốc chuyển RESCHEDULED, tạo đúng 1 buổi bù mới trỏ ngược lại
// (replacesSessionId) — không được để mất buổi hoặc dư buổi so với tổng đã tính.
// Phân công GV/TG copy sang buổi bù (đúng người tiếp tục dạy lớp đó), nhưng KHÔNG
// copy giờ công/tiền công đã snapshot của buổi gốc — buổi bù chưa diễn ra, giờ công
// phải tính lại từ đầu khi buổi đó thực sự xảy ra, copy số cũ sẽ làm sai lương.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền đổi buổi học" }, { status: 403 });
  }

  const original = await prisma.classSession.findUnique({
    where: { id: params.id },
    include: { assignments: true, replacedBySession: true },
  });
  if (!original) return NextResponse.json({ error: "Không tìm thấy buổi học" }, { status: 404 });
  if (original.status === "CANCELLED" || original.status === "RESCHEDULED") {
    return NextResponse.json({ error: `Buổi đang ở trạng thái "${original.status}", không thể đổi buổi tiếp.` }, { status: 409 });
  }
  if (original.replacedBySession) {
    return NextResponse.json({ error: "Buổi này đã có buổi bù, không thể đổi thêm lần nữa." }, { status: 409 });
  }

  const body = await req.json();
  const newDate = body.newDate ? new Date(body.newDate) : null;
  if (!newDate || Number.isNaN(newDate.getTime())) {
    return NextResponse.json({ error: "Thiếu hoặc sai ngày bù." }, { status: 400 });
  }
  const reason = body.reason ? String(body.reason).trim() : null;

  const result = await prisma.$transaction(async (tx) => {
    const makeupSession = await tx.classSession.create({
      data: {
        classId: original.classId,
        sessionDate: newDate,
        startTime: body.startTime || original.startTime,
        endTime: body.endTime || original.endTime,
        room: body.room || original.room,
        status: "PLANNED",
        replacesSessionId: original.id,
        notes: reason,
      },
    });

    if (original.assignments.length > 0) {
      await tx.sessionAssignment.createMany({
        data: original.assignments.map((assignment) => ({
          sessionId: makeupSession.id,
          employeeId: assignment.employeeId,
          role: assignment.role,
        })),
      });
    }

    const updatedOriginal = await tx.classSession.update({
      where: { id: original.id },
      data: {
        status: "RESCHEDULED",
        notes: reason ? `Đã dời sang ${newDate.toLocaleDateString("vi-VN")}: ${reason}` : `Đã dời sang ${newDate.toLocaleDateString("vi-VN")}`,
      },
    });

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
