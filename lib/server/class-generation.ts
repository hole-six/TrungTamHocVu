// Sinh ClassSession — tách riêng khỏi class-rules.ts (file đó được
// components/classes/ScheduleRuleManager.tsx — 1 client component — import trực
// tiếp; nếu thêm import prisma vào class-rules.ts sẽ kéo Prisma Client vào bundle
// trình duyệt). File này chỉ được gọi từ route handler và scheduler (server-only).
import { prisma } from "@/lib/prisma";
import { generateSessionDates } from "@/lib/server/class-rules";

export async function createSessionsInRange(classId: string, fromDate: Date, toDate: Date) {
  const cls = await prisma.class.findUnique({ where: { id: classId }, include: { scheduleRules: true } });
  if (!cls) throw new Error("Không tìm thấy lớp");
  if (cls.scheduleRules.length === 0) return { created: 0, skipped: 0 };

  const candidates = generateSessionDates(cls.scheduleRules, fromDate, toDate);

  const existing = await prisma.classSession.findMany({
    where: { classId, sessionDate: { gte: fromDate, lte: toDate } },
    select: { sessionDate: true },
  });
  const existingDates = new Set(existing.map((s) => s.sessionDate.toISOString().slice(0, 10)));

  const toCreate = candidates.filter((c) => !existingDates.has(c.sessionDate.toISOString().slice(0, 10)));

  if (toCreate.length > 0) {
    await prisma.classSession.createMany({
      data: toCreate.map((c) => ({
        classId,
        sessionDate: c.sessionDate,
        startTime: c.startTime,
        endTime: c.endTime,
        room: c.room,
        status: "PLANNED",
      })),
    });
  }

  return { created: toCreate.length, skipped: candidates.length - toCreate.length };
}

const MAX_SPAN_MS = 1000 * 60 * 60 * 24 * 120; // khớp giới hạn 120 ngày/lần của route generate-sessions

// Tính khoảng ngày cần sinh thêm cho 1 lớp để luôn có buổi học sẵn trước windowDays
// ngày kể từ hôm nay. Điểm bắt đầu là ngày SAU buổi học cuối cùng đã có (hoặc ngày
// khai giảng nếu lớp chưa có buổi nào) — không phải "hôm nay" — để không bỏ sót
// khoảng trống nếu server từng tắt lâu ngày (xem lib/server/scheduling.ts).
export async function computeAutoSessionWindow(
  classId: string,
  windowDays = 30
): Promise<{ fromDate: Date; toDate: Date } | null> {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) return null;

  const maxSession = await prisma.classSession.aggregate({ where: { classId }, _max: { sessionDate: true } });
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let fromDate: Date;
  if (maxSession._max.sessionDate) {
    fromDate = new Date(maxSession._max.sessionDate);
    fromDate.setUTCDate(fromDate.getUTCDate() + 1);
  } else if (cls.startDate) {
    fromDate = new Date(cls.startDate);
  } else {
    return null; // không có mốc nào để bắt đầu sinh
  }

  const targetToDate = new Date(today);
  targetToDate.setUTCDate(targetToDate.getUTCDate() + windowDays);

  if (fromDate.getTime() > targetToDate.getTime()) return null; // đã sinh đủ trước, không có gì để làm

  // Lớp "treo" lâu ngày (chưa từng sinh buổi) có thể cần khoảng xa hơn 120 ngày —
  // giới hạn lại mỗi lần chạy, các lượt sweep ngày sau sẽ tiếp tục đuổi kịp dần.
  let toDate = targetToDate;
  if (toDate.getTime() - fromDate.getTime() > MAX_SPAN_MS) {
    toDate = new Date(fromDate.getTime() + MAX_SPAN_MS);
  }

  if (cls.expectedEndDate && toDate.getTime() > cls.expectedEndDate.getTime()) {
    if (fromDate.getTime() > cls.expectedEndDate.getTime()) return null; // lớp đã qua ngày dự kiến kết thúc
    toDate = cls.expectedEndDate;
  }

  return { fromDate, toDate };
}

// Tiến độ học của 1 enrollment trong lớp — đếm buổi ĐÃ DIỄN RA (status COMPLETED)
// kể từ enrollDate của CHÍNH enrollment đó, không phải toàn bộ buổi của lớp. Học
// viên vào giữa khóa (lớp đã học được vài buổi trước khi họ ghi danh) thì các buổi
// trước enrollDate không tính vào "đã học" của họ — khớp đúng cách billing-generation
// đang định nghĩa "buổi đã tiêu" (completed sessions), chỉ khác là ở đây tính mốc bắt
// đầu theo TỪNG học viên thay vì theo kỳ thu chung.
export async function computeEnrollmentSessionProgress(classId: string, enrollDate: Date) {
  const [cls, consumed] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, select: { totalSessions: true, expectedEndDate: true } }),
    prisma.classSession.count({
      where: { classId, status: "COMPLETED", sessionDate: { gte: enrollDate } },
    }),
  ]);

  const planned = cls?.totalSessions ?? null;
  const remaining = planned !== null ? planned - consumed : null;
  // Lớp coi như đã hết hạn khi qua ngày dự kiến kết thúc — lúc đó "remaining > 0"
  // nghĩa là học viên còn bị thiếu buổi (do vào muộn) cần bảo lưu/học bù ở lớp khác,
  // không phải lỗi tính toán.
  const classEnded = cls?.expectedEndDate ? cls.expectedEndDate.getTime() < Date.now() : false;

  return { consumed, planned, remaining, classEnded };
}
