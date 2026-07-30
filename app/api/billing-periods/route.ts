import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { ensureBillingPeriod } from "@/lib/server/billing-generation";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { getBranchWhereClause } from "@/lib/branch-filter";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const periods = await prisma.billingPeriod.findMany({
    where: await getBranchWhereClause(searchParams.get("branchId")),
    orderBy: { periodName: "desc" },
    include: { _count: { select: { charges: true } } },
  });

  return NextResponse.json({ items: periods });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!user.branchId) return NextResponse.json({ error: "Tài khoản chưa gán chi nhánh" }, { status: 400 });
  const { role, override } = await getUserRoleAndOverride(user.id, "tuition");
  if (!canUpdateWithOverride("tuition", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền tạo kỳ thu học phí" }, { status: 403 });
  }

  const body = await req.json();
  const periodName = String(body.periodName ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(periodName)) {
    return NextResponse.json({ error: "Kỳ thu phải theo định dạng YYYY-MM" }, { status: 400 });
  }

  const existing = await prisma.billingPeriod.findUnique({
    where: { branchId_periodName: { branchId: user.branchId, periodName } },
  });
  if (existing) return NextResponse.json({ error: "Kỳ thu này đã tồn tại" }, { status: 409 });

  const period = await ensureBillingPeriod(user.branchId, periodName);
  return NextResponse.json({ item: period }, { status: 201 });
}
