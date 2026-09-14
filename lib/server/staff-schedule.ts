import type { Prisma, PrismaClient } from "@prisma/client";

// CHẶN TRÙNG LỊCH GV/TG: một người không thể đứng 2 lớp cùng lúc.
//
// Hai buổi cùng ngày TRÙNG khi khoảng giờ chồng lên nhau: 07:00–08:30 và 07:00–08:30,
// 07:00–08:30 và 08:00–09:30 đều trùng. Nối tiếp nhau (08:30 kết thúc, 08:30 bắt đầu)
// thì KHÔNG trùng. Không tính:
//   - buổi đã hủy / đã dời (không diễn ra);
//   - phân công đã có người dạy thay (người gốc không đứng lớp buổi đó).

type Db = PrismaClient | Prisma.TransactionClient;

export type StaffSlot = {
  /** Buổi đang xét — bỏ qua chính nó khi so. Truyền thẳng bản ghi buổi học (có `id`) cũng được. */
  sessionId?: string | null;
  id?: string;
  sessionDate: Date;
  startTime: string | null;
  endTime: string | null;
};

export type StaffConflict = {
  slot: StaffSlot;
  otherSessionId: string;
  classCode: string;
  className: string;
  sessionDate: Date;
  startTime: string | null;
  endTime: string | null;
};

export function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function formatDayVn(date: Date) {
  const [y, m, d] = dayKey(date).split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Tìm các buổi KHÁC mà nhân sự đã đứng lớp chồng giờ với từng khung giờ cần xếp.
 * ignoreSessionIds: các buổi coi như không còn (vd buổi gốc đang được dời đi).
 */
export async function findStaffConflicts(
  db: Db,
  employeeId: string,
  slots: StaffSlot[],
  options?: { ignoreSessionIds?: string[] },
): Promise<StaffConflict[]> {
  const usable = slots.filter((slot) => slot.startTime && slot.endTime);
  if (usable.length === 0) return [];
  const dates = [...new Set(usable.map((slot) => dayKey(slot.sessionDate)))].map((key) => new Date(`${key}T00:00:00.000Z`));

  const busy = await db.sessionAssignment.findMany({
    where: {
      employeeId,
      substitutedBy: { is: null },
      session: {
        sessionDate: { in: dates },
        status: { notIn: ["CANCELLED", "RESCHEDULED"] },
        ...(options?.ignoreSessionIds?.length ? { id: { notIn: options.ignoreSessionIds } } : {}),
      },
    },
    select: {
      session: {
        select: { id: true, sessionDate: true, startTime: true, endTime: true, class: { select: { classCode: true, className: true } } },
      },
    },
  });

  const conflicts: StaffConflict[] = [];
  for (const slot of usable) {
    for (const { session } of busy) {
      // Không so buổi với chính nó. Trước đây chỉ đọc slot.sessionId trong khi hầu hết nơi gọi
      // truyền bản ghi buổi học (khóa là `id`) → trợ giảng của CHÍNH buổi đó dạy thay giáo viên
      // bị báo nhầm là trùng lịch với buổi mình đang đứng.
      if (session.id === (slot.sessionId ?? slot.id)) continue;
      if (dayKey(session.sessionDate) !== dayKey(slot.sessionDate)) continue;
      if (!session.startTime || !session.endTime) continue;
      if (!timeRangesOverlap(slot.startTime!, slot.endTime!, session.startTime, session.endTime)) continue;
      conflicts.push({
        slot,
        otherSessionId: session.id,
        classCode: session.class.classCode,
        className: session.class.className,
        sessionDate: session.sessionDate,
        startTime: session.startTime,
        endTime: session.endTime,
      });
    }
  }
  return conflicts;
}

export function describeStaffConflicts(employeeName: string, conflicts: StaffConflict[], limit = 3): string {
  const lines = conflicts
    .slice(0, limit)
    .map((c) => `${formatDayVn(c.sessionDate)} ${c.startTime}–${c.endTime} lớp ${c.classCode}`);
  const more = conflicts.length > limit ? ` và ${conflicts.length - limit} buổi khác` : "";
  return `${employeeName} bị trùng lịch: đã có lịch dạy ${lines.join("; ")}${more}.`;
}
