// Quy tắc nghiệp vụ Lớp & Lịch — nguồn DSLop/T_DSLop (Master Spec §5 FR liên quan
// đến NgayKTDuKien, Con lai, SLHVNow). Các giá trị "CALCULATED" trong Excel gốc ở
// đây được tính động từ ClassSession/Enrollment thay vì lưu cột riêng — tránh lặp
// lại lỗi lệch dữ liệu (#REF!/#N/A) từng thấy trong TheoDoiHP/DSLop gốc.

// Ước lượng ngày kết thúc dự kiến — CHỈ là gợi ý hiển thị, nhân sự có thể sửa tay
// (spec §14: không tự động quyết định các trường hợp có ngoại lệ nghỉ/chuyển lớp).
export function estimateEndDate(
  startDate: Date | null,
  totalSessions: number | null,
  sessionsPerWeek: number | null
): Date | null {
  if (!startDate || !totalSessions || !sessionsPerWeek || sessionsPerWeek <= 0) return null;
  const weeksNeeded = Math.ceil(totalSessions / sessionsPerWeek);
  const end = new Date(startDate);
  end.setUTCDate(end.getUTCDate() + (weeksNeeded - 1) * 7);
  return end;
}

// Buổi bù/đổi buổi rơi SAU ngày kết thúc dự kiến hiện tại thì ngày kết thúc phải
// giãn theo đúng buổi đó — lớp thiếu buổi (nghỉ lễ, GV ốm...) thì phải học bù chứ
// không phải giữ nguyên cam kết ban đầu bất chấp thực tế đã thay đổi. Đây là phản
// ứng lại 1 sự việc ĐÃ xảy ra (nhân sự đã chủ động thêm/dời buổi), khác với việc
// thuật toán ước lượng tự đoán trước ngoại lệ — không mâu thuẫn với ghi chú "không
// tự động quyết định ngoại lệ" ở estimateEndDateFromRules phía trên.
export function computeExtendedEndDate(currentEnd: Date | null, candidateSessionDate: Date): Date | null {
  if (!currentEnd) return null;
  const candidate = new Date(Date.UTC(candidateSessionDate.getUTCFullYear(), candidateSessionDate.getUTCMonth(), candidateSessionDate.getUTCDate()));
  const current = new Date(Date.UTC(currentEnd.getUTCFullYear(), currentEnd.getUTCMonth(), currentEnd.getUTCDate()));
  return candidate.getTime() > current.getTime() ? candidate : null;
}

export type ScheduleRuleLike = { weekday: number; startTime: string; endTime: string; room: string | null };

// Khóa "YYYY-MM-DD" (UTC) dùng chung để tra ngày lễ — cùng định dạng với cách
// class-generation.ts so trùng ngày (candidate.sessionDate.toISOString().slice(0, 10)).
export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function estimateEndDateFromRules(
  startDate: Date | null,
  totalSessions: number | null,
  rules: ScheduleRuleLike[],
  holidayDates: Set<string> = new Set()
): Date | null {
  if (!startDate || !totalSessions || totalSessions <= 0 || rules.length === 0) return null;

  const normalizedRules = rules
    .filter((rule) => Number.isInteger(rule.weekday) && rule.weekday >= 0 && rule.weekday <= 6)
    .slice()
    .sort((a, b) => {
      if (a.weekday !== b.weekday) return a.weekday - b.weekday;
      return a.startTime.localeCompare(b.startTime);
    });

  if (normalizedRules.length === 0) return null;

  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  let countedSessions = 0;
  let guard = 0;

  while (guard < 3660) {
    // Ngày lễ trùng lịch học bị bỏ qua hoàn toàn (không tính là buổi đã dạy) — đẩy lùi
    // ngày kết thúc dự kiến đúng bằng số ngày lễ trùng lịch, xem lib/server/holidays.ts.
    if (!holidayDates.has(dateKey(cursor))) {
      const todayRules = normalizedRules.filter((rule) => rule.weekday === cursor.getUTCDay());
      for (const _rule of todayRules) {
        countedSessions += 1;
        if (countedSessions === totalSessions) {
          return new Date(cursor);
        }
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }

  return null;
}

// Sinh danh sách ngày buổi học từ ScheduleRule trong khoảng [fromDate, toDate] —
// thay cho việc gõ tay từng dòng ngày tháng như ChiTietLopHoc gốc.
//
// Dùng thuần các hàm *UTC* (không setHours/getDay theo giờ địa phương): ngày tháng
// dạng "YYYY-MM-DD" từ input HTML/JSON được parse thành UTC-midnight, và bộ lọc
// khoảng ngày ở API route cũng so sánh theo UTC. Nếu trộn lẫn giờ địa phương ở đây,
// máy chủ chạy ở múi giờ lệch UTC sẽ đẩy ngày sinh ra sớm/muộn vài giờ, khiến buổi
// đầu khoảng bị lọt ra ngoài mốc gte và bị sinh trùng mỗi lần bấm lại nút.
export function generateSessionDates(
  rules: ScheduleRuleLike[],
  fromDate: Date,
  toDate: Date,
  holidayDates: Set<string> = new Set()
): { sessionDate: Date; startTime: string; endTime: string; room: string | null }[] {
  const results: { sessionDate: Date; startTime: string; endTime: string; room: string | null }[] = [];
  const cursor = new Date(fromDate);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setUTCHours(0, 0, 0, 0);

  while (cursor.getTime() <= end.getTime()) {
    if (!holidayDates.has(dateKey(cursor))) {
      for (const rule of rules) {
        if (cursor.getUTCDay() === rule.weekday) {
          results.push({
            sessionDate: new Date(cursor),
            startTime: rule.startTime,
            endTime: rule.endTime,
            room: rule.room,
          });
        }
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return results;
}

// "Hôm nay" theo giờ Việt Nam (UTC+7 cố định, không DST) — KHÔNG dùng new Date() trực
// tiếp để so ngày, vì máy chủ có thể chạy ở múi giờ khác giờ VN, làm buổi hôm nay bị
// tính nhầm thành "đã qua"/"sắp tới" lệch cả ngày. sessionDate lưu dạng UTC-midnight
// đại diện đúng ngày lịch VN (xem generateSessionDates), nên "hôm nay" cũng phải quy
// về cùng dạng UTC-midnight mới so sánh đúng.
export function getVietnamToday(): Date {
  const vnMs = Date.now() + 7 * 60 * 60 * 1000;
  const vn = new Date(vnMs);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
}

export function isSameUtcDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

// Ghép ngày buổi học (UTC-midnight, đại diện đúng ngày lịch VN) với giờ "HH:MM" (giờ
// tường VN) thành 1 mốc thời gian UTC thật — dùng để so với "bây giờ" khi check-in/
// check-out. VN cố định UTC+7, không DST, nên trừ thẳng 7 tiếng là đúng quanh năm.
export function vnTimeToUtc(sessionDate: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const utcMs = Date.UTC(sessionDate.getUTCFullYear(), sessionDate.getUTCMonth(), sessionDate.getUTCDate(), h || 0, m || 0, 0) - 7 * 60 * 60 * 1000;
  return new Date(utcMs);
}

// Buổi so với "hôm nay" (giờ VN) — chỉ để HIỂN THỊ quan sát tiến độ, không ghi đè
// ClassSession.status (trường đó vẫn do nhân sự/điểm danh set thủ công, xem
// lib/server/class-rules.ts đầu file và app/api/sessions/[id]/attendance/route.ts).
export type SessionTiming = "past" | "today" | "upcoming";
export function computeSessionTiming(sessionDate: Date, vietnamToday: Date): SessionTiming {
  if (isSameUtcDay(sessionDate, vietnamToday)) return "today";
  return sessionDate.getTime() < vietnamToday.getTime() ? "past" : "upcoming";
}

export const WEEKDAY_LABEL = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

export const ENROLLMENT_STATUSES = ["PENDING", "ACTIVE", "PAUSED", "TRANSFERRED", "COMPLETED", "WITHDRAWN"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];
export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  PENDING: "Chờ xử lý",
  ACTIVE: "Đang học",
  PAUSED: "Tạm nghỉ",
  TRANSFERRED: "Đã chuyển lớp",
  COMPLETED: "Hoàn thành",
  WITHDRAWN: "Đã rút",
};

const ENROLLMENT_TRANSITIONS: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  PENDING: ["ACTIVE", "WITHDRAWN"],
  ACTIVE: ["PAUSED", "TRANSFERRED", "COMPLETED", "WITHDRAWN"],
  PAUSED: ["ACTIVE", "WITHDRAWN"],
  TRANSFERRED: [],
  COMPLETED: [],
  WITHDRAWN: [],
};

export function canTransitionEnrollment(from: string, to: string): boolean {
  return (ENROLLMENT_TRANSITIONS[from as EnrollmentStatus] ?? []).includes(to as EnrollmentStatus);
}

export const SESSION_STATUSES = ["PLANNED", "CONFIRMED", "COMPLETED", "CANCELLED", "RESCHEDULED"] as const;
export const SESSION_STATUS_LABEL: Record<string, string> = {
  PLANNED: "Dự kiến",
  CONFIRMED: "Đã xác nhận",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
  RESCHEDULED: "Đã dời lịch",
};
