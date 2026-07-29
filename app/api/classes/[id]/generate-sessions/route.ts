import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { generateSessionDates } from "@/lib/server/class-rules";

// Sinh ClassSession từ ScheduleRule trong khoảng ngày — thay cho việc gõ tay từng
// dòng "Ngay thang" như ChiTietLopHoc gốc. Bỏ qua ngày đã có buổi học để tránh
// sinh trùng khi bấm nhiều lần hoặc chạy nối tiếp từng đợt.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const cls = await prisma.class.findUnique({ where: { id: params.id }, include: { scheduleRules: true } });
  if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });
  if (cls.scheduleRules.length === 0) {
    return NextResponse.json({ error: "Lớp chưa có quy tắc lịch (thứ/giờ học) để sinh buổi" }, { status: 400 });
  }

  const body = await req.json();
  if (!body.fromDate || !body.toDate) return NextResponse.json({ error: "Thiếu khoảng ngày" }, { status: 400 });
  const fromDate = new Date(body.fromDate);
  const toDate = new Date(body.toDate);
  if (toDate.getTime() - fromDate.getTime() > 1000 * 60 * 60 * 24 * 120) {
    return NextResponse.json({ error: "Khoảng ngày tối đa 120 ngày mỗi lần sinh" }, { status: 400 });
  }

  const candidates = generateSessionDates(cls.scheduleRules, fromDate, toDate);

  const existing = await prisma.classSession.findMany({
    where: { classId: cls.id, sessionDate: { gte: fromDate, lte: toDate } },
    select: { sessionDate: true },
  });
  const existingDates = new Set(existing.map((s) => s.sessionDate.toISOString().slice(0, 10)));

  const toCreate = candidates.filter((c) => !existingDates.has(c.sessionDate.toISOString().slice(0, 10)));

  if (toCreate.length > 0) {
    await prisma.classSession.createMany({
      data: toCreate.map((c) => ({
        classId: cls.id,
        sessionDate: c.sessionDate,
        startTime: c.startTime,
        endTime: c.endTime,
        room: c.room,
        status: "PLANNED",
      })),
    });
  }

  return NextResponse.json({ created: toCreate.length, skipped: candidates.length - toCreate.length });
}
