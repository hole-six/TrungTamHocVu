import type { Prisma } from "@prisma/client";

// Cấp "buổi dư" (SessionCredit) cho phần buổi CHƯA HỌC của 1 enrollment đã thu học
// phí TRỌN GÓI (Charge.billingModel="COURSE") — dùng chung cho 2 tình huống:
//   1. Nhân viên chủ động rút lớp giữa khóa (app/api/enrollments/[id]/route.ts).
//   2. Khóa tự hết hạn (expectedEndDate đã qua) mà enrollment vẫn ACTIVE, chưa ai rút
//      (lib/server/scheduling.ts runClassEndCreditSweep).
//
// Mỗi credit vốn cần trỏ tới 1 ClassSession thật (buổi bị "bỏ lỡ"). Nếu lớp còn buổi
// TƯƠNG LAI (PLANNED/CONFIRMED, chưa qua ngày) thì dùng làm nguồn — nhưng khi khóa đã
// kết thúc, theo định nghĩa không còn buổi tương lai nào để gắn. Trường hợp đó tạo
// credit "không gắn buổi" (sourceSessionId: null, xem prisma/schema.prisma) — vẫn biết
// thuộc khóa nào qua enrollmentId → enrollment.class. Nhờ vậy hàm này LUÔN cấp đủ
// đúng bằng `remaining`, không còn khái niệm "thiếu/short" như bản gốc trước đây.
export async function grantRemainingSessionCredits(
  tx: Prisma.TransactionClient,
  enrollment: { id: string; studentId: string; classId: string },
  remaining: number,
  reason: string,
  origin = "WITHDRAWAL_REMAINING",
): Promise<{ granted: number }> {
  if (remaining <= 0) return { granted: 0 };

  const futureSessions = await tx.classSession.findMany({
    where: {
      classId: enrollment.classId,
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      sessionDate: { gte: new Date() },
    },
    orderBy: { sessionDate: "asc" },
    take: remaining,
  });

  const existingCredits = await tx.sessionCredit.findMany({
    where: { studentId: enrollment.studentId, sourceSessionId: { in: futureSessions.map((s) => s.id) } },
    select: { sourceSessionId: true },
  });
  const alreadyCredited = new Set(existingCredits.map((c) => c.sourceSessionId));
  const sessionsToUse = futureSessions.filter((s) => !alreadyCredited.has(s.id));

  for (const session of sessionsToUse) {
    await tx.sessionCredit.create({
      data: {
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        sourceSessionId: session.id,
        status: "AVAILABLE",
        origin,
        notes: reason,
      },
    });
  }

  const standaloneCount = remaining - sessionsToUse.length;
  for (let i = 0; i < standaloneCount; i++) {
    await tx.sessionCredit.create({
      data: {
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        sourceSessionId: null,
        status: "AVAILABLE",
        origin,
        notes: reason,
      },
    });
  }

  return { granted: sessionsToUse.length + standaloneCount };
}
