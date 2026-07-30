import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

// Điểm danh vẫn cho phép GV/TG (canUpdate("schedule") = false với 2 vai trò này) vì đây
// là việc dạy học hàng ngày, khác với quản lý lịch/ghi danh — xem giải thích tương tự ở
// app/(app)/classes/[id]/sessions/[sessionId]/page.tsx.
async function canMarkAttendance(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return canUpdate("schedule", role) || role === "TEACHER" || role === "TEACHING_ASSISTANT";
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const session = await prisma.classSession.findUnique({
    where: { id: params.id },
    include: { attendances: true },
  });
  if (!session) return NextResponse.json({ error: "Không tìm thấy buổi học" }, { status: 404 });

  const activeEnrollments = await prisma.enrollment.findMany({
    where: { classId: session.classId, status: "ACTIVE" },
    include: { student: true },
    orderBy: { student: { fullName: "asc" } },
  });

  const attendanceByStudent = Object.fromEntries(session.attendances.map((a) => [a.studentId, a.status]));

  const roster = activeEnrollments.map((e) => ({
    studentId: e.studentId,
    fullName: e.student.fullName,
    studentCode: e.student.studentCode,
    status: attendanceByStudent[e.studentId] ?? "PRESENT",
  }));

  return NextResponse.json({ roster, sessionStatus: session.status });
}

// Lưu điểm danh cho cả lớp trong 1 buổi — đồng thời đánh dấu buổi học là đã hoàn
// thành (việc điểm danh tức là buổi học đã diễn ra), thay cho cột TTHoc (C/K) cấp
// lớp trong ChiTietLopHoc gốc nhưng chuẩn hóa xuống cấp học viên.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!(await canMarkAttendance(user.id))) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền điểm danh" }, { status: 403 });
  }

  const session = await prisma.classSession.findUnique({ where: { id: params.id } });
  if (!session) return NextResponse.json({ error: "Không tìm thấy buổi học" }, { status: 404 });

  const body = await req.json();
  const records: { studentId: string; status: string }[] = body.records ?? [];
  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: "Thiếu danh sách điểm danh" }, { status: 400 });
  }

  await prisma.$transaction([
    ...records.map((r) =>
      prisma.studentAttendance.upsert({
        where: { sessionId_studentId: { sessionId: session.id, studentId: r.studentId } },
        create: { sessionId: session.id, studentId: r.studentId, status: r.status },
        update: { status: r.status },
      })
    ),
    prisma.classSession.update({
      where: { id: session.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
