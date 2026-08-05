import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { SESSION_STATUSES } from "@/lib/server/class-rules";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa buổi học" }, { status: 403 });
  }

  const body = await req.json();
  if (!SESSION_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Trạng thái buổi học không hợp lệ" }, { status: 400 });
  }

  const existing = await prisma.classSession.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy buổi học" }, { status: 404 });

  // Hủy 1 buổi đã hoàn thành coi như buổi đó chưa từng diễn ra: xóa điểm danh (để
  // absentCount không còn tính nhầm buổi này khi sinh học phí — xem generateChargesForPeriod)
  // và hoàn lại buổi bổ trợ đã dùng để học bù vào chính buổi này (mirror logic present->absent
  // ở app/api/sessions/[id]/attendance/route.ts).
  const updated = await prisma.$transaction(async (tx) => {
    if (existing.status === "COMPLETED" && body.status === "CANCELLED") {
      await tx.sessionCredit.updateMany({
        where: { consumedSessionId: params.id, status: "CONSUMED" },
        data: { status: "AVAILABLE", consumedSessionId: null, consumedAt: null },
      });
      await tx.studentAttendance.deleteMany({ where: { sessionId: params.id } });
    }

    return tx.classSession.update({
      where: { id: params.id },
      data: {
        status: body.status,
        completedAt: body.status === "COMPLETED" ? new Date() : null,
        notes: "notes" in body ? body.notes || null : undefined,
      },
    });
  });

  return NextResponse.json({ item: updated });
}
