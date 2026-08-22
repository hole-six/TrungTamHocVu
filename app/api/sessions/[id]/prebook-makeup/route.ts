import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

// "Học bù trước" — học viên chưa từng vắng buổi nào, nhưng muốn học trước 1 buổi
// tương lai trong lịch của lớp đang học chính, thông qua 1 buổi ở lớp bổ trợ diễn ra
// SỚM HƠN. Tạo credit CONSUMED ngay (không đi qua trạng thái AVAILABLE) để không thể
// bị đăng ký học bù 2 lần, đồng thời khóa buổi tương lai thành ABSENT ngay từ bây giờ
// — khi tới ngày đó, attendance/route.ts sẽ thấy khóa và không cho sửa, cũng không
// sinh thêm credit mới (xem session-credit-lessons.ts / attendance route GET "locked").
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền đăng ký học bù trước" }, { status: 403 });
  }

  const session = await prisma.classSession.findUnique({
    where: { id: params.id },
    include: { class: true },
  });
  if (!session) return NextResponse.json({ error: "Không tìm thấy buổi bổ trợ" }, { status: 404 });
  if (!session.class.isRemedial) {
    return NextResponse.json({ error: "Chỉ đặt học bù trước ở buổi thuộc lớp bổ trợ." }, { status: 400 });
  }

  const body = await req.json();
  const studentId = String(body.studentId ?? "").trim();
  const futureSessionId = String(body.futureSessionId ?? "").trim();
  if (!studentId || !futureSessionId) {
    return NextResponse.json({ error: "Thiếu học viên hoặc buổi tương lai cần học bù trước" }, { status: 400 });
  }

  const futureSession = await prisma.classSession.findUnique({
    where: { id: futureSessionId },
    include: { class: true },
  });
  if (!futureSession) return NextResponse.json({ error: "Không tìm thấy buổi tương lai" }, { status: 404 });
  if (futureSession.sessionDate.getTime() <= session.sessionDate.getTime()) {
    return NextResponse.json({ error: "Buổi cần học bù trước phải diễn ra sau buổi bổ trợ hôm nay." }, { status: 400 });
  }
  if (["CANCELLED", "RESCHEDULED", "COMPLETED"].includes(futureSession.status)) {
    return NextResponse.json({ error: `Buổi tương lai đang ở trạng thái "${futureSession.status}", không thể đặt học bù trước.` }, { status: 409 });
  }

  const futureEnrollment = await prisma.enrollment.findFirst({
    where: { studentId, classId: futureSession.classId, status: "ACTIVE" },
  });
  if (!futureEnrollment) {
    return NextResponse.json({ error: "Học viên chưa có ghi danh đang hoạt động ở lớp có buổi tương lai này." }, { status: 409 });
  }

  const [existingFutureAttendance, existingTodayAttendance] = await Promise.all([
    prisma.studentAttendance.findUnique({ where: { sessionId_studentId: { sessionId: futureSessionId, studentId } } }),
    prisma.studentAttendance.findUnique({ where: { sessionId_studentId: { sessionId: session.id, studentId } } }),
  ]);
  if (existingFutureAttendance) {
    return NextResponse.json({ error: "Buổi tương lai này đã có điểm danh, không thể đặt học bù trước." }, { status: 409 });
  }
  if (existingTodayAttendance) {
    return NextResponse.json({ error: "Học viên đã có mặt trong buổi bổ trợ này rồi." }, { status: 409 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const credit = await tx.sessionCredit.create({
      data: {
        studentId,
        enrollmentId: futureEnrollment.id,
        sourceSessionId: futureSessionId,
        status: "CONSUMED",
        origin: "MANUAL",
        consumedSessionId: session.id,
        consumedAt: new Date(),
        notes: `Học bù trước buổi ${futureSession.sessionDate.toLocaleDateString("vi-VN")} (${futureSession.class.className})`,
      },
    });
    await tx.studentAttendance.create({
      data: { sessionId: futureSessionId, studentId, status: "ABSENT" },
    });
    await tx.studentAttendance.upsert({
      where: { sessionId_studentId: { sessionId: session.id, studentId } },
      create: { sessionId: session.id, studentId, status: "MAKEUP" },
      update: { status: "MAKEUP" },
    });
    return credit;
  });

  return NextResponse.json({ item: result });
}
