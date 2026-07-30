import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const items = await prisma.transactionCategory.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "cashbook");
  if (!canUpdateWithOverride("cashbook", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền tạo danh mục thu/chi" }, { status: 403 });
  }

  const body = await req.json();
  const type = String(body.type ?? "").trim();
  const name = String(body.name ?? "").trim();
  if (!["THU", "CHI"].includes(type)) return NextResponse.json({ error: "Loại danh mục không hợp lệ" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Thiếu tên danh mục" }, { status: 400 });

  const category = await prisma.transactionCategory.create({
    data: { type, name, detail: body.detail || null },
  });

  return NextResponse.json({ item: category }, { status: 201 });
}
