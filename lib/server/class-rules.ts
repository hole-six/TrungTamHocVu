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

export type ScheduleRuleLike = { weekday: number; startTime: string; endTime: string; room: string | null };

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
  toDate: Date
): { sessionDate: Date; startTime: string; endTime: string; room: string | null }[] {
  const results: { sessionDate: Date; startTime: string; endTime: string; room: string | null }[] = [];
  const cursor = new Date(fromDate);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setUTCHours(0, 0, 0, 0);

  while (cursor.getTime() <= end.getTime()) {
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
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return results;
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
