import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền ghi danh học viên" }, { status: 403 });
  }

  const cls = await prisma.class.findUnique({ where: { id: params.id } });
  if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });

  const body = await req.json();
  const studentId = String(body.studentId ?? "").trim();
  if (!studentId) return NextResponse.json({ error: "Thiếu học viên" }, { status: 400 });

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });

  const existingActive = await prisma.enrollment.findFirst({
    where: { studentId, classId: cls.id, status: { in: ["PENDING", "ACTIVE", "PAUSED"] } },
  });
  if (existingActive) {
    return NextResponse.json({ error: "Học viên đã ghi danh lớp này rồi" }, { status: 409 });
  }

  const enrollment = await prisma.$transaction(async (tx) => {
    const created = await tx.enrollment.create({
      data: {
        studentId,
        classId: cls.id,
        status: "ACTIVE",
        enrollDate: body.enrollDate ? new Date(body.enrollDate) : new Date(),
      },
    });
    await tx.enrollmentStatusHistory.create({
      data: { studentId, enrollmentId: created.id, toStatus: "ACTIVE", changedById: user.id },
    });
    return created;
  });

  return NextResponse.json({ item: enrollment }, { status: 201 });
}
