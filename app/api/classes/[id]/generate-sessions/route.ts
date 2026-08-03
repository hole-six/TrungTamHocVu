import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { createSessionsInRange } from "@/lib/server/class-generation";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";

// Sinh ClassSession từ ScheduleRule trong khoảng ngày — thay cho việc gõ tay từng
// dòng "Ngay thang" như ChiTietLopHoc gốc. Bỏ qua ngày đã có buổi học để tránh
// sinh trùng khi bấm nhiều lần hoặc chạy nối tiếp từng đợt.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sinh buổi học" }, { status: 403 });
  }

  const cls = await prisma.class.findUnique({
    where: { id: params.id },
    include: { scheduleRules: { where: { isActive: true } } },
  });
  if (cls && !(await canAccessBranch(cls.branchId))) {
    return NextResponse.json({ error: "Không có quyền truy cập cơ sở của lớp này" }, { status: 403 });
  }
  if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });
  if (cls.scheduleRules.length === 0) {
    return NextResponse.json({ error: "Lớp chưa có quy tắc lịch (thứ/giờ học) để sinh buổi" }, { status: 400 });
  }

  const body = await req.json();
  if (!body.fromDate || !body.toDate) return NextResponse.json({ error: "Thiếu khoảng ngày" }, { status: 400 });
  const fromDate = new Date(body.fromDate);
  const toDate = new Date(body.toDate);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
    return NextResponse.json({ error: "Khoảng ngày sinh buổi học không hợp lệ" }, { status: 400 });
  }
  if (toDate.getTime() - fromDate.getTime() > 1000 * 60 * 60 * 24 * 120) {
    return NextResponse.json({ error: "Khoảng ngày tối đa 120 ngày mỗi lần sinh" }, { status: 400 });
  }

  const result = await createSessionsInRange(cls.id, fromDate, toDate);
  return NextResponse.json(result);
}
