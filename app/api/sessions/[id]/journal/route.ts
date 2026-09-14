import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

// Ghi nhật ký vẫn cho phép GV/TG (canUpdate("schedule")=false với 2 vai trò này) vì đây
// là việc dạy học hàng ngày — cùng lý do/pattern với app/api/sessions/[id]/attendance/route.ts.
async function canWriteJournal(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return canUpdate("schedule", role) || role === "TEACHER" || role === "TEACHING_ASSISTANT";
}

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
  if (!(await canWriteJournal(user.id))) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền ghi nhật ký lớp học" }, { status: 403 });
  }

  const session = await prisma.classSession.findUnique({ where: { id: params.id } });
  if (!session) return NextResponse.json({ error: "Không tìm thấy buổi học" }, { status: 404 });

  const body = await req.json();
  const unitLesson = String(body.unitLesson ?? "").trim() || null;
  const teacherNote = String(body.teacherNote ?? "").trim() || null;
  const homeworkNote = String(body.homeworkNote ?? "").trim() || null;
  const entries: Array<{
    studentId: string;
    homeworkStatus?: string;
    comment?: string;
    notes?: string;
    scores?: Array<{ label: string; score: number | null; maxScore?: number }>;
  }> = Array.isArray(body.entries) ? body.entries : [];
  const publish = Boolean(body.publish);

  // CHẶN ĐIỂM VƯỢT THANG ĐIỂM. Ô nhập có max=10 nhưng thuộc tính đó của trình duyệt không
  // chặn được việc gõ tay, còn API trước đây lưu nguyên mọi con số — dữ liệu thật đã có
  // "Minitest từ = 123/10", "Nghe = 123123/10", đẩy điểm trung bình học viên lên hàng chục
  // nghìn. Điểm nhật ký là căn cứ báo tiến bộ cho phụ huynh nên phải đúng từ lúc nhập.
  const nameById = new Map(
    (
      await prisma.student.findMany({
        where: { id: { in: entries.map((e) => e.studentId).filter(Boolean) } },
        select: { id: true, fullName: true },
      })
    ).map((item) => [item.id, item.fullName]),
  );
  for (const e of entries) {
    for (const s of e.scores ?? []) {
      if (s.score === null || s.score === undefined || (typeof s.score === "string" && s.score === "")) continue;
      const score = Number(s.score);
      const maxScore = s.maxScore === undefined || s.maxScore === null ? 10 : Number(s.maxScore);
      const who = nameById.get(e.studentId) ?? "học viên";
      if (!Number.isFinite(maxScore) || maxScore <= 0) {
        return NextResponse.json({ error: `Thang điểm cột "${s.label}" của ${who} không hợp lệ.` }, { status: 400 });
      }
      if (!Number.isFinite(score) || score < 0 || score > maxScore) {
        return NextResponse.json(
          { error: `Điểm "${s.label}" của ${who} là ${s.score} — phải nằm trong khoảng 0 đến ${maxScore}.` },
          { status: 400 },
        );
      }
    }
  }

  const journal = await prisma.$transaction(async (tx) => {
    const existing = await tx.classSessionJournal.findUnique({ where: { sessionId: session.id } });

    const j = existing
      ? await tx.classSessionJournal.update({
          where: { id: existing.id },
          data: { unitLesson, teacherNote, homeworkNote, publishedAt: publish ? new Date() : existing.publishedAt },
        })
      : await tx.classSessionJournal.create({
          data: {
            sessionId: session.id,
            unitLesson,
            teacherNote,
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
