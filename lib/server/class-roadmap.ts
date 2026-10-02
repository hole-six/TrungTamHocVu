import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";

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
  alertLevel: RoadmapAlertLevel;
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
        alertLevel: normalizeAlertLevel(source.alertLevel),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const bySession = new Map<number, (typeof cleaned)[number]>();
  for (const item of cleaned) bySession.set(item.sessionNumber, item);

  return Array.from(bySession.values()).sort((a, b) => a.sessionNumber - b.sessionNumber);
}

// ---------------------------------------------------------------------------------
// TIẾN TRÌNH DÙNG CHUNG CỦA KHÓA HỌC (chốt 10/2026)
//
// Tiến trình soạn MỘT LẦN ở khóa (CourseRoadmapItem), mọi lớp cùng khóa dùng chung. Lớp
// muốn khác ở buổi nào thì ghi đè đúng buổi đó bằng ClassRoadmapItem; các buổi còn lại
// vẫn bám khóa, nên sửa ở khóa là mọi lớp đang chạy đổi theo.
//
// Mọi nơi cần đọc tiến trình của một lớp (trang buổi học, nhật ký, thời khóa biểu, sổ
// tay giáo viên) phải đi qua resolveClassRoadmap — không truy vấn thẳng bảng nữa, nếu
// không hai màn hình sẽ hiện hai nội dung khác nhau cho cùng một buổi.

export type RoadmapSource = "class" | "course" | "empty";

/** Mức CẢNH BÁO CHUYÊN MÔN của một buổi — xem ghi chú ở schema.prisma. */
export type RoadmapAlertLevel = "NONE" | "YELLOW" | "RED";

export const ROADMAP_ALERT_LABEL: Record<RoadmapAlertLevel, string> = {
  NONE: "Không cảnh báo",
  YELLOW: "Cần lưu ý",
  RED: "Bắt buộc, có hạn",
};

export function normalizeAlertLevel(value: unknown): RoadmapAlertLevel {
  const text = String(value ?? "").trim().toUpperCase();
  return text === "YELLOW" || text === "RED" ? text : "NONE";
}

export type ResolvedRoadmapItem = {
  sessionNumber: number;
  title: string;
  objective: string | null;
  materials: string | null;
  teacherGuide: string | null;
  homeworkGuide: string | null;
  teacherRequirement: string | null;
  /** Buổi này có bị ép làm việc gì không, và ở mức nào. */
  alertLevel: RoadmapAlertLevel;
  /** Nội dung này đến từ đâu — để màn sửa biết buổi nào đang "theo khóa". */
  source: RoadmapSource;
};

type RoadmapLike = {
  sessionNumber: number;
  title?: string | null;
  objective?: string | null;
  materials?: string | null;
  teacherGuide?: string | null;
  homeworkGuide?: string | null;
  teacherRequirement?: string | null;
  alertLevel?: string | null;
};

/**
 * Dòng tiến trình của lớp này có phải GHI ĐÈ THẬT không.
 *
 * Quan trọng khi nâng cấp: lớp cũ đã có sẵn một dòng cho MỌI buổi, phần lớn là dòng
 * trống chỉ mang tiêu đề mặc định "Buổi 7". Những dòng đó không được tính là ghi đè, nếu
 * không gắn khóa vào lớp cũ sẽ chẳng thấy nội dung nào của khóa cả.
 */
export function isRealRoadmapOverride(item: RoadmapLike): boolean {
  const hasContent = Boolean(
    (item.objective ?? "").trim() ||
      (item.materials ?? "").trim() ||
      (item.teacherGuide ?? "").trim() ||
      (item.homeworkGuide ?? "").trim() ||
      (item.teacherRequirement ?? "").trim(),
  );
  // Bật cảnh báo chuyên môn cũng là một quyết định của lớp, kể cả khi chưa điền nội
  // dung — không được coi là dòng trống rồi bị tiến trình khóa đè lên.
  if (normalizeAlertLevel(item.alertLevel) !== "NONE") return true;
  if (hasContent) return true;
  const title = (item.title ?? "").trim();
  return Boolean(title) && title !== buildDefaultRoadmapTitle(item.sessionNumber);
}

type RoadmapDb = Pick<PrismaClient, "class" | "classRoadmapItem" | "courseRoadmapItem" | "classSession">;

/**
 * Tiến trình thực tế của một lớp: gộp tiến trình khóa với các buổi lớp đã ghi đè.
 *
 * Số buổi lấy theo đúng quy tắc của ensureClassRoadmapItems — số lớn hơn giữa số buổi dự
 * kiến và số buổi đã thật sự lên lịch, để buổi vượt kế hoạch không bị rơi mất giáo án.
 */
export async function resolveClassRoadmap(db: RoadmapDb, classId: string): Promise<ResolvedRoadmapItem[]> {
  const cls = await db.class.findUnique({
    where: { id: classId },
    select: { id: true, courseId: true, totalSessions: true },
  });
  if (!cls) return [];

  const [scheduledCount, classItems, courseItems] = await Promise.all([
    db.classSession.count({ where: { classId, status: { notIn: ["CANCELLED", "RESCHEDULED"] } } }),
    db.classRoadmapItem.findMany({ where: { classId }, orderBy: { sessionNumber: "asc" } }),
    cls.courseId
      ? db.courseRoadmapItem.findMany({ where: { courseId: cls.courseId }, orderBy: { sessionNumber: "asc" } })
      : Promise.resolve([]),
  ]);

  const planned = Number.isInteger(cls.totalSessions) ? Number(cls.totalSessions) : 0;
  const total = Math.max(
    planned,
    scheduledCount,
    ...classItems.map((item) => item.sessionNumber),
    ...courseItems.map((item) => item.sessionNumber),
    0,
  );
  if (total <= 0) return [];

  const classBySession = new Map(classItems.map((item) => [item.sessionNumber, item]));
  const courseBySession = new Map(courseItems.map((item) => [item.sessionNumber, item]));

  const rows: ResolvedRoadmapItem[] = [];
  for (let sessionNumber = 1; sessionNumber <= total; sessionNumber += 1) {
    const classItem = classBySession.get(sessionNumber);
    const courseItem = courseBySession.get(sessionNumber);
    const overridden = Boolean(classItem && isRealRoadmapOverride(classItem));
    const picked = overridden ? classItem! : (courseItem ?? classItem ?? null);
    // Dòng trống mặc định của lớp (chỉ có tiêu đề "Buổi 7") không phải nội dung thật —
    // vẫn tính là TRỐNG để màn hình biết buổi đó chưa ai soạn gì.
    const source: RoadmapSource = overridden ? "class" : courseItem ? "course" : "empty";

    rows.push({
      sessionNumber,
      title: inferRoadmapTitle(sessionNumber, picked?.title),
      objective: picked?.objective ?? null,
      materials: picked?.materials ?? null,
      teacherGuide: picked?.teacherGuide ?? null,
      homeworkGuide: picked?.homeworkGuide ?? null,
      teacherRequirement: picked?.teacherRequirement ?? null,
      alertLevel: normalizeAlertLevel(picked?.alertLevel),
      source,
    });
  }
  return rows;
}
