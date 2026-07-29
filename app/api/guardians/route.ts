import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  const items = await prisma.guardian.findMany({
    where: q ? { OR: [{ fullName: { contains: q } }, { phone: { contains: q } }] } : {},
    orderBy: { fullName: "asc" },
    include: { _count: { select: { leads: true, students: true } } },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await req.json();
  const fullName = String(body.fullName ?? "").trim();
  if (!fullName) return NextResponse.json({ error: "Thiếu họ tên phụ huynh" }, { status: 400 });

  const guardian = await prisma.guardian.create({
    data: { fullName, phone: body.phone || null, address: body.address || null, notes: body.notes || null },
  });

  return NextResponse.json({ item: guardian }, { status: 201 });
}
