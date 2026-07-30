import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

const VALID = ["SCHEDULED", "DONE", "MISSED", "CANCELLED"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("leads", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền cập nhật lịch hẹn" }, { status: 403 });
  }

  const body = await req.json();
  if (!VALID.includes(body.status)) return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });

  const appointment = await prisma.appointment.update({ where: { id: params.id }, data: { status: body.status } });
  return NextResponse.json({ item: appointment });
}
