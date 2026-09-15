import { prisma } from "@/lib/prisma";
import { computeSessionNumbers } from "@/lib/session-numbering";

// Dùng chung cho app/(app)/session-credits/page.tsx và RemedialSessionRoster —
// cả 2 nơi đều cần trả lời "buổi vắng đó là buổi nào, hôm đó dạy bài gì" cho 1 danh
// sách SessionCredit, để người xử lý bổ trợ dạy đúng nội dung học viên đã bỏ lỡ.
type CreditForLesson = {
  id: string;
  sourceSession: {
    id: string;
    classId: string;
    sessionDate: Date;
    class: { className: string };
    journal?: { unitLesson: string | null; teacherNote: string | null } | null;
  } | null;
};

export type SourceLessonDetail = {
  id: string;
  classId: string;
  className: string;
  date: Date;
  sessionNumber: number | null;
  lesson: string | null;
  objective: string | null;
};

export async function resolveSourceLessonDetails(credits: CreditForLesson[]): Promise<Map<string, SourceLessonDetail>> {
  const classIds = [
    ...new Set(credits.map((credit) => credit.sourceSession?.classId).filter((id): id is string => Boolean(id))),
  ];

  const [classSessions, roadmapItems] = await Promise.all([
    classIds.length
      ? prisma.classSession.findMany({
          where: { classId: { in: classIds } },
          select: { id: true, classId: true, sessionDate: true, startTime: true, status: true, replacesSessionId: true },
          orderBy: [{ classId: "asc" }, { sessionDate: "asc" }, { startTime: "asc" }, { id: "asc" }],
        })
      : Promise.resolve([]),
    classIds.length
      ? prisma.classRoadmapItem.findMany({
          where: { classId: { in: classIds } },
          select: { classId: true, sessionNumber: true, title: true, objective: true },
        })
      : Promise.resolve([]),
  ]);

  // Đánh số theo quy tắc chung (trước đây đếm cả buổi đã hủy/đã dời nên lệch bài).
  const sessionNumberById = new Map<string, number>();
  const sessionsByClass = new Map<string, typeof classSessions>();
  for (const session of classSessions) sessionsByClass.set(session.classId, [...(sessionsByClass.get(session.classId) ?? []), session]);
  for (const list of sessionsByClass.values()) {
    for (const [id, number] of computeSessionNumbers(list).numberById) sessionNumberById.set(id, number);
  }
  const roadmapByClassAndNumber = new Map(roadmapItems.map((item) => [`${item.classId}:${item.sessionNumber}`, item]));

  const result = new Map<string, SourceLessonDetail>();
  for (const credit of credits) {
    const session = credit.sourceSession;
    if (!session) continue;
    const sessionNumber = sessionNumberById.get(session.id) ?? null;
    const roadmap = sessionNumber ? roadmapByClassAndNumber.get(`${session.classId}:${sessionNumber}`) : null;
    result.set(credit.id, {
      id: session.id,
      classId: session.classId,
      className: session.class.className,
      date: session.sessionDate,
      sessionNumber,
      lesson: session.journal?.unitLesson || roadmap?.title || null,
      objective: roadmap?.objective || session.journal?.teacherNote || null,
    });
  }
  return result;
}
