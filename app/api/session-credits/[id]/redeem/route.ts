import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

// Đăng ký "lớp bảo trợ" (học bù) bằng 1 buổi bổ trợ — chọn buổi đích (bất kỳ buổi nào,
// thường cùng khóa/trình độ, không nhất thiết cùng lớp học viên đang ghi danh) rồi
// đánh dấu điểm danh MAKEUP ở đó cho học viên. Credit chuyển CONSUMED, gắn với đúng
// buổi đã dùng để tra soát sau này (buổi nào bù cho buổi nào).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền đăng ký học bù" }, { status: 403 });
  }

  const credit = await prisma.sessionCredit.findUnique({ where: { id: params.id } });
  if (!credit) return NextResponse.json({ error: "Không tìm thấy buổi bổ trợ" }, { status: 404 });
  if (credit.status !== "AVAILABLE") {
    return NextResponse.json({ error: `Buổi bổ trợ này đang ở trạng thái "${credit.status}", không thể đăng ký học bù.` }, { status: 409 });
  }

  const body = await req.json();
  const targetSessionId = String(body.targetSessionId ?? "").trim();
  if (!targetSessionId) return NextResponse.json({ error: "Thiếu buổi học bù" }, { status: 400 });
  if (targetSessionId === credit.sourceSessionId) {
    return NextResponse.json({ error: "Buổi học bù phải khác buổi đã vắng." }, { status: 400 });
  }

  const targetSession = await prisma.classSession.findUnique({ where: { id: targetSessionId } });
  if (!targetSession) return NextResponse.json({ error: "Không tìm thấy buổi học bù" }, { status: 404 });
  if (targetSession.status === "CANCELLED") {
    return NextResponse.json({ error: "Buổi này đã bị hủy, không thể đăng ký học bù vào đây." }, { status: 409 });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.studentAttendance.upsert({
      where: { sessionId_studentId: { sessionId: targetSessionId, studentId: credit.studentId } },
      create: { sessionId: targetSessionId, studentId: credit.studentId, status: "MAKEUP" },
      update: { status: "MAKEUP" },
    });
    return tx.sessionCredit.update({
      where: { id: credit.id },
      data: { status: "CONSUMED", consumedSessionId: targetSessionId, consumedAt: new Date() },
    });
  });

  return NextResponse.json({ item: result });
}
