// GÁN PHÒNG CHO MỘT BUỔI HỌC.
//
// Tách riêng khỏi PATCH /api/sessions/[id] vì route đó là đổi TRẠNG THÁI buổi học (kéo
// theo hủy/hoàn ví, thu hồi buổi bổ trợ, kiểm tra kỳ thu đã khóa). Đổi phòng không được
// dính vào chuỗi đó. Trước đây không có đường nào gán phòng cho riêng một buổi — phòng
// chỉ đặt được ở quy tắc lịch của lớp, nên buổi lẻ đổi phòng là chịu.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền đổi phòng buổi học" }, { status: 403 });
  }

  const session = await prisma.classSession.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, sessionDate: true, startTime: true, endTime: true, classId: true },
  });
  if (!session) return NextResponse.json({ error: "Không tìm thấy buổi học" }, { status: 404 });

  const body = await req.json();
  const room = typeof body.room === "string" ? body.room.trim() : "";

  // Cùng phòng, cùng ngày, giờ giao nhau = hai lớp chen nhau một phòng. Cảnh báo chứ
  // không chặn: thực tế vẫn có lúc ghép lớp, nhưng phải cho người xếp biết.
  if (room) {
    const sameRoom = await prisma.classSession.findMany({
      where: {
        id: { not: session.id },
        room,
        sessionDate: session.sessionDate,
        status: { notIn: ["CANCELLED", "RESCHEDULED"] },
      },
      select: { startTime: true, endTime: true, class: { select: { classCode: true, className: true } } },
    });
    const overlapping = sameRoom.filter((other) => {
      if (!session.startTime || !session.endTime || !other.startTime || !other.endTime) return false;
      return session.startTime < other.endTime && other.startTime < session.endTime;
    });
    if (overlapping.length > 0 && !body.allowSharedRoom) {
      return NextResponse.json(
        {
          error: `Phòng ${room} giờ này đang có ${overlapping
            .map((item) => `${item.class.className} (${item.startTime}–${item.endTime})`)
            .join(", ")}. Vẫn xếp chung phòng?`,
          code: "ROOM_BUSY",
        },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.classSession.update({
    where: { id: session.id },
    data: { room: room || null },
    select: { id: true, room: true },
  });

  return NextResponse.json({ item: updated });
}
