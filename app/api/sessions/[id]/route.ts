import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { SESSION_STATUSES } from "@/lib/server/class-rules";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await req.json();
  if (!SESSION_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Trạng thái buổi học không hợp lệ" }, { status: 400 });
  }

  const updated = await prisma.classSession.update({
    where: { id: params.id },
    data: {
      status: body.status,
      completedAt: body.status === "COMPLETED" ? new Date() : null,
      notes: "notes" in body ? body.notes || null : undefined,
    },
  });

  return NextResponse.json({ item: updated });
}
