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
    const [paymentPosting, refundPosting, stockPosting, assetPosting] = await Promise.all([
      prisma.paymentCashPosting.findUnique({ where: { cashTransactionId: params.id } }),
      prisma.refundCashPosting.findUnique({ where: { cashTransactionId: params.id } }),
      prisma.stockCashPosting.findUnique({ where: { cashTransactionId: params.id } }),
      prisma.assetCashPosting.findUnique({ where: { cashTransactionId: params.id } }),
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
    if (assetPosting) {
      return NextResponse.json({ error: "Phiếu này được sinh từ bảo dưỡng tài sản. Hãy hủy ở lịch sử bảo dưỡng của tài sản đó thay vì hủy trực tiếp." }, { status: 409 });
    }
    const updated = await prisma.cashTransaction.update({ where: { id: params.id }, data: { status: "VOIDED" } });
    return NextResponse.json({ item: updated });
  }

  // Sửa mô tả/danh mục/ghi chú — chỉ cho phiếu tự tạo thủ công (không sinh từ thu học
  // phí/hoàn tiền/nhập kho) và chưa bị hủy. Số tiền/ngày/loại phiếu KHÔNG sửa trực
  // tiếp ở đây — muốn sửa số tiền thì hủy phiếu và tạo phiếu mới, để giữ log kiểm toán.
  // Chỉ có "cashbook.create.branch" và "cashbook.approve.branch" được seed — không có
  // permission "update" riêng, nên dùng "approve" (cùng quyền với hủy phiếu ở trên)
  // cho hành động sửa/correction, nhất quán với mức độ tin cậy đã áp dụng cho VOID.
  if (!(await hasPermission(user, "cashbook", "approve"))) {
    return NextResponse.json({ error: "Bạn không có quyền sửa phiếu thu/chi" }, { status: 403 });
  }
  if (existing.status === "VOIDED") {
    return NextResponse.json({ error: "Phiếu đã bị hủy, không thể sửa" }, { status: 409 });
  }
  const [paymentPosting, refundPosting, stockPosting, assetPosting] = await Promise.all([
    prisma.paymentCashPosting.findUnique({ where: { cashTransactionId: params.id } }),
    prisma.refundCashPosting.findUnique({ where: { cashTransactionId: params.id } }),
    prisma.stockCashPosting.findUnique({ where: { cashTransactionId: params.id } }),
    prisma.assetCashPosting.findUnique({ where: { cashTransactionId: params.id } }),
  ]);
  if (paymentPosting || refundPosting || stockPosting || assetPosting) {
    return NextResponse.json({ error: "Phiếu này sinh từ nghiệp vụ khác, hãy sửa ở nghiệp vụ gốc." }, { status: 409 });
  }

  const data: Record<string, unknown> = {};
  for (const field of ["description", "detail", "notes"]) {
    if (field in body) data[field] = body[field] || null;
  }
  if ("categoryId" in body) data.categoryId = body.categoryId || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Không có thay đổi nào để lưu" }, { status: 400 });
  }

  const updated = await prisma.cashTransaction.update({ where: { id: params.id }, data });
  return NextResponse.json({ item: updated });
}
