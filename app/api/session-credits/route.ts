import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { resolveSourceLessonDetails } from "@/lib/server/session-credit-lessons";

// Danh sách SessionCredit AVAILABLE kèm chi tiết bài/buổi đã vắng — dùng cho tab
// "Có buổi bổ trợ" của RemedialSessionRoster (chọn học viên vào 1 buổi bổ trợ, cần
// thấy đúng nội dung đã bỏ lỡ để dạy đúng bài).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "AVAILABLE";
  const activeBranchId = await getCurrentBranchId();

  const credits = await prisma.sessionCredit.findMany({
    where: {
      status,
      student: activeBranchId ? { branchId: activeBranchId } : {},
    },
    include: {
      student: { select: { id: true, fullName: true, studentCode: true } },
      sourceSession: {
        include: { class: { select: { className: true } }, journal: { select: { unitLesson: true, teacherNote: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  const lessonDetailByCreditId = await resolveSourceLessonDetails(credits);

  const items = credits.map((credit) => ({
    id: credit.id,
    studentId: credit.studentId,
    student: credit.student,
    origin: credit.origin,
    paidAmount: credit.paidAmount,
    lesson: lessonDetailByCreditId.get(credit.id) ?? null,
  }));

  return NextResponse.json({ items });
}
