/**
 * Badge/status màu dùng chung cho toàn hệ thống.
 *
 * Trước đây mỗi module tự viết 1 hàm map status → màu riêng (students, classes,
 * calendar, assets, inventory...) — cùng nhóm trạng thái (ACTIVE/PENDING/CANCELLED...)
 * nhưng mỗi nơi 1 tông màu khác nhau. File này gộp logic MÀU về 1 chỗ; nhãn tiếng Việt
 * vẫn do từng module tự truyền vào (mỗi module có thuật ngữ riêng cho cùng 1 tông màu),
 * dùng `statusLabel(status, dict)`.
 */

export type StatusTone = "green" | "blue" | "amber" | "red" | "gray" | "purple" | "pink";

/**
 * Map các giá trị status thường gặp trong hệ thống sang 1 tông màu chung.
 * Thêm giá trị mới vào đây khi phát sinh status mới — không tự chế bảng màu riêng
 * ở component khác.
 */
const STATUS_TONE_MAP: Record<string, StatusTone> = {
  // Tích cực / đang hoạt động / đã hoàn tất
  ACTIVE: "green",
  PAID: "green",
  CONFIRMED: "green",
  COMPLETED: "green",
  PRESENT: "green",
  ON_TRACK: "blue",
  AVAILABLE: "green",
  APPROVED: "green",
  POSTED: "green",

  // Trung tính / thông tin
  PLANNED: "blue",
  SCHEDULED: "blue",
  REVIEWED: "blue",
  CONSUMED: "blue",

  // Cần chú ý / đang chờ
  PENDING: "amber",
  NEED_TRANSFER: "amber",
  DRAFT: "amber",
  MAINTENANCE: "amber",
  PARTIAL: "amber",

  // Tiêu cực / cảnh báo mạnh
  LEFT: "red",
  UNPAID: "red",
  CANCELLED: "red",
  VOIDED: "red",
  ABSENT: "red",
  BROKEN: "red",
  OVERDUE: "red",
  REJECTED: "red",

  // Đã kết thúc / không còn hiệu lực — trung tính xám
  WITHDRAWN: "gray",
  TRANSFERRED: "gray",
  INACTIVE: "gray",
  ARCHIVED: "gray",
};

/** Trả về class `.badge-*` (định nghĩa sẵn trong app/globals.css) cho 1 giá trị status. */
export function statusBadgeClass(status: string): string {
  const tone = STATUS_TONE_MAP[status] ?? "gray";
  return `badge-${tone}`;
}

/**
 * Trả về nhãn tiếng Việt cho status. `dict` là bảng nhãn riêng của từng module
 * (vd { ACTIVE: "Đang học", LEFT: "Đã nghỉ" }) — nếu status không có trong dict,
 * trả về chính chuỗi status thô kèm cảnh báo dev để không lộ enum thô lên UI mà
 * không ai biết.
 */
export function statusLabel(status: string, dict?: Record<string, string>): string {
  if (dict && status in dict) return dict[status];
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(`[statusLabel] Chưa có nhãn tiếng Việt cho status "${status}" — bổ sung vào dictionary của module.`);
  }
  return status;
}
