import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import { recalculateClassScheduleDerivedFields } from "@/lib/server/database-sync";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa lịch học" }, { status: 403 });
  }

  const cls = await prisma.class.findUnique({ where: { id: params.id } });
  if (cls && !(await canAccessBranch(cls.branchId))) {
    return NextResponse.json({ error: "Khong co quyen truy cap co so cua lop nay" }, { status: 403 });
  }
  if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });

  const body = await req.json();
  const weekday = Number(body.weekday);
  const startTime = String(body.startTime ?? "").trim();
  const endTime = String(body.endTime ?? "").trim();

  if (!startTime || !endTime || startTime >= endTime) {
    return NextResponse.json({ error: "Khung gio hoc khong hop le" }, { status: 400 });
  }

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return NextResponse.json({ error: "Thứ trong tuần không hợp lệ" }, { status: 400 });
  }
  if (!startTime || !endTime) return NextResponse.json({ error: "Thiếu giờ bắt đầu/kết thúc" }, { status: 400 });

  const duplicate = await prisma.scheduleRule.findFirst({
    where: {
      classId: cls.id,
      weekday,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      isActive: true,
    },
  });
  if (duplicate) return NextResponse.json({ error: "Lịch học bị trùng hoặc chồng giờ với lịch đang có" }, { status: 409 });

  const rule = await prisma.scheduleRule.create({
    data: { classId: cls.id, weekday, startTime, endTime, room: body.room || null },
  });
  await recalculateClassScheduleDerivedFields(cls.id);

  return NextResponse.json({ item: rule }, { status: 201 });
}
