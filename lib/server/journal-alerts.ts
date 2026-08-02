import { prisma } from "@/lib/prisma";

// "Cần chăm sóc": học sinh có ít nhất 1 điểm thành phần <7 ở CẢ 3 buổi gần nhất
// liên tiếp (không tính buổi hiện tại đang mở/nhập điểm) trong cùng lớp — để giáo
// viên thấy ngay khi mở nhật ký buổi tiếp theo, không phải tự lật lại từng buổi cũ.
// Tô màu điểm (xem ClassJournalForm) tính theo TỪNG điểm thành phần riêng lẻ, nên ở
// đây cũng xét "buổi có điểm đỏ" là buổi có bất kỳ điểm thành phần nào <7.
export async function computeCareAlerts(
  classId: string,
  studentIds: string[],
  beforeSessionDate: Date,
  excludeSessionId: string
): Promise<Set<string>> {
  if (studentIds.length === 0) return new Set();

  const recentSessions = await prisma.classSession.findMany({
    where: {
      classId,
      id: { not: excludeSessionId },
      sessionDate: { lte: beforeSessionDate },
      status: { not: "CANCELLED" },
      journal: { isNot: null },
    },
    orderBy: { sessionDate: "desc" },
    take: 3,
    select: {
      journal: {
        select: {
          entries: {
            where: { studentId: { in: studentIds } },
            select: { studentId: true, scores: { select: { score: true } } },
          },
        },
      },
    },
  });

  // Chưa đủ 3 buổi có nhật ký trước đó thì chưa đủ dữ liệu để cảnh báo.
  if (recentSessions.length < 3) return new Set();

  const alerts = new Set<string>();
  for (const studentId of studentIds) {
    const redInAllThree = recentSessions.every((session) =>
      session.journal?.entries.some(
        (entry) => entry.studentId === studentId && entry.scores.some((s) => s.score !== null && s.score < 7)
      )
    );
    if (redInAllThree) alerts.add(studentId);
  }
  return alerts;
}
