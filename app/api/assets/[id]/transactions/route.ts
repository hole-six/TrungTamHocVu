import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeAssetQuantity } from "@/lib/server/asset-rules";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";

const VALID_TYPES = ["RECEIPT", "TRANSFER", "ADJUSTMENT", "DISPOSAL", "MAINTENANCE"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "assets");
  if (!canUpdateWithOverride("assets", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền ghi nhận giao dịch tài sản" }, { status: 403 });
  }

  const asset = await prisma.asset.findUnique({ where: { id: params.id } });
  if (!asset) return NextResponse.json({ error: "Không tìm thấy tài sản" }, { status: 404 });

  const body = await req.json();
  const type = String(body.type ?? "");
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: "Loại giao dịch không hợp lệ" }, { status: 400 });

  // Number(...) trên input rác (chữ, rỗng sau khi trim, ký hiệu lạ) trả về NaN — so sánh
  // kiểu "NaN <= 0" luôn là false nên lọt qua các check phía dưới nếu chỉ dùng <=/=== 0.
  // Chặn thẳng NaN/số không nguyên ở đây vì amount/quantity đều là cột Int, một dòng NaN
  // lọt vào sẽ làm NaN lan ra mọi tổng cộng dồn (.reduce) ở học phí/sổ quỹ/tài sản.
  let quantity = 0;
  let amount = 0;
  if (type === "RECEIPT") {
    quantity = Math.abs(Number(body.quantity ?? 0));
    if (!Number.isInteger(quantity) || quantity <= 0) return NextResponse.json({ error: "Số lượng nhập phải là số nguyên lớn hơn 0" }, { status: 400 });
  } else if (type === "DISPOSAL") {
    const rawQuantity = Number(body.quantity);
    if (body.quantity !== undefined && (!Number.isInteger(rawQuantity) || rawQuantity < 0)) {
      return NextResponse.json({ error: "Số lượng thanh lý phải là số nguyên không âm" }, { status: 400 });
    }
    const current = await computeAssetQuantity(asset.id);
    quantity = -Math.min(Math.abs(Number.isInteger(rawQuantity) ? rawQuantity : current), current);
    if (quantity === 0) return NextResponse.json({ error: "Không có số lượng để thanh lý" }, { status: 400 });
  } else if (type === "ADJUSTMENT") {
    quantity = Number(body.quantity ?? 0);
    if (!Number.isInteger(quantity) || quantity === 0) return NextResponse.json({ error: "Số lượng điều chỉnh phải là số nguyên khác 0" }, { status: 400 });
  } else if (type === "TRANSFER") {
    quantity = 0;
    if (!body.toRoom) return NextResponse.json({ error: "Thiếu phòng/vị trí mới" }, { status: 400 });
  } else if (type === "MAINTENANCE") {
    quantity = 0;
    amount = Math.abs(Number(body.amount ?? 0));
    if (!Number.isInteger(amount) || amount <= 0) return NextResponse.json({ error: "Số tiền bảo dưỡng phải là số nguyên lớn hơn 0" }, { status: 400 });
  }

  let txnDate = new Date();
  if (body.txnDate) {
    const parsed = new Date(body.txnDate);
    if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: "Ngày giao dịch không hợp lệ" }, { status: 400 });
    // Cho phép nhập lùi ngày (vd ghi nhận bảo dưỡng trễ so với ngày sửa thật), nhưng không
    // cho nhập ngày trong tương lai — chưa xảy ra thì chưa có gì để ghi nhận.
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (parsed.getTime() > endOfToday.getTime()) {
      return NextResponse.json({ error: "Ngày giao dịch không được ở tương lai" }, { status: 400 });
    }
    txnDate = parsed;
  }

  const txn = await prisma.$transaction(async (tx) => {
    const created = await tx.assetTransaction.create({
      data: {
        assetId: asset.id,
        type,
        quantity,
        amount,
        toRoom: type === "TRANSFER" ? body.toRoom : null,
        txnDate,
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

    // Tiền bảo dưỡng là tiền thật đã chi ra — tự sinh 1 phiếu CHI trong Sổ quỹ luôn,
    // không bắt nhập tay 2 nơi (cùng nguyên tắc với nhập kho giáo trình).
    if (type === "MAINTENANCE") {
      const cashTxn = await tx.cashTransaction.create({
        data: {
          branchId: asset.branchId,
          type: "CHI",
          txnDate,
          detail: "Bảo dưỡng tài sản",
          description: body.description || `Bảo dưỡng ${asset.name}`,
          amount,
          handledById: user.id,
          status: "CONFIRMED",
          notes: body.notes || null,
        },
      });

      await tx.assetCashPosting.create({
        data: {
          assetTransactionId: created.id,
          cashTransactionId: cashTxn.id,
          amount,
          postingKind: "MAINTENANCE",
          notes: `Auto-post từ giao dịch bảo dưỡng tài sản ${created.id}`,
        },
      });
    }

    return created;
  });

  return NextResponse.json({ item: txn }, { status: 201 });
}
