import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await req.json();
  const percentage = Number(body.percentage);
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 1) {
    return NextResponse.json({ error: "Tỉ lệ học bổng phải trong khoảng 0–1 (vd 0.2 = 20%)" }, { status: 400 });
  }

  const scholarship = await prisma.scholarship.create({
    data: {
      studentId: params.id,
      percentage,
      reason: body.reason || null,
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
      effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
    },
  });

  return NextResponse.json({ item: scholarship }, { status: 201 });
}
