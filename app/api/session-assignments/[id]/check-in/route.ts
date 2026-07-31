import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { vnTimeToUtc } from "@/lib/server/class-rules";

// Cho check-in sớm 15 phút trước giờ vào lớp, muộn tối đa 60 phút sau giờ kết thúc —
// khoảng RỘNG chứ không phải "đúng giờ" theo nghĩa đen, vì khóa cứng đúng khoảnh khắc
// sẽ kẹt ngay khi GV đến sớm/trễ mạng/buổi kéo dài hơn dự kiến.
const EARLY_MS = 15 * 60 * 1000;
const LATE_MS = 60 * 60 * 1000;

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
    return NextResponse.json({ error: "Bạn không có quyền check-in cho phân công này" }, { status: 403 });
  }
  if (assignment.checkInAt) {
    return NextResponse.json({ error: "Đã check-in buổi này rồi." }, { status: 409 });
  }
  if (!assignment.session.startTime || !assignment.session.endTime) {
    return NextResponse.json({ error: "Buổi học chưa có khung giờ, không thể check-in." }, { status: 400 });
  }

  const start = vnTimeToUtc(assignment.session.sessionDate, assignment.session.startTime);
  const end = vnTimeToUtc(assignment.session.sessionDate, assignment.session.endTime);
  const now = new Date();
  if (now.getTime() < start.getTime() - EARLY_MS || now.getTime() > end.getTime() + LATE_MS) {
    return NextResponse.json(
      {
        error: `Chỉ check-in được từ ${new Date(start.getTime() - EARLY_MS).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })} đến ${new Date(end.getTime() + LATE_MS).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })} (giờ VN).`,
      },
      { status: 409 }
    );
  }

  const updated = await prisma.sessionAssignment.update({ where: { id: params.id }, data: { checkInAt: now } });
  return NextResponse.json({ item: updated });
}
