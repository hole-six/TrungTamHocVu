import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

// Các buổi TƯƠNG LAI của học viên, chỉ tính lớp học viên đang ACTIVE — dùng cho tab
// "Học sinh toàn khóa" của RemedialSessionRoster: chọn đúng buổi cần "học bù trước".
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const activeEnrollments = await prisma.enrollment.findMany({
    where: { studentId: params.id, status: "ACTIVE" },
    select: { classId: true },
  });
  if (activeEnrollments.length === 0) return NextResponse.json({ items: [] });

  const sessions = await prisma.classSession.findMany({
    where: {
      classId: { in: activeEnrollments.map((e) => e.classId) },
      status: { notIn: ["CANCELLED", "RESCHEDULED", "COMPLETED"] },
      sessionDate: { gte: new Date() },
    },
    select: { id: true, sessionDate: true, startTime: true, endTime: true, class: { select: { className: true } } },
    orderBy: { sessionDate: "asc" },
    take: 60,
  });

  return NextResponse.json({ items: sessions });
}
