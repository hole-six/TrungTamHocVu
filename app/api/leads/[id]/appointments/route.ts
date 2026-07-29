import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

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
