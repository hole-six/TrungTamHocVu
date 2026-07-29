import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const items = await prisma.payrollRun.findMany({
    where: user.branchId ? { branchId: user.branchId } : {},
    orderBy: { periodName: "desc" },
    include: { _count: { select: { lines: true } } },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!user.branchId) return NextResponse.json({ error: "Tài khoản chưa gán chi nhánh" }, { status: 400 });

  const body = await req.json();
  const periodName = String(body.periodName ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(periodName)) {
    return NextResponse.json({ error: "Kỳ lương phải theo định dạng YYYY-MM" }, { status: 400 });
  }

  const existing = await prisma.payrollRun.findUnique({
    where: { branchId_periodName: { branchId: user.branchId, periodName } },
  });
  if (existing) return NextResponse.json({ error: "Kỳ lương này đã tồn tại" }, { status: 409 });

  const run = await prisma.payrollRun.create({ data: { branchId: user.branchId, periodName } });
  return NextResponse.json({ item: run }, { status: 201 });
}
