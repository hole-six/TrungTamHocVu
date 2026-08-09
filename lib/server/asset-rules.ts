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
// làm giảm giá trị). Giao dịch đã voided (nhập sai, đã hủy) không được tính vào đây —
// xem app/api/assets/[id]/transactions/[transactionId]/void/route.ts.
export function computeAssetTotalValue(
  unitValue: number | null,
  quantity: number,
  transactions: { type: string; amount: number; voidedAt?: Date | null }[],
): number {
  const maintenanceValue = transactions
    .filter((t) => t.type === "MAINTENANCE" && !t.voidedAt)
    .reduce((sum, t) => sum + t.amount, 0);
  return quantity * (unitValue ?? 0) + maintenanceValue;
}

// Lịch bảo dưỡng định kỳ — mỗi tài sản tự đặt chu kỳ riêng (tháng) vì cùng nhóm thiết bị
// (điện lạnh, máy chiếu, máy in...) vẫn có thể cần bảo dưỡng lệch thời điểm nhau tuỳ tình
// trạng dùng thực tế. Hạn kế tiếp KHÔNG lưu cột riêng — tính động từ lần bảo dưỡng gần nhất
// (asset_transactions type=MAINTENANCE) cộng chu kỳ, để không bao giờ lệch với lịch sử thật;
// nếu tài sản chưa từng bảo dưỡng lần nào thì tính từ ngày tạo tài sản.
export function computeNextMaintenanceDue(
  intervalMonths: number | null,
  lastMaintenanceDate: Date | null,
  assetCreatedAt: Date,
): Date | null {
  if (!intervalMonths || intervalMonths <= 0) return null;
  const anchor = lastMaintenanceDate ?? assetCreatedAt;
  const next = new Date(anchor);
  next.setMonth(next.getMonth() + intervalMonths);
  return next;
}

export type MaintenanceStatus = "OVERDUE" | "DUE_SOON" | "OK" | "NOT_SCHEDULED";

// Cửa sổ "sắp đến hạn" — đủ để người vận hành sắp xếp lịch sửa chữa trước khi thiết bị
// thực sự quá hạn, không quá dài để mất tác dụng cảnh báo.
const MAINTENANCE_DUE_SOON_WINDOW_DAYS = 14;

export function computeMaintenanceStatus(nextDue: Date | null, now: Date = new Date()): MaintenanceStatus {
  if (!nextDue) return "NOT_SCHEDULED";
  const daysLeft = (nextDue.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  if (daysLeft < 0) return "OVERDUE";
  if (daysLeft <= MAINTENANCE_DUE_SOON_WINDOW_DAYS) return "DUE_SOON";
  return "OK";
}

export const MAINTENANCE_STATUS_LABEL: Record<MaintenanceStatus, string> = {
  OVERDUE: "Quá hạn",
  DUE_SOON: "Sắp đến hạn",
  OK: "Còn hạn",
  NOT_SCHEDULED: "Chưa đặt lịch",
};
