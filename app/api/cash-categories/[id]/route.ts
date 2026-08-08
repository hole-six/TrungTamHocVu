import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "cashbook");
  if (!canUpdateWithOverride("cashbook", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa danh mục thu/chi" }, { status: 403 });
  }

  const existing = await prisma.transactionCategory.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy danh mục" }, { status: 404 });

  const body = await req.json();
  const data: { name?: string; detail?: string | null } = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Thiếu tên danh mục" }, { status: 400 });
    data.name = name;
  }
  if (body.detail !== undefined) data.detail = body.detail || null;

  const category = await prisma.transactionCategory.update({ where: { id: params.id }, data });
  return NextResponse.json({ item: category });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "cashbook");
  if (!canUpdateWithOverride("cashbook", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa danh mục thu/chi" }, { status: 403 });
  }

  const existing = await prisma.transactionCategory.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, _count: { select: { transactions: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy danh mục" }, { status: 404 });

  if (existing._count.transactions > 0) {
    return NextResponse.json(
      { error: `Không thể xóa danh mục này vì còn ${existing._count.transactions} giao dịch đang dùng. Hãy đổi danh mục cho các giao dịch đó trước.` },
      { status: 400 },
    );
  }

  await prisma.transactionCategory.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
