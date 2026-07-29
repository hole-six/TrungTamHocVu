import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Chỉ quản trị viên mới xem được" }, { status: 403 });

  const items = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      branchId: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      branch: true,
    },
  });

  return NextResponse.json({ items });
}
