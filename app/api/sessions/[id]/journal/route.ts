import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

// Nhật ký lớp học sau mỗi buổi — 1 journal / buổi, nhiều học viên, mỗi học viên nhiều
// điểm (nhãn tự do). Ghi đè toàn bộ entries+scores mỗi lần lưu vì giáo viên luôn sửa lại
// cả bảng cùng lúc (không có luồng "sửa từng ô một" thật sự cần theo dõi lịch sử).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const session = await prisma.classSession.findUnique({
    where: { id: params.id },
    include: {
      class: { include: { branch: true } },
      journal: { include: { entries: { include: { scores: true, student: true } } } },
    },
  });
  if (!session) return NextResponse.json({ error: "Không tìm thấy buổi học" }, { status: 404 });

  const roster = await prisma.enrollment.findMany({
    where: { classId: session.classId, status: "ACTIVE" },
    include: { student: true },
    orderBy: { student: { fullName: "asc" } },
  });

  return NextResponse.json({ session, journal: session.journal, roster: roster.map((e) => e.student) });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const session = await prisma.classSession.findUnique({ where: { id: params.id } });
  if (!session) return NextResponse.json({ error: "Không tìm thấy buổi học" }, { status: 404 });

  const body = await req.json();
  const unitLesson = String(body.unitLesson ?? "").trim() || null;
  const homeworkNote = String(body.homeworkNote ?? "").trim() || null;
  const entries: Array<{
    studentId: string;
    homeworkStatus?: string;
    comment?: string;
    notes?: string;
    scores?: Array<{ label: string; score: number | null; maxScore?: number }>;
  }> = Array.isArray(body.entries) ? body.entries : [];
  const publish = Boolean(body.publish);

  const journal = await prisma.$transaction(async (tx) => {
    const existing = await tx.classSessionJournal.findUnique({ where: { sessionId: session.id } });

    const j = existing
      ? await tx.classSessionJournal.update({
          where: { id: existing.id },
          data: { unitLesson, homeworkNote, publishedAt: publish ? new Date() : existing.publishedAt },
        })
      : await tx.classSessionJournal.create({
          data: {
            sessionId: session.id,
            unitLesson,
            homeworkNote,
            createdById: user.id,
            publishedAt: publish ? new Date() : null,
          },
        });

    // Xóa hết entries/scores cũ rồi tạo lại — đơn giản và đủ dùng vì giáo viên luôn
    // sửa nguyên bảng, không cần giữ id ổn định qua các lần lưu.
    await tx.journalEntry.deleteMany({ where: { journalId: j.id } });

    for (const e of entries) {
      if (!e.studentId) continue;
      const hasContent =
        (e.homeworkStatus && e.homeworkStatus.trim()) ||
        (e.comment && e.comment.trim()) ||
        (e.notes && e.notes.trim()) ||
        (e.scores ?? []).some((s) => s.score !== null && s.score !== undefined);
      if (!hasContent) continue;

      await tx.journalEntry.create({
        data: {
          journalId: j.id,
          studentId: e.studentId,
          homeworkStatus: e.homeworkStatus || null,
          comment: e.comment || null,
          notes: e.notes || null,
          scores: {
            create: (e.scores ?? [])
              .filter((s) => s.label && s.label.trim())
              .map((s) => ({ label: s.label.trim(), score: s.score ?? null, maxScore: s.maxScore ?? 10 })),
          },
        },
      });
    }

    return j;
  });

  const full = await prisma.classSessionJournal.findUnique({
    where: { id: journal.id },
    include: { entries: { include: { scores: true, student: true } } },
  });

  return NextResponse.json({ item: full });
}
