import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { hasPermission } from "@/lib/server/permissions";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const existing = await prisma.cashTransaction.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy phiếu" }, { status: 404 });

  const body = await req.json();
  if (body.status === "VOIDED") {
    if (existing.status === "VOIDED") return NextResponse.json({ error: "Phiếu đã bị hủy trước đó" }, { status: 409 });
    if (!(await hasPermission(user, "cashbook", "approve"))) {
      return NextResponse.json({ error: "Bạn không có quyền hủy phiếu thu/chi" }, { status: 403 });
    }
    const [paymentPosting, refundPosting, stockPosting] = await Promise.all([
      prisma.paymentCashPosting.findUnique({ where: { cashTransactionId: params.id } }),
      prisma.refundCashPosting.findUnique({ where: { cashTransactionId: params.id } }),
      prisma.stockCashPosting.findUnique({ where: { cashTransactionId: params.id } }),
    ]);
    if (paymentPosting) {
      return NextResponse.json({ error: "Phiếu này được sinh từ thu học phí. Hãy hoàn tiền hoặc hủy nghiệp vụ gốc thay vì hủy trực tiếp." }, { status: 409 });
    }
    if (refundPosting) {
      return NextResponse.json({ error: "Phiếu này được sinh từ hoàn tiền. Hãy xử lý ở nghiệp vụ hoàn tiền gốc." }, { status: 409 });
    }
    if (stockPosting) {
      return NextResponse.json({ error: "Phiếu này được sinh từ nhập/trả kho. Hãy xử lý ở nghiệp vụ kho gốc." }, { status: 409 });
    }
    const updated = await prisma.cashTransaction.update({ where: { id: params.id }, data: { status: "VOIDED" } });
    return NextResponse.json({ item: updated });
  }

  return NextResponse.json({ error: "Chỉ hỗ trợ hủy phiếu qua endpoint này" }, { status: 400 });
}
