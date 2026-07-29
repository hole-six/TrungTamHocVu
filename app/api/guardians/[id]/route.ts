import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const guardian = await prisma.guardian.findUnique({
    where: { id: params.id },
    include: {
      leads: { orderBy: { createdAt: "desc" } },
      students: { include: { student: true } },
    },
  });
  if (!guardian) return NextResponse.json({ error: "Không tìm thấy phụ huynh" }, { status: 404 });

  return NextResponse.json({ item: guardian });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of ["fullName", "phone", "address", "notes"]) {
    if (field in body) data[field] = body[field] || null;
  }

  const guardian = await prisma.guardian.update({ where: { id: params.id }, data });
  return NextResponse.json({ item: guardian });
}
