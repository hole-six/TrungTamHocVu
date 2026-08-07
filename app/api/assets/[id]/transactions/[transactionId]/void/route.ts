import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";

// Hủy 1 giao dịch bảo dưỡng nhập sai — KHÔNG xóa (mất dấu vết), chỉ đánh dấu voided và
// hủy luôn phiếu chi liên kết trong cùng 1 transaction, để 2 sổ (giá trị tài sản, sổ quỹ)
// không bao giờ lệch nhau. Chỉ áp dụng cho MAINTENANCE — các loại khác (RECEIPT/DISPOSAL/
// TRANSFER/ADJUSTMENT) ảnh hưởng số lượng tồn thực tế, phức tạp hơn và không nằm trong
// phạm vi yêu cầu này.
export async function POST(req: NextRequest, { params }: { params: { id: string; transactionId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "assets");
  if (!canUpdateWithOverride("assets", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền hủy giao dịch bảo dưỡng" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const reason = String(body.reason ?? "").trim();
  if (!reason) return NextResponse.json({ error: "Cần nhập lý do hủy để giữ dấu vết kiểm toán" }, { status: 400 });

  const txn = await prisma.assetTransaction.findUnique({
    where: { id: params.transactionId },
    include: { cashPosting: true },
  });
  if (!txn || txn.assetId !== params.id) {
    return NextResponse.json({ error: "Không tìm thấy giao dịch bảo dưỡng" }, { status: 404 });
  }
  if (txn.type !== "MAINTENANCE") {
    return NextResponse.json({ error: "Chỉ có thể hủy giao dịch loại bảo dưỡng qua luồng này" }, { status: 400 });
  }
  if (txn.voidedAt) {
    return NextResponse.json({ error: "Giao dịch này đã bị hủy trước đó" }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const voidedTxn = await tx.assetTransaction.update({
      where: { id: txn.id },
      data: { voidedAt: new Date(), voidReason: reason },
    });

    if (txn.cashPosting) {
      await tx.cashTransaction.update({
        where: { id: txn.cashPosting.cashTransactionId },
        data: { status: "VOIDED" },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        branchId: user.branchId,
        action: "void",
        entityType: "AssetTransaction",
        entityId: txn.id,
        before: JSON.stringify({ voidedAt: null, amount: txn.amount, txnDate: txn.txnDate }),
        after: JSON.stringify({ voidedAt: voidedTxn.voidedAt, amount: txn.amount }),
        reason,
      },
    });

    return voidedTxn;
  });

  return NextResponse.json({ item: updated });
}
