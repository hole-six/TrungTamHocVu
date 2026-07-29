import { prisma } from "@/lib/prisma";

// Tồn kho — nguồn XuatNhapSach (T_SachTon/T_SachNhap/T_SachXuat). Tính động từ sổ
// kho (StockTransaction nhập/trả/điều chỉnh - BookIssue xuất) thay vì tin vào một
// cột đếm có thể lệch, cùng nguyên tắc đã áp dụng cho sĩ số lớp/số buổi đã học.
export async function computeStockBalance(bookId: string) {
  const [receipts, adjustments, issues] = await Promise.all([
    prisma.stockTransaction.groupBy({
      by: ["type"],
      where: { bookId },
      _sum: { quantity: true },
    }),
    prisma.stockTransaction.aggregate({ where: { bookId, type: "ADJUSTMENT" }, _sum: { quantity: true } }),
    prisma.bookIssue.aggregate({ where: { bookId }, _sum: { quantity: true } }),
  ]);

  const received = receipts.find((r) => r.type === "RECEIPT")?._sum.quantity ?? 0;
  const returned = receipts.find((r) => r.type === "RETURN")?._sum.quantity ?? 0;
  const adjusted = adjustments._sum.quantity ?? 0;
  const issued = issues._sum.quantity ?? 0;

  return { received, returned, adjusted, issued, onHand: received + returned + adjusted - issued };
}

export const STOCK_TXN_TYPE_LABEL: Record<string, string> = {
  RECEIPT: "Nhập kho",
  RETURN: "Trả hàng",
  ADJUSTMENT: "Điều chỉnh kiểm kê",
};
