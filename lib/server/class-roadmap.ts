import { prisma } from "@/lib/prisma";

function buildDefaultRoadmapTitle(sessionNumber: number) {
  return `Buổi ${sessionNumber}`;
}

// totalSessions là SỐ BUỔI DỰ KIẾN của lớp, không phải trần cứng: lớp chạy chậm hơn kế
// hoạch, có buổi bù, hoặc kéo dài thêm là chuyện bình thường. Nếu lộ trình chỉ sinh đúng
// totalSessions mục thì những buổi vượt kế hoạch sẽ không có giáo án nào gắn vào, và
// trang lớp hiện buổi trống trơn mà không ai hiểu vì sao.
//
// Vì vậy lộ trình dài bằng SỐ LỚN HƠN giữa: số buổi dự kiến và số buổi lớp đã thật sự
// lên lịch. Cách này cũng là bước cần thiết nếu sau này bỏ hẳn totalSessions.
export async function ensureClassRoadmapItems(classId: string, totalSessions: number | null | undefined) {
  const plannedTotal = Number(totalSessions ?? 0);
  const scheduledCount = await prisma.classSession.count({
    where: { classId, status: { notIn: ["CANCELLED", "RESCHEDULED"] } },
  });
  const normalizedTotal = Math.max(Number.isInteger(plannedTotal) ? plannedTotal : 0, scheduledCount);
  if (normalizedTotal <= 0) return [];

  const existing = await prisma.classRoadmapItem.findMany({
    where: { classId },
    orderBy: { sessionNumber: "asc" },
  });

  const existingNumbers = new Set(existing.map((item) => item.sessionNumber));
  const missingNumbers: number[] = [];
  for (let sessionNumber = 1; sessionNumber <= normalizedTotal; sessionNumber += 1) {
    if (!existingNumbers.has(sessionNumber)) missingNumbers.push(sessionNumber);
  }

  if (missingNumbers.length > 0) {
    await prisma.classRoadmapItem.createMany({
      data: missingNumbers.map((sessionNumber) => ({
        classId,
        sessionNumber,
        title: buildDefaultRoadmapTitle(sessionNumber),
      })),
    });
  }

  return prisma.classRoadmapItem.findMany({
    where: { classId, sessionNumber: { lte: normalizedTotal } },
    orderBy: { sessionNumber: "asc" },
  });
}

export function inferRoadmapTitle(sessionNumber: number, currentTitle: string | null | undefined) {
  const trimmed = String(currentTitle ?? "").trim();
  return trimmed || buildDefaultRoadmapTitle(sessionNumber);
}

export function normalizeRoadmapItemsInput(
  items: unknown,
  totalSessions: number | null | undefined,
): Array<{
  sessionNumber: number;
  title: string;
  objective: string | null;
  materials: string | null;
  teacherGuide: string | null;
  homeworkGuide: string | null;
  teacherRequirement: string | null;
}> {
  const normalizedTotal = Number(totalSessions ?? 0);
  if (!Array.isArray(items) || !Number.isInteger(normalizedTotal) || normalizedTotal <= 0) return [];

  const cleaned = items
    .map((item) => {
      const source = item as Record<string, unknown>;
      const sessionNumber = Number(source.sessionNumber);
      if (!Number.isInteger(sessionNumber) || sessionNumber <= 0 || sessionNumber > normalizedTotal) return null;
      return {
        sessionNumber,
        title: inferRoadmapTitle(sessionNumber, source.title as string | null | undefined),
        objective: String(source.objective ?? "").trim() || null,
        materials: String(source.materials ?? "").trim() || null,
        teacherGuide: String(source.teacherGuide ?? "").trim() || null,
        homeworkGuide: String(source.homeworkGuide ?? "").trim() || null,
        teacherRequirement: String(source.teacherRequirement ?? "").trim() || null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const bySession = new Map<number, (typeof cleaned)[number]>();
  for (const item of cleaned) bySession.set(item.sessionNumber, item);

  return Array.from(bySession.values()).sort((a, b) => a.sessionNumber - b.sessionNumber);
}
