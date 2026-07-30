import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("leads", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền tạo lịch hẹn" }, { status: 403 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Không tìm thấy lead" }, { status: 404 });

  const body = await req.json();
  if (!body.scheduledAt) return NextResponse.json({ error: "Thiếu thời gian hẹn" }, { status: 400 });

  const appointment = await prisma.appointment.create({
    data: {
      leadId: lead.id,
      employeeId: user.employeeId ?? null,
      scheduledAt: new Date(body.scheduledAt),
      notes: body.notes || null,
    },
  });

  return NextResponse.json({ item: appointment }, { status: 201 });
}
