import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canCreateWithOverride } from "@/lib/server/role-matrix";
import { getBranchWhereClause } from "@/lib/branch-filter";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const books = await prisma.book.findMany({
    where: await getBranchWhereClause(searchParams.get("branchId")),
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ items: books });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!user.branchId) return NextResponse.json({ error: "Tài khoản chưa gán chi nhánh" }, { status: 400 });
  const { role, override } = await getUserRoleAndOverride(user.id, "inventory");
  if (!canCreateWithOverride("inventory", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền thêm đầu sách mới" }, { status: 403 });
  }

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const unitPrice = Number(body.unitPrice);
  if (!name) return NextResponse.json({ error: "Thiếu tên sách/giáo trình" }, { status: 400 });
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return NextResponse.json({ error: "Đơn giá không hợp lệ" }, { status: 400 });
  }

  const book = await prisma.book.create({
    data: {
      branchId: user.branchId,
      bookCode: body.bookCode || null,
      category: body.category || null,
      name,
      unitPrice,
      notes: body.notes || null,
    },
  });

  return NextResponse.json({ item: book }, { status: 201 });
}
