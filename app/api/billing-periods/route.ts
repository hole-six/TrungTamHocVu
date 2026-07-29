import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { monthRange } from "@/lib/server/tuition-rules";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const periods = await prisma.billingPeriod.findMany({
    where: user.branchId ? { branchId: user.branchId } : {},
    orderBy: { periodName: "desc" },
    include: { _count: { select: { charges: true } } },
  });

  return NextResponse.json({ items: periods });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!user.branchId) return NextResponse.json({ error: "Tài khoản chưa gán chi nhánh" }, { status: 400 });

  const body = await req.json();
  const periodName = String(body.periodName ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(periodName)) {
    return NextResponse.json({ error: "Kỳ thu phải theo định dạng YYYY-MM" }, { status: 400 });
  }

  const existing = await prisma.billingPeriod.findUnique({
    where: { branchId_periodName: { branchId: user.branchId, periodName } },
  });
  if (existing) return NextResponse.json({ error: "Kỳ thu này đã tồn tại" }, { status: 409 });

  const { start, end } = monthRange(periodName);
  const period = await prisma.billingPeriod.create({
    data: { branchId: user.branchId, periodName, startDate: start, endDate: end },
  });

  return NextResponse.json({ item: period }, { status: 201 });
}
