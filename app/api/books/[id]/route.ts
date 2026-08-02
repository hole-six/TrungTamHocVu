import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeStockBalance } from "@/lib/server/inventory-rules";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride, canDeleteWithOverride } from "@/lib/server/role-matrix";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const book = await prisma.book.findUnique({
    where: { id: params.id },
    include: {
      stockTransactions: { orderBy: { txnDate: "desc" }, take: 30 },
      bookIssues: { include: { student: true, class: true }, orderBy: { issueDate: "desc" }, take: 30 },
    },
  });
  if (!book) return NextResponse.json({ error: "Không tìm thấy sách" }, { status: 404 });
  if (user.branchId && book.branchId !== user.branchId) {
    return NextResponse.json({ error: "Sách không thuộc chi nhánh của bạn" }, { status: 403 });
  }

  const balance = await computeStockBalance(book.id);
  return NextResponse.json({ item: book, balance });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "inventory");
  if (!canUpdateWithOverride("inventory", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa sách" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("name" in body) data.name = String(body.name).trim();
  if ("category" in body) data.category = body.category || null;
  if ("purchasePrice" in body) {
    const purchasePrice = Number(body.purchasePrice);
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      return NextResponse.json({ error: "Đơn giá nhập không hợp lệ" }, { status: 400 });
    }
    data.purchasePrice = purchasePrice;
  }
  if ("unitPrice" in body) {
    const unitPrice = Number(body.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return NextResponse.json({ error: "Đơn giá bán không hợp lệ" }, { status: 400 });
    }
    data.unitPrice = unitPrice;
  }
  if ("usageStatus" in body) data.usageStatus = body.usageStatus || null;
  if ("notes" in body) data.notes = body.notes || null;

  const book = await prisma.book.update({ where: { id: params.id }, data });
  return NextResponse.json({ item: book });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "inventory");
  if (!canDeleteWithOverride("inventory", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa sách" }, { status: 403 });
  }

  const [txnCount, issueCount] = await Promise.all([
    prisma.stockTransaction.count({ where: { bookId: params.id } }),
    prisma.bookIssue.count({ where: { bookId: params.id } }),
  ]);
  if (txnCount > 0 || issueCount > 0) {
    return NextResponse.json({ error: "Sách đã có giao dịch kho, không thể xóa." }, { status: 409 });
  }
  await prisma.book.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
