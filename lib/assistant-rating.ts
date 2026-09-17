// QUY CHẾ THƯỞNG PHẠT TRỢ GIẢNG (áp dụng từ 4/2025) — phần tính toán thuần, không đụng CSDL.
//
// Văn bản quy chế:
//   A = (số lần bị nhắc tên ở các báo cáo ÷ tổng số ca làm cả tháng) × 100%
//     A = 0          → Lương +20%
//     A ≤ 5          → Lương +10%
//     5 < A < 10     → Lương +0%
//     A ≥ 10         → Lương −5%
//   "Nếu với 1 nội dung nhắc nhở mà bị nhắc cả ở 3 báo cáo (ngày, tuần, tháng) thì tháng đó
//    mặc định −10% lương."
//   "5 ca < Tổng số ca làm trong tháng < 15 ca ⇒ Lương + Max 5%."
//
// Chốt cách hiểu (ghi rõ để sau này tra lại):
//   - TỔNG SỐ CA gộp TOÀN BỘ CƠ SỞ của trung tâm, không xét riêng từng cơ sở (yêu cầu của
//     chủ trung tâm). Ca dạy lớp bổ trợ VẪN TÍNH (chủ trung tâm chốt: bổ trợ cũng là dạy);
//     chỉ ca dạy thay không tính, vì đã có điểm cộng riêng "dạy thay hộ +1/ca".
//   - "Số lần bị nhắc tên" = SỐ LẦN bị nhắc (mỗi lần nhắc là 1), khác với SỐ ĐIỂM TRỪ ở bảng
//     xét thưởng (mỗi lỗi −1 đến −3 điểm).
//   - Dưới hoặc bằng 5 ca/tháng: quy chế không quy định, hệ thống để "chưa xét" — không chặn,
//     admin vẫn chốt tay được mức thưởng/phạt ở cột "% đã chốt".
//   - Mức trần +5% khi 5 < số ca < 15 áp SAU khi ra mức theo A.

export type RatingInput = {
  /** Tổng số ca làm trong tháng, gồm cả ca bổ trợ, đã loại ca dạy thay, gộp mọi cơ sở. */
  countedShifts: number;
  /** Số lần bị nhắc tên ở các báo cáo ngày/tuần/tháng. */
  reminderCount: number;
  /** Có nội dung bị nhắc ở CẢ 3 báo cáo (ngày, tuần, tháng). */
  tripleReported: boolean;
};

export type RatingSuggestion = {
  /** Tỉ lệ A (%). null khi chưa có ca nào. */
  ratio: number | null;
  /** Mức đề xuất theo quy chế: 0.2 = +20%, -0.05 = −5%. null = quy chế chưa quy định. */
  percent: number | null;
  /** Diễn giải từng bước ra mức đề xuất, hiện thẳng cho người duyệt đọc. */
  reasons: string[];
};

export const MIN_SHIFTS_FOR_RATING = 5;
export const LOW_SHIFT_CAP = 0.05;
export const LOW_SHIFT_CAP_MAX = 15;

export function computeReminderRatio(reminderCount: number, countedShifts: number): number | null {
  if (countedShifts <= 0) return null;
  return (reminderCount / countedShifts) * 100;
}

/** Điểm cộng theo số ca trong tháng (bảng XÉT THƯỞNG TRỢ GIẢNG). */
export function shiftTierPoints(countedShifts: number): number {
  if (countedShifts > 37) return 3;
  if (countedShifts >= 27) return 2;
  if (countedShifts >= 22) return 1;
  return 0;
}

export function suggestBonusPercent(input: RatingInput): RatingSuggestion {
  const { countedShifts, reminderCount, tripleReported } = input;
  const ratio = computeReminderRatio(reminderCount, countedShifts);
  const reasons: string[] = [];

  if (ratio === null) {
    return { ratio, percent: null, reasons: ["Chưa có ca làm nào trong tháng — chưa xét thưởng."] };
  }

  reasons.push(`A = ${reminderCount} lần nhắc ÷ ${countedShifts} ca = ${ratio.toFixed(1)}%`);

  if (tripleReported) {
    reasons.push("Có nội dung bị nhắc ở cả 3 báo cáo (ngày, tuần, tháng) → quy chế ghi mặc định −10%.");
    return { ratio, percent: -0.1, reasons };
  }

  if (countedShifts <= MIN_SHIFTS_FOR_RATING) {
    reasons.push(`Chỉ ${countedShifts} ca (≤ ${MIN_SHIFTS_FOR_RATING}) — quy chế chưa quy định, admin tự chốt mức.`);
    return { ratio, percent: null, reasons };
  }

  let percent: number;
  if (ratio === 0) {
    percent = 0.2;
    reasons.push("A = 0 → +20%");
  } else if (ratio <= 5) {
    percent = 0.1;
    reasons.push("A ≤ 5 → +10%");
  } else if (ratio < 10) {
    percent = 0;
    reasons.push("5 < A < 10 → +0%");
  } else {
    percent = -0.05;
    reasons.push("A ≥ 10 → −5%");
  }

  if (countedShifts < LOW_SHIFT_CAP_MAX && percent > LOW_SHIFT_CAP) {
    reasons.push(`${countedShifts} ca (dưới ${LOW_SHIFT_CAP_MAX}) → trần +${Math.round(LOW_SHIFT_CAP * 100)}%`);
    percent = LOW_SHIFT_CAP;
  }

  return { ratio, percent, reasons };
}
