// KHOẢNG THỜI GIAN DÙNG CHUNG CHO TOÀN HỆ THỐNG.
//
// Trước đây mỗi màn tự chọn thời gian một kiểu: lịch dùng `?week=YYYY-MM-DD`, bảng điều
// hành dùng `?mode=week&week=YYYY-Www`, các bảng khác dùng cặp from/to riêng. Người dùng
// phải học lại cách lọc ở từng màn, và mỗi nơi lại tính "tuần" một kiểu.
//
// File này là MỘT nguồn duy nhất: tuần theo ISO 8601 (tuần bắt đầu Thứ Hai, tuần 1 là
// tuần chứa Thứ Năm đầu tiên của năm) — đúng cách gọi "tuần thứ mấy trong năm" mà trung
// tâm đang dùng.
//
// Mốc thời gian: NGÀY THEO LỊCH VIỆT NAM, lưu bằng mốc nửa đêm UTC — đúng quy ước đã
// dùng ở monthRange/getVietnamToday của dự án, để không lệch 7 tiếng với buổi học và
// phiếu học phí. Không import prisma nên component phía trình duyệt dùng được.

export type PeriodMode = "week" | "month";

const DAY_MS = 86_400_000;

/** Hôm nay theo lịch Việt Nam, trả về mốc nửa đêm UTC của ngày đó. */
export function vietnamToday(): Date {
  const vn = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
}

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Thứ Hai của tuần chứa ngày này. */
export function startOfIsoWeek(date: Date): Date {
  const day = utcDay(date);
  const weekday = day.getUTCDay() || 7; // CN = 7
  return addDays(day, 1 - weekday);
}

/** Tuần thứ mấy trong năm theo ISO 8601 (1–53). */
export function isoWeekNumber(date: Date): number {
  const thursday = addDays(startOfIsoWeek(date), 3);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.floor((thursday.getTime() - yearStart.getTime()) / (7 * DAY_MS)) + 1;
}

/**
 * Năm của tuần theo ISO — KHÔNG phải năm của ngày.
 * Ví dụ 01/01/2027 là Thứ Sáu nên thuộc tuần 53 của năm 2026.
 */
export function isoWeekYear(date: Date): number {
  return addDays(startOfIsoWeek(date), 3).getUTCFullYear();
}

/** Năm đó có 52 hay 53 tuần. */
export function isoWeeksInYear(year: number): number {
  return isoWeekNumber(new Date(Date.UTC(year, 11, 28)));
}

export function weekKey(date: Date): string {
  return `${isoWeekYear(date)}-W${String(isoWeekNumber(date)).padStart(2, "0")}`;
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Đọc khoá tuần từ URL. Nhận cả hai dạng để đường dẫn cũ không gãy:
 *   - "2026-W40" (dạng chuẩn)
 *   - "2026-09-28" (dạng cũ của màn lịch — lấy tuần chứa ngày đó)
 * Giá trị sai hoặc để trống thì lấy tuần hiện tại.
 */
export function parseWeekKey(value: string | null | undefined, today: Date = vietnamToday()): Date {
  if (value && /^\d{4}-W\d{1,2}$/.test(value)) {
    const [yearText, weekText] = value.split("-W");
    const year = Number(yearText);
    const week = Math.min(Math.max(Number(weekText), 1), isoWeeksInYear(year));
    // Tuần 1 luôn là tuần chứa ngày 4/1 theo ISO.
    return addDays(startOfIsoWeek(new Date(Date.UTC(year, 0, 4))), (week - 1) * 7);
  }
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) return startOfIsoWeek(parsed);
  }
  return startOfIsoWeek(today);
}

/** Đọc khoá tháng "YYYY-MM"; sai hoặc trống thì lấy tháng hiện tại. */
export function parseMonthKey(value: string | null | undefined, today: Date = vietnamToday()): Date {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    if (month >= 1 && month <= 12) return new Date(Date.UTC(year, month - 1, 1));
  }
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
}

export type ResolvedPeriod = {
  mode: PeriodMode;
  /** Nửa đêm ngày đầu khoảng (UTC). */
  start: Date;
  /** 23:59:59.999 ngày cuối khoảng (UTC). */
  end: Date;
  /** Khoá của chính khoảng này để ghi vào URL. */
  key: string;
  /** Khoá của khoảng liền trước / liền sau. */
  prevKey: string;
  nextKey: string;
  /** "Tuần 40/2026" hoặc "Tháng 10/2026". */
  label: string;
  /** "28/09 – 04/10/2026" hoặc "01/10 – 31/10/2026". */
  rangeLabel: string;
  /** Khoảng đang xem có chứa hôm nay không. */
  isCurrent: boolean;
  weekNumber: number | null;
  weeksInYear: number | null;
};

const dd = (date: Date) => String(date.getUTCDate()).padStart(2, "0");
const mm = (date: Date) => String(date.getUTCMonth() + 1).padStart(2, "0");

/**
 * Quy ra khoảng thời gian đang xem từ tham số URL.
 *
 * `mode` quyết định tuần hay tháng; `week`/`month` là khoá của khoảng. Thiếu hết thì lấy
 * tuần chứa hôm nay — mốc luôn là ngày hiện tại như đã chốt.
 */
export function resolvePeriod(
  params: { mode?: string | null; week?: string | null; month?: string | null },
  today: Date = vietnamToday(),
): ResolvedPeriod {
  const mode: PeriodMode = params.mode === "month" ? "month" : "week";

  if (mode === "month") {
    const first = parseMonthKey(params.month, today);
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    const prev = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 1, 1));
    const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1));
    return {
      mode,
      start: first,
      end: last,
      key: monthKey(first),
      prevKey: monthKey(prev),
      nextKey: monthKey(next),
      label: `Tháng ${first.getUTCMonth() + 1}/${first.getUTCFullYear()}`,
      rangeLabel: `${dd(first)}/${mm(first)} – ${dd(last)}/${mm(last)}/${last.getUTCFullYear()}`,
      isCurrent: today >= first && today <= last,
      weekNumber: null,
      weeksInYear: null,
    };
  }

  const start = parseWeekKey(params.week, today);
  const end = new Date(addDays(start, 6).getTime() + DAY_MS - 1);
  return {
    mode,
    start,
    end,
    key: weekKey(start),
    prevKey: weekKey(addDays(start, -7)),
    nextKey: weekKey(addDays(start, 7)),
    label: `Tuần ${isoWeekNumber(start)}/${isoWeekYear(start)}`,
    rangeLabel: `${dd(start)}/${mm(start)} – ${dd(end)}/${mm(end)}/${end.getUTCFullYear()}`,
    isCurrent: today >= start && today <= end,
    weekNumber: isoWeekNumber(start),
    weeksInYear: isoWeeksInYear(isoWeekYear(start)),
  };
}

/** Khoá của khoảng chứa hôm nay — dùng cho nút "Tuần này" / "Tháng này". */
export function currentKey(mode: PeriodMode, today: Date = vietnamToday()): string {
  return mode === "month" ? monthKey(today) : weekKey(today);
}
