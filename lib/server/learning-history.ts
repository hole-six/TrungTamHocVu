import type { Prisma, PrismaClient } from "@prisma/client";
import { computeSessionNumbers } from "@/lib/session-numbering";

// LỊCH SỬ HỌC TẬP của một học viên — mọi buổi đã học kèm điểm nhật ký, để thấy con tiến bộ
// tới đâu qua từng buổi.
//
// ĐIỂM LẤY TỪ ĐÂU (phải nói rõ được với phụ huynh):
//   Mỗi buổi học có một nhật ký lớp (ClassSessionJournal). Trong đó mỗi học viên có một dòng
//   (JournalEntry), và dòng đó có NHIỀU CỘT ĐIỂM (JournalScore): "Vấn đáp", "Minitest từ",
//   "Nghe"... mỗi cột có thang điểm riêng (maxScore, thường là 10).
//
//   Điểm của một buổi = TRUNG BÌNH các cột có điểm của buổi đó, mỗi cột QUY VỀ THANG 10
//   trước khi cộng (7/8 thành 8,75). Quy về thang 10 trước là để một bài kiểm tra chấm
//   thang 20 không lấn át cột vấn đáp thang 10.
//
//   Điểm trung bình = TRUNG BÌNH điểm các buổi có điểm. Mỗi buổi nặng như nhau — buổi chấm
//   3 cột không được tính nặng gấp 3 buổi chấm 1 cột.
//
//   Buổi vắng hoặc buổi chưa nhập điểm KHÔNG kéo điểm trung bình xuống 0: không có điểm thì
//   không tính, chứ không coi là điểm 0.

export type LearningHistoryScore = {
  label: string;
  score: number;
  maxScore: number;
  outOfTen: number;
  /** Điểm nằm ngoài 0..maxScore (nhập sai từ trước khi có chốt chặn) — hiện ra nhưng KHÔNG tính. */
  invalid: boolean;
};

export type LearningHistoryItem = {
  sessionId: string;
  classId: string;
  className: string;
  sessionDate: string;
  sessionNumber: number | null;
  attendanceStatus: string | null;
  lessonTitle: string | null;
  journalStatus: "PUBLISHED" | "DRAFT" | "NONE";
  comment: string | null;
  homeworkStatus: string | null;
  scores: LearningHistoryScore[];
  sessionScore: number | null;
  /** Chênh lệch so với BUỔI CÓ ĐIỂM liền trước (không phải buổi liền trước). */
  deltaFromPrevious: number | null;
};

export type LearningHistory = {
  summary: {
    totalSessions: number;
    scoredSessions: number;
    averageScore: number | null;
    byLabel: { label: string; average: number; count: number }[];
    firstScore: number | null;
    latestScore: number | null;
  };
  /** Điểm các buổi có điểm theo thứ tự thời gian — dãy để nhìn tiến bộ. */
  progression: { sessionDate: string; className: string; score: number }[];
  items: LearningHistoryItem[];
  page: number;
  pageSize: number;
  totalPages: number;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

export async function getStudentLearningHistory(
  db: PrismaClient | Prisma.TransactionClient,
  studentId: string,
  options?: { page?: number; pageSize?: number },
): Promise<LearningHistory> {
  const pageSize = Math.min(Math.max(options?.pageSize ?? 10, 1), 50);

  // Buổi có liên quan tới học viên = có điểm danh HOẶC có dòng nhật ký. Lấy cả hai vì có
  // trường hợp giáo viên nhập điểm nhật ký mà quên lưu điểm danh — bỏ đi là mất điểm thật.
  const [attendances, entries] = await Promise.all([
    db.studentAttendance.findMany({
      where: { studentId },
      select: { sessionId: true, status: true },
    }),
    db.journalEntry.findMany({
      where: { studentId },
      select: {
        comment: true,
        homeworkStatus: true,
        scores: { select: { label: true, score: true, maxScore: true } },
        journal: { select: { sessionId: true, publishedAt: true, unitLesson: true } },
      },
    }),
  ]);

  const attendanceBySession = new Map(attendances.map((item) => [item.sessionId, item.status]));
  const entryBySession = new Map(entries.map((item) => [item.journal.sessionId, item]));
  const sessionIds = [...new Set([...attendanceBySession.keys(), ...entryBySession.keys()])];

  const sessions = sessionIds.length
    ? await db.classSession.findMany({
        where: { id: { in: sessionIds } },
        select: {
          id: true,
          classId: true,
          sessionDate: true,
          startTime: true,
          journal: { select: { publishedAt: true, unitLesson: true } },
          class: { select: { className: true } },
        },
      })
    : [];

  // Số thứ tự buổi trong lớp + tên bài theo lộ trình — cùng quy tắc với trang buổi học: buổi
  // thứ k lấy nội dung mục thứ k — đánh số theo lib/session-numbering.ts (nghỉ thì dồn, dời thì giữ).
  const classIds = [...new Set(sessions.map((item) => item.classId))];
  const plans = classIds.length
    ? await db.class.findMany({
        where: { id: { in: classIds } },
        select: {
          id: true,
          sessions: { orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }], select: { id: true, sessionDate: true, startTime: true, status: true, replacesSessionId: true }, },
          roadmapItems: { select: { sessionNumber: true, title: true } },
        },
      })
    : [];
  const numberBySession = new Map<string, number>();
  const titleByClassNumber = new Map<string, string>();
  for (const plan of plans) {
    for (const [id, number] of computeSessionNumbers(plan.sessions).numberById) numberBySession.set(id, number);
    for (const item of plan.roadmapItems) titleByClassNumber.set(`${plan.id}:${item.sessionNumber}`, item.title);
  }

  // Tính theo thứ tự THỜI GIAN để ra chênh lệch với buổi có điểm liền trước.
  const chronological = [...sessions].sort(
    (a, b) => a.sessionDate.getTime() - b.sessionDate.getTime() || (a.startTime ?? "").localeCompare(b.startTime ?? ""),
  );

  let previousScore: number | null = null;
  const allItems: LearningHistoryItem[] = chronological.map((session) => {
    const entry = entryBySession.get(session.id);
    const scores: LearningHistoryScore[] = (entry?.scores ?? [])
      .filter((item) => item.score !== null)
      .map((item) => {
        const score = item.score as number;
        // Dữ liệu cũ có điểm nhập sai (123/10...). Không xóa dấu vết — vẫn trả về để giao diện
        // hiện ra cho người sửa — nhưng không cho kéo lệch điểm buổi và điểm trung bình.
        const invalid = !(item.maxScore > 0) || score < 0 || score > item.maxScore;
        return {
          label: item.label,
          score,
          maxScore: item.maxScore,
          outOfTen: invalid ? 0 : round1((score / item.maxScore) * 10),
          invalid,
        };
      });
    const validScores = scores.filter((item) => !item.invalid);
    const sessionScore = validScores.length
      ? round1(validScores.reduce((sum, item) => sum + (item.score / item.maxScore) * 10, 0) / validScores.length)
      : null;
    const deltaFromPrevious = sessionScore !== null && previousScore !== null ? round1(sessionScore - previousScore) : null;
    if (sessionScore !== null) previousScore = sessionScore;

    const sessionNumber = numberBySession.get(session.id) ?? null;
    const roadmapTitle = sessionNumber ? titleByClassNumber.get(`${session.classId}:${sessionNumber}`) ?? null : null;
    const journal = session.journal;

    return {
      sessionId: session.id,
      classId: session.classId,
      className: session.class.className,
      sessionDate: session.sessionDate.toISOString().slice(0, 10),
      sessionNumber,
      attendanceStatus: attendanceBySession.get(session.id) ?? null,
      lessonTitle: journal?.unitLesson?.trim() || roadmapTitle || null,
      journalStatus: journal?.publishedAt ? "PUBLISHED" : journal ? "DRAFT" : "NONE",
      comment: entry?.comment?.trim() || null,
      homeworkStatus: entry?.homeworkStatus ?? null,
      scores,
      sessionScore,
      deltaFromPrevious,
    };
  });

  const scored = allItems.filter((item) => item.sessionScore !== null);
  const labelBuckets = new Map<string, number[]>();
  for (const item of scored) {
    for (const score of item.scores.filter((entry) => !entry.invalid)) labelBuckets.set(score.label, [...(labelBuckets.get(score.label) ?? []), score.outOfTen]);
  }

  // Trang mới nhất trước — xem lịch sử thường là xem gần đây.
  const newestFirst = [...allItems].reverse();
  const totalPages = Math.max(1, Math.ceil(newestFirst.length / pageSize));
  const page = Math.min(Math.max(options?.page ?? 1, 1), totalPages);

  return {
    summary: {
      totalSessions: allItems.length,
      scoredSessions: scored.length,
      averageScore: scored.length ? round1(scored.reduce((sum, item) => sum + (item.sessionScore as number), 0) / scored.length) : null,
      byLabel: [...labelBuckets.entries()]
        .map(([label, values]) => ({ label, count: values.length, average: round1(values.reduce((a, b) => a + b, 0) / values.length) }))
        .sort((a, b) => b.count - a.count),
      firstScore: scored[0]?.sessionScore ?? null,
      latestScore: scored.at(-1)?.sessionScore ?? null,
    },
    progression: scored.map((item) => ({ sessionDate: item.sessionDate, className: item.className, score: item.sessionScore as number })),
    items: newestFirst.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalPages,
  };
}
