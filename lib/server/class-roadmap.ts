import { prisma } from "@/lib/prisma";

function buildDefaultRoadmapTitle(sessionNumber: number) {
  return `Buổi ${sessionNumber}`;
}

export async function ensureClassRoadmapItems(classId: string, totalSessions: number | null | undefined) {
  const normalizedTotal = Number(totalSessions ?? 0);
  if (!Number.isInteger(normalizedTotal) || normalizedTotal <= 0) return [];

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
