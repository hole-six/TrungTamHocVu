// CHI TIẾT MỘT LẦN CHẤM ĐIỂM — phần tính toán thuần, dùng chung cho màn chấm điểm và
// bảng điểm tháng.
//
// Vì sao cần: khi trừ điểm một trợ giảng, nếu bạn ấy thắc mắc thì người quản lý phải trả
// lời được ngay "hôm nào, lớp nào, hạn là mấy giờ, em nộp lúc mấy giờ, chậm bao lâu, đã
// khắc phục chưa". Trước đây mỗi lần chấm chỉ lưu NGÀY và một câu lý do nên không đối
// soát được, nói qua nói lại không ai có bằng chứng.

export type LatenessInput = {
  /** Hạn theo quy chế, vd nhật ký lớp phải gửi trước 9h sáng hôm sau. */
  dueAt?: string | Date | null;
  /** Thực tế làm xong lúc nào. */
  completedAt?: string | Date | null;
};

export type Lateness = {
  /** Số phút trễ (> 0). null = không đủ dữ liệu để tính, 0 = đúng hạn. */
  minutes: number | null;
  /** Câu mô tả sẵn để hiện lên màn hình, vd "chậm 1 ngày 2 giờ". */
  label: string;
};

function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function computeLateness(input: LatenessInput): Lateness {
  const due = toDate(input.dueAt);
  const done = toDate(input.completedAt);
  if (!due || !done) return { minutes: null, label: "" };

  const minutes = Math.round((done.getTime() - due.getTime()) / 60000);
  if (minutes <= 0) return { minutes: 0, label: "đúng hạn" };

  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ngày`);
  if (hours > 0) parts.push(`${hours} giờ`);
  // Chỉ nói tới phút khi chưa đầy 1 ngày — "chậm 3 ngày 2 giờ 15 phút" không ai cần.
  if (mins > 0 && days === 0) parts.push(`${mins} phút`);
  return { minutes, label: `chậm ${parts.join(" ")}` };
}

/** Một dòng tóm tắt đủ để đối soát với nhân sự, ghép từ các mốc đã lưu. */
export function describeScoreEvent(event: {
  occurredAt?: string | Date | null;
  eventDate: string | Date;
  className?: string | null;
  dueAt?: string | Date | null;
  completedAt?: string | Date | null;
  resolvedAt?: string | Date | null;
}): string {
  const parts: string[] = [];
  const when = toDate(event.occurredAt);
  parts.push(when ? formatDateTimeVn(when) : formatDateVn(event.eventDate));
  if (event.className) parts.push(`lớp ${event.className}`);
  const late = computeLateness(event);
  if (late.label) parts.push(late.label);
  const resolved = toDate(event.resolvedAt);
  if (resolved) parts.push(`đã khắc phục ${formatDateTimeVn(resolved)}`);
  return parts.join(" · ");
}

export function formatDateVn(value?: string | Date | null): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString("vi-VN") : "—";
}

export function formatDateTimeVn(value?: string | Date | null): string {
  const date = toDate(value);
  if (!date) return "—";
  return `${date.toLocaleDateString("vi-VN")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Chuẩn hóa giá trị <input type="datetime-local"> thành Date, rỗng thì null. */
export function parseLocalDateTime(value: unknown): Date | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Ngược lại: Date → chuỗi cho <input type="datetime-local">. */
export function toLocalDateTimeInput(value?: string | Date | null): string {
  const date = toDate(value);
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
