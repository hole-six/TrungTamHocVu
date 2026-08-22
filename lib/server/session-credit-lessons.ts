import { prisma } from "@/lib/prisma";

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
          select: { id: true, classId: true },
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

  const sessionNumberById = new Map<string, number>();
  const orderByClass = new Map<string, number>();
  for (const session of classSessions) {
    const nextNumber = (orderByClass.get(session.classId) ?? 0) + 1;
    orderByClass.set(session.classId, nextNumber);
    sessionNumberById.set(session.id, nextNumber);
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
