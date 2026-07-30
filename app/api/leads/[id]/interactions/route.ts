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
    return NextResponse.json({ error: "Vai trò của bạn không có quyền ghi nhận tương tác" }, { status: 403 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Không tìm thấy lead" }, { status: 404 });

  const body = await req.json();
  const type = String(body.type ?? "").trim();
  if (!["CALL", "MEET", "MESSAGE", "EMAIL"].includes(type)) {
    return NextResponse.json({ error: "Loại tương tác không hợp lệ" }, { status: 400 });
  }

  const interaction = await prisma.leadInteraction.create({
    data: {
      leadId: lead.id,
      employeeId: user.employeeId ?? null,
      type,
      content: body.content || null,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
    },
  });

  return NextResponse.json({ item: interaction }, { status: 201 });
}
