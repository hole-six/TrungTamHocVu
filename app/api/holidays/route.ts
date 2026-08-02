import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate, canView } from "@/lib/server/role-matrix";
import { getBranchWhereClause, getValidBranchIdForCreation } from "@/lib/branch-filter";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canView("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xem lịch nghỉ lễ" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const branchWhere = await getBranchWhereClause(searchParams.get("branchId"));

  const items = await prisma.holiday.findMany({
    where: branchWhere,
    orderBy: { date: "asc" },
    include: { branch: { select: { name: true } } },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền khai báo ngày nghỉ lễ" }, { status: 403 });
  }

  const body = await req.json();
  const branchId = await getValidBranchIdForCreation(body.branchId);
  if (!branchId) return NextResponse.json({ error: "Không xác định được cơ sở" }, { status: 400 });

  const name = String(body.name ?? "").trim();
  const dateRaw = String(body.date ?? "").trim();
  if (!name || !dateRaw) return NextResponse.json({ error: "Thiếu tên hoặc ngày nghỉ lễ" }, { status: 400 });

  const [year, month, day] = dateRaw.split("-").map(Number);
  if (!year || !month || !day) return NextResponse.json({ error: "Ngày không hợp lệ" }, { status: 400 });
  const date = new Date(Date.UTC(year, month - 1, day));

  const existing = await prisma.holiday.findUnique({ where: { branchId_date: { branchId, date } } });
  if (existing) return NextResponse.json({ error: "Ngày này đã được khai báo là ngày nghỉ lễ" }, { status: 409 });

  const created = await prisma.holiday.create({ data: { branchId, date, name } });
  return NextResponse.json({ item: created }, { status: 201 });
}
