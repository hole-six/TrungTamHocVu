import { computeSessionNumbers, type NumberableSession } from "@/lib/session-numbering";
import { computeSessionTiming, generateSessionDates, type SessionTiming } from "@/lib/server/class-rules";

// DANH SÁCH BUỔI CỦA LỚP (tab "Buổi học" ở trang lớp và drawer lớp).
//
// Trước đây danh sách này dựng từ LỊCH DỰ KIẾN (lịch cố định từ ngày khai giảng) rồi ghép buổi
// thật theo ngày: số buổi và tài liệu đi theo lịch dự kiến nên trung tâm cho nghỉ thì nội dung
// không dồn lên, buổi bù rơi vào ngày không có trong lịch cố định thì biến mất khỏi danh sách.
//
// Bây giờ: mọi buổi THẬT (kể cả buổi nghỉ, buổi đã dời để nhìn thấy lịch sử), đánh số theo
// lib/session-numbering.ts; sau buổi thật cuối cùng mới nối các buổi DỰ KIẾN (chưa sinh) theo
// lịch cố định, bỏ ngày nghỉ lễ, đến khi đủ tổng số buổi của lớp.

export type ScheduleSessionLike = NumberableSession & { sessionDate: Date; endTime: string | null };

export type ClassScheduleRow<T> = {
  key: string;
  kind: "SESSION" | "PROJECTED";
  /** Số buổi trong lộ trình — null với buổi nghỉ / buổi gốc đã dời. */
  number: number | null;
  /** Buổi gốc đã dời: số buổi đã chuyển sang buổi bù. */
  movedNumber: number | null;
  sessionDate: Date;
  startTime: string | null;
  endTime: string | null;
  timing: SessionTiming;
  session: T | null;
};

export function buildClassScheduleRows<T extends ScheduleSessionLike>(params: {
  sessions: T[];
  rules: { weekday: number; startTime: string; endTime: string; room: string | null }[];
  holidayDates: Set<string>;
  totalSessions: number | null;
  startDate: Date | null;
  today: Date;
}): { rows: ClassScheduleRow<T>[]; total: number } {
  const numbering = computeSessionNumbers(params.sessions);
  const sorted = [...params.sessions].sort(
    (a, b) =>
      a.sessionDate.getTime() - b.sessionDate.getTime() ||
      (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
      a.id.localeCompare(b.id),
  );
  const rows: ClassScheduleRow<T>[] = sorted.map((session) => ({
    key: session.id,
    kind: "SESSION",
    number: numbering.numberById.get(session.id) ?? null,
    movedNumber: numbering.movedNumberById.get(session.id) ?? null,
    sessionDate: session.sessionDate,
    startTime: session.startTime ?? null,
    endTime: session.endTime,
    timing: computeSessionTiming(session.sessionDate, params.today),
    session,
  }));

  const total = Math.max(params.totalSessions ?? 0, numbering.count);
  const missing = total - numbering.count;
  if (missing > 0 && params.rules.length > 0) {
    const last = sorted.at(-1)?.sessionDate ?? null;
    const from = last ? new Date(last.getTime() + 86_400_000) : params.startDate;
    if (from) {
      const to = new Date(from.getTime() + 3 * 366 * 86_400_000);
      let number = numbering.count;
      for (const slot of generateSessionDates(params.rules, from, to, params.holidayDates)) {
        if (number >= total) break;
        number += 1;
        rows.push({
          key: `projected-${slot.sessionDate.toISOString()}-${slot.startTime}`,
          kind: "PROJECTED",
          number,
          movedNumber: null,
          sessionDate: slot.sessionDate,
          startTime: slot.startTime,
          endTime: slot.endTime,
          timing: computeSessionTiming(slot.sessionDate, params.today),
          session: null,
        });
      }
    }
  }
  return { rows, total };
}
