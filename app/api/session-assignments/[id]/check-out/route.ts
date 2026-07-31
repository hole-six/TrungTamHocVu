import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { vnTimeToUtc } from "@/lib/server/class-rules";

// Không giới hạn trên chặt — buổi có thể kéo dài hơn dự kiến — chỉ chặn check-out
// quá xa (>6 tiếng sau giờ kết thúc) để tránh bấm nhầm buổi cũ để quên.
const MAX_LATE_MS = 6 * 60 * 60 * 1000;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const assignment = await prisma.sessionAssignment.findUnique({
    where: { id: params.id },
    include: { employee: { include: { user: true } }, session: true },
  });
  if (!assignment) return NextResponse.json({ error: "Không tìm thấy phân công" }, { status: 404 });

  const role = await getUserRole(user.id);
  const isSelf = assignment.employee.user?.id === user.id;
  if (!isSelf && !canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Bạn không có quyền check-out cho phân công này" }, { status: 403 });
  }
  if (!assignment.checkInAt) {
    return NextResponse.json({ error: "Chưa check-in thì không thể check-out." }, { status: 409 });
  }
  if (assignment.checkOutAt) {
    return NextResponse.json({ error: "Đã check-out buổi này rồi." }, { status: 409 });
  }

  const now = new Date();
  if (assignment.session.endTime) {
    const end = vnTimeToUtc(assignment.session.sessionDate, assignment.session.endTime);
    if (now.getTime() > end.getTime() + MAX_LATE_MS) {
      return NextResponse.json({ error: "Buổi học đã kết thúc quá lâu, liên hệ quản lý để cập nhật thủ công." }, { status: 409 });
    }
  }
  if (now.getTime() < assignment.checkInAt.getTime()) {
    return NextResponse.json({ error: "Giờ check-out không thể trước giờ check-in." }, { status: 409 });
  }

  const updated = await prisma.sessionAssignment.update({ where: { id: params.id }, data: { checkOutAt: now } });
  return NextResponse.json({ item: updated });
}
