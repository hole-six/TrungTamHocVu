// CA LÀM VIỆC dùng chung cho toàn bộ phần chấm công (client-safe, không import server).
// Trước đây giờ ca bị chôn cứng trong API (08:00–12:00, 13:00–17:00) và màn hình chỉ
// hiện "Đã chấm · 8.00h" — không ai biết chấm từ mấy giờ tới mấy giờ, cũng không chọn
// được ca khác khi bấm chấm công.
export type ShiftTimes = {
  checkInAm: string;
  checkOutAm: string;
  checkInPm: string;
  checkOutPm: string;
};

export const EMPTY_SHIFT: ShiftTimes = { checkInAm: "", checkOutAm: "", checkInPm: "", checkOutPm: "" };

export const SHIFT_PRESETS: { key: string; label: string; times: ShiftTimes }[] = [
  { key: "FULL", label: "Hành chính cả ngày", times: { checkInAm: "08:00", checkOutAm: "12:00", checkInPm: "13:00", checkOutPm: "17:00" } },
  { key: "MORNING", label: "Chỉ buổi sáng", times: { checkInAm: "08:00", checkOutAm: "12:00", checkInPm: "", checkOutPm: "" } },
  { key: "AFTERNOON", label: "Chỉ buổi chiều", times: { checkInAm: "", checkOutAm: "", checkInPm: "13:00", checkOutPm: "17:00" } },
  { key: "EVENING", label: "Chiều – tối", times: { checkInAm: "", checkOutAm: "", checkInPm: "14:00", checkOutPm: "21:00" } },
];

export function rangeHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((value) => !Number.isFinite(value))) return 0;
  return Math.max(0, eh + em / 60 - (sh + sm / 60));
}

/** Bản ghi chấm công lấy từ CSDL có thể là null từng ô — nhận cả null cho tiện dùng chung. */
export type ShiftLike = { checkInAm?: string | null; checkOutAm?: string | null; checkInPm?: string | null; checkOutPm?: string | null };

export function shiftHours(times: ShiftLike): number {
  return (
    rangeHours(times.checkInAm ?? "", times.checkOutAm ?? "") + rangeHours(times.checkInPm ?? "", times.checkOutPm ?? "")
  );
}

// 1 công = 8 giờ (cùng công thức với app/api/timesheet-entries).
export function shiftDays(hours: number): number {
  return Math.round((hours / 8) * 100) / 100;
}

export function formatRange(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start || !end) return null;
  return `${start}–${end}`;
}

/** "08:00–12:00 · 13:00–17:00" — hiện rõ làm từ mấy giờ tới mấy giờ. */
export function formatShift(times: ShiftLike | null | undefined): string {
  if (!times) return "—";
  const parts = [formatRange(times.checkInAm, times.checkOutAm), formatRange(times.checkInPm, times.checkOutPm)].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(" · ") : "—";
}

/** Khoảng giờ gộp: "08:00 → 17:00" (nghỉ trưa 12:00–13:00) — đọc nhanh hơn khi chỉ cần biết đầu/cuối ngày. */
export function formatShiftSpan(times: ShiftLike | null | undefined): string {
  if (!times) return "—";
  const start = times.checkInAm || times.checkInPm;
  const end = times.checkOutPm || times.checkOutAm;
  if (!start || !end) return "—";
  return `${start} → ${end}`;
}

export function matchPresetKey(times: ShiftLike): string | null {
  const found = SHIFT_PRESETS.find(
    (preset) =>
      preset.times.checkInAm === (times.checkInAm ?? "") &&
      preset.times.checkOutAm === (times.checkOutAm ?? "") &&
      preset.times.checkInPm === (times.checkInPm ?? "") &&
      preset.times.checkOutPm === (times.checkOutPm ?? ""),
  );
  return found?.key ?? null;
}

const STORAGE_KEY = "timesheet-shift";

/** Ca dùng gần nhất — tiện cho cơ sở có ca riêng (vd chiều–tối), không phải sửa lại mỗi lần. */
export function loadSavedShift(): ShiftTimes {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SHIFT_PRESETS[0].times;
    const parsed = JSON.parse(raw) as Partial<ShiftTimes>;
    const next = { ...EMPTY_SHIFT, ...parsed };
    return shiftHours(next) > 0 ? next : SHIFT_PRESETS[0].times;
  } catch {
    return SHIFT_PRESETS[0].times;
  }
}

export function saveShift(times: ShiftTimes) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(times));
  } catch {
    // Trình duyệt chặn localStorage — vẫn dùng được, chỉ không nhớ ca lần sau.
  }
}
