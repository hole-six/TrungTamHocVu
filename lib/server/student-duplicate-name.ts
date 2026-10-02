import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export type DuplicateStudentNameMatch = {
  id: string;
  studentCode: string;
  fullName: string;
  dob: Date | null;
  currentClassName: string | null;
  currentClassCode: string | null;
};

export class DuplicateStudentNameError extends Error {
  matches: DuplicateStudentNameMatch[];
  suggestions: string[];

  constructor(matches: DuplicateStudentNameMatch[], suggestions: string[]) {
    const first = matches[0];
    const details = matches
      .map((item) => {
        const dob = item.dob ? item.dob.toLocaleDateString("vi-VN", { timeZone: "UTC" }) : "chưa có ngày sinh";
        const cls = item.currentClassName
          ? `${item.currentClassCode ? `[${item.currentClassCode}] ` : ""}${item.currentClassName}`
          : "chưa có lớp";
        return `${item.fullName} (${item.studentCode}, ${dob}, ${cls})`;
      })
      .join("; ");
    super(`Tên học viên đã trùng trong cùng cơ sở: ${details}. Hãy đặt tên phân biệt, ví dụ: ${suggestions.join(", ")}.`);
    this.name = "DuplicateStudentNameError";
    this.matches = matches;
    this.suggestions = suggestions.length ? suggestions : [`${first?.fullName ?? "Học viên"}1`];
  }
}

export function normalizeStudentName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN");
}

export async function findDuplicateStudentNames(
  db: Db,
  params: { branchId: string; fullName: string; excludeStudentId?: string | null },
): Promise<DuplicateStudentNameMatch[]> {
  const normalized = normalizeStudentName(params.fullName);
  if (!normalized) return [];

  const candidates = await db.student.findMany({
    where: {
      branchId: params.branchId,
      ...(params.excludeStudentId ? { id: { not: params.excludeStudentId } } : {}),
    },
    select: {
      id: true,
      studentCode: true,
      fullName: true,
      dob: true,
      enrollments: {
        where: { status: { in: ["ACTIVE", "PAUSED", "PENDING"] } },
        orderBy: [{ enrollDate: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { class: { select: { className: true, classCode: true } }, packageLabel: true },
      },
    },
  });

  return candidates
    .filter((item) => normalizeStudentName(item.fullName) === normalized)
    .map((item) => {
      const currentEnrollment = item.enrollments[0] ?? null;
      return {
        id: item.id,
        studentCode: item.studentCode,
        fullName: item.fullName,
        dob: item.dob,
        currentClassName: currentEnrollment?.class?.className ?? currentEnrollment?.packageLabel ?? null,
        currentClassCode: currentEnrollment?.class?.classCode ?? null,
      };
    });
}

export async function suggestStudentNameVariants(
  db: Db,
  params: { branchId: string; fullName: string; take?: number },
) {
  const base = params.fullName.trim().replace(/\s+/g, " ");
  if (!base) return [];
  const existing = await db.student.findMany({
    where: { branchId: params.branchId },
    select: { fullName: true },
  });
  const used = new Set(existing.map((item) => normalizeStudentName(item.fullName)));
  const suggestions: string[] = [];
  for (let index = 1; suggestions.length < (params.take ?? 2) && index <= 50; index += 1) {
    const candidate = `${base}${index}`;
    if (!used.has(normalizeStudentName(candidate))) suggestions.push(candidate);
  }
  return suggestions;
}

export async function assertStudentNameNotDuplicated(
  db: Db,
  params: { branchId: string; fullName: string; excludeStudentId?: string | null },
) {
  const matches = await findDuplicateStudentNames(db, params);
  if (!matches.length) return;
  const suggestions = await suggestStudentNameVariants(db, {
    branchId: params.branchId,
    fullName: params.fullName,
    take: 2,
  });
  throw new DuplicateStudentNameError(matches, suggestions);
}
