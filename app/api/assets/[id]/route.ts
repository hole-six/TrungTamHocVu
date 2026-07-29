import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeAssetQuantity } from "@/lib/server/asset-rules";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const asset = await prisma.asset.findUnique({
    where: { id: params.id },
    include: { transactions: { orderBy: { txnDate: "desc" } } },
  });
  if (!asset) return NextResponse.json({ error: "Không tìm thấy tài sản" }, { status: 404 });

  const quantity = await computeAssetQuantity(asset.id);
  return NextResponse.json({ item: asset, quantity });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of ["name", "category", "room", "status", "notes"]) {
    if (field in body) data[field] = body[field] || null;
  }
  if ("unitValue" in body) data.unitValue = body.unitValue === "" || body.unitValue === null ? null : Number(body.unitValue);

  const asset = await prisma.asset.update({ where: { id: params.id }, data });
  return NextResponse.json({ item: asset });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const txnCount = await prisma.assetTransaction.count({ where: { assetId: params.id } });
  if (txnCount > 1) {
    return NextResponse.json({ error: "Tài sản đã có lịch sử giao dịch, chuyển trạng thái 'Đã thanh lý' thay vì xóa." }, { status: 409 });
  }
  await prisma.assetTransaction.deleteMany({ where: { assetId: params.id } });
  await prisma.asset.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
