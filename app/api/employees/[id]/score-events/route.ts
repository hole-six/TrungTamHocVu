import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const employee = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!employee) return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });

  const body = await req.json();
  const branchId = String(body.branchId ?? "").trim();
  const type = String(body.type ?? "");
  const points = Number(body.points);
  if (!branchId) return NextResponse.json({ error: "Thiếu cơ sở" }, { status: 400 });
  if (!["DEDUCT", "ADD"].includes(type)) return NextResponse.json({ error: "Loại điểm không hợp lệ" }, { status: 400 });
  if (!Number.isFinite(points) || points <= 0) return NextResponse.json({ error: "Số điểm phải lớn hơn 0" }, { status: 400 });
  if (!body.eventDate) return NextResponse.json({ error: "Thiếu ngày" }, { status: 400 });

  const event = await prisma.assistantScoreEvent.create({
    data: {
      employeeId: params.id,
      branchId,
      eventDate: new Date(body.eventDate),
      type,
      points,
      reason: body.reason || null,
      createdById: user.id,
    },
  });

  return NextResponse.json({ item: event }, { status: 201 });
}
