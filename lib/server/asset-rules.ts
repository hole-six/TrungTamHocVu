import { prisma } from "@/lib/prisma";

// Tài sản & Trang thiết bị — số lượng tồn tính động từ tổng AssetTransaction,
// cùng nguyên tắc với Kho giáo trình (không tin một cột đếm có thể lệch).
export async function computeAssetQuantity(assetId: string): Promise<number> {
  const result = await prisma.assetTransaction.aggregate({ where: { assetId }, _sum: { quantity: true } });
  return result._sum.quantity ?? 0;
}

export const ASSET_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang sử dụng",
  MAINTENANCE: "Đang bảo trì",
  BROKEN: "Hỏng",
  DISPOSED: "Đã thanh lý",
};

export const ASSET_TXN_TYPE_LABEL: Record<string, string> = {
  RECEIPT: "Nhập mới",
  TRANSFER: "Điều chuyển",
  ADJUSTMENT: "Điều chỉnh kiểm kê",
  DISPOSAL: "Thanh lý",
  MAINTENANCE: "Bảo dưỡng",
};

// Tổng giá trị = số lượng * giá trị/đơn vị + tổng tiền đã bảo dưỡng (bảo dưỡng coi như
// nâng cấp/duy trì giá trị sử dụng, cộng dồn vào giá trị tài sản chứ không phải chi phí
// làm giảm giá trị).
export function computeAssetTotalValue(
  unitValue: number | null,
  quantity: number,
  transactions: { type: string; amount: number }[],
): number {
  const maintenanceValue = transactions.filter((t) => t.type === "MAINTENANCE").reduce((sum, t) => sum + t.amount, 0);
  return quantity * (unitValue ?? 0) + maintenanceValue;
}
