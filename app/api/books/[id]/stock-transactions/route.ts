import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { syncBookQuantityOnHand } from "@/lib/server/database-sync";

const VALID_TYPES = ["RECEIPT", "RETURN", "ADJUSTMENT"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!user.branchId) return NextResponse.json({ error: "Tài khoản chưa gán chi nhánh" }, { status: 400 });
  const { role, override } = await getUserRoleAndOverride(user.id, "inventory");
  if (!canUpdateWithOverride("inventory", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền nhập/điều chỉnh kho" }, { status: 403 });
  }

  const book = await prisma.book.findUnique({ where: { id: params.id } });
  if (!book) return NextResponse.json({ error: "Không tìm thấy sách" }, { status: 404 });
  if (book.branchId !== user.branchId) return NextResponse.json({ error: "Sách không thuộc chi nhánh của bạn" }, { status: 403 });

  const body = await req.json();
  const type = String(body.type ?? "RECEIPT");
  const quantity = Number(body.quantity);
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: "Loại giao dịch không hợp lệ" }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity === 0) return NextResponse.json({ error: "Số lượng không hợp lệ" }, { status: 400 });

  const unitPrice = body.unitPrice ? Number(body.unitPrice) : book.unitPrice;
  const txnDate = body.txnDate ? new Date(body.txnDate) : new Date();
  const postToCash = body.postToCash !== false && (type === "RECEIPT" || type === "RETURN");
  const cashType = type === "RECEIPT" ? "CHI" : "THU";

  const result = await prisma.$transaction(async (tx) => {
    const txn = await tx.stockTransaction.create({
      data: {
        bookId: book.id,
        type,
        quantity,
        unitPrice,
        totalAmount: quantity * unitPrice,
        receivedById: body.receivedById || user.id,
        handedById: body.handedById || null,
        txnDate,
        notes: body.notes || null,
      },
    });

    let cashTransactionId: string | null = null;
    if (postToCash) {
      const cashTxn = await tx.cashTransaction.create({
        data: {
          branchId: user.branchId!,
          categoryId: body.categoryId || null,
          type: cashType,
          txnDate,
          detail: `${type === "RECEIPT" ? "Nhập kho" : "Trả hàng"} giáo trình`,
          description: body.description || `${type === "RECEIPT" ? "Nhập" : "Trả"} ${book.name}`,
          amount: quantity * unitPrice,
          handledById: user.id,
          status: "CONFIRMED",
          notes: body.notes || null,
        },
      });
      cashTransactionId = cashTxn.id;

      await tx.stockCashPosting.create({
        data: {
          stockTransactionId: txn.id,
          cashTransactionId: cashTxn.id,
          amount: quantity * unitPrice,
          postingKind: type === "RECEIPT" ? "SUPPLIER_PAYMENT" : "STOCK_REFUND",
          notes: `Auto-post từ giao dịch kho ${txn.id}`,
        },
      });
    }

    await syncBookQuantityOnHand(book.id, tx);
    return { txn, cashTransactionId };
  });

  const balance = await syncBookQuantityOnHand(book.id);
  return NextResponse.json({ item: result.txn, cashTransactionId: result.cashTransactionId, balance }, { status: 201 });
}
