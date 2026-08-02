import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canCreateWithOverride } from "@/lib/server/role-matrix";
import { getBranchWhereClause, getValidBranchIdForCreation } from "@/lib/branch-filter";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const month = searchParams.get("month"); // "YYYY-MM"

  const where: Record<string, unknown> = { ...(await getBranchWhereClause(searchParams.get("branchId"))) };
  if (type) where.type = type;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    where.txnDate = { gte: new Date(Date.UTC(y, m - 1, 1)), lte: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)) };
  }

  const items = await prisma.cashTransaction.findMany({
    where,
    orderBy: { txnDate: "desc" },
    include: { category: true },
  });

  const totalThu = items.filter((i) => i.type === "THU" && i.status !== "VOIDED").reduce((s, i) => s + i.amount, 0);
  const totalChi = items.filter((i) => i.type === "CHI" && i.status !== "VOIDED").reduce((s, i) => s + i.amount, 0);

  return NextResponse.json({ items, summary: { totalThu, totalChi, balance: totalThu - totalChi } });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const branchId = await getValidBranchIdForCreation();
  if (!branchId) return NextResponse.json({ error: "Tài khoản chưa gán chi nhánh" }, { status: 400 });
  const { role, override } = await getUserRoleAndOverride(user.id, "cashbook");
  if (!canCreateWithOverride("cashbook", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền tạo phiếu thu/chi" }, { status: 403 });
  }

  const body = await req.json();
  const type = String(body.type ?? "").trim();
  const amount = Number(body.amount);
  if (!["THU", "CHI"].includes(type)) return NextResponse.json({ error: "Loại phiếu không hợp lệ" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Số tiền không hợp lệ" }, { status: 400 });

  const txn = await prisma.cashTransaction.create({
    data: {
      branchId,
      type,
      categoryId: body.categoryId || null,
      txnDate: body.txnDate ? new Date(body.txnDate) : new Date(),
      detail: body.detail || null,
      description: body.description || null,
      amount,
      handledById: user.id,
      status: "CONFIRMED",
      notes: body.notes || null,
    },
  });

  return NextResponse.json({ item: txn }, { status: 201 });
}
