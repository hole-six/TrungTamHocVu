import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeAssetQuantity } from "@/lib/server/asset-rules";

const VALID_TYPES = ["RECEIPT", "TRANSFER", "ADJUSTMENT", "DISPOSAL"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const asset = await prisma.asset.findUnique({ where: { id: params.id } });
  if (!asset) return NextResponse.json({ error: "Không tìm thấy tài sản" }, { status: 404 });

  const body = await req.json();
  const type = String(body.type ?? "");
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: "Loại giao dịch không hợp lệ" }, { status: 400 });

  let quantity = 0;
  if (type === "RECEIPT") {
    quantity = Math.abs(Number(body.quantity ?? 0));
    if (quantity <= 0) return NextResponse.json({ error: "Số lượng nhập phải lớn hơn 0" }, { status: 400 });
  } else if (type === "DISPOSAL") {
    const current = await computeAssetQuantity(asset.id);
    quantity = -Math.min(Math.abs(Number(body.quantity ?? current)), current);
    if (quantity === 0) return NextResponse.json({ error: "Không có số lượng để thanh lý" }, { status: 400 });
  } else if (type === "ADJUSTMENT") {
    quantity = Number(body.quantity ?? 0);
    if (quantity === 0) return NextResponse.json({ error: "Số lượng điều chỉnh không được bằng 0" }, { status: 400 });
  } else if (type === "TRANSFER") {
    quantity = 0;
    if (!body.toRoom) return NextResponse.json({ error: "Thiếu phòng/vị trí mới" }, { status: 400 });
  }

  const txn = await prisma.$transaction(async (tx) => {
    const created = await tx.assetTransaction.create({
      data: {
        assetId: asset.id,
        type,
        quantity,
        toRoom: type === "TRANSFER" ? body.toRoom : null,
        txnDate: body.txnDate ? new Date(body.txnDate) : new Date(),
        notes: body.notes || null,
      },
    });

    if (type === "TRANSFER") {
      await tx.asset.update({ where: { id: asset.id }, data: { room: body.toRoom } });
    }
    if (type === "DISPOSAL") {
      // Dùng tx (không phải prisma ngoài) để thấy được giao dịch vừa tạo trong cùng transaction.
      const agg = await tx.assetTransaction.aggregate({ where: { assetId: asset.id }, _sum: { quantity: true } });
      const remaining = agg._sum.quantity ?? 0;
      if (remaining <= 0) await tx.asset.update({ where: { id: asset.id }, data: { status: "DISPOSED" } });
    }

    return created;
  });

  return NextResponse.json({ item: txn }, { status: 201 });
}
