// CẢNH BÁO CHUYÊN MÔN CỦA MỘT KHOẢNG THỜI GIAN.
//
// Buổi được đánh dấu vàng/đỏ trong tiến trình là buổi ÉP giáo viên phải làm một việc cụ
// thể. Chỉ bôi màu trên thời khoá biểu là chưa đủ: người xếp lịch có thể không mở lịch
// hôm đó. Hàm này gom các buổi vàng/đỏ theo cơ sở để bảng điều hành kêu cho tới khi
// được xác nhận đã làm.
//
// "Đã làm" = có SessionRequirementCheck với status SUBMITTED (dùng lại đúng cơ chế xác
// nhận sẵn có, nên vẫn truy được ai tick, lúc nào, muộn mấy ngày).
import { prisma } from "@/lib/prisma";
import { resolveClassRoadmap } from "@/lib/server/class-roadmap";
import { computeSessionNumbers } from "@/lib/session-numbering";

export type ProfessionalAlert = {
  sessionId: string;
  classId: string;
  className: string;
  branchId: string;
  branchName: string;
  sessionDate: Date;
  sessionNumber: number;
  level: "YELLOW" | "RED";
  note: string | null;
  done: boolean;
  /** Buổi đỏ đã qua ngày mà chưa ai xác nhận — đẩy lên đầu danh sách. */
  overdue: boolean;
};

export async function listProfessionalAlerts(params: {
  branchId: string | null;
  start: Date;
  end: Date;
  today?: Date;
}): Promise<ProfessionalAlert[]> {
  const { branchId, start, end } = params;
  const today = params.today ?? new Date();

  const sessions = await prisma.classSession.findMany({
    where: {
      sessionDate: { gte: start, lte: end },
      status: { notIn: ["CANCELLED", "RESCHEDULED"] },
      class: { ...(branchId ? { branchId } : {}) },
    },
    select: {
      id: true,
      classId: true,
      sessionDate: true,
      class: { select: { className: true, branchId: true, branch: { select: { name: true } } } },
      requirementCheck: { select: { status: true } },
    },
    orderBy: { sessionDate: "asc" },
  });
  if (sessions.length === 0) return [];

  const classIds = [...new Set(sessions.map((item) => item.classId))];
  // Số buổi trong lộ trình phải tính trên TOÀN BỘ buổi của lớp (buổi bù ăn theo vị trí
  // buổi gốc), không suy được từ riêng khoảng đang xem.
  const allSessions = await prisma.classSession.findMany({
    where: { classId: { in: classIds } },
    select: { id: true, classId: true, sessionDate: true, startTime: true, status: true, replacesSessionId: true },
  });
  const byClass = new Map<string, typeof allSessions>();
  for (const item of allSessions) byClass.set(item.classId, [...(byClass.get(item.classId) ?? []), item]);

  const alerts: ProfessionalAlert[] = [];
  for (const classId of classIds) {
    const roadmap = await resolveClassRoadmap(prisma, classId);
    const flagged = new Map(roadmap.filter((item) => item.alertLevel !== "NONE").map((item) => [item.sessionNumber, item]));
    if (flagged.size === 0) continue;

    const numbering = computeSessionNumbers(byClass.get(classId) ?? []);
    for (const session of sessions.filter((item) => item.classId === classId)) {
      const number = numbering.numberById.get(session.id);
      const found = number != null ? flagged.get(number) : null;
      if (!found) continue;
      const done = session.requirementCheck?.status === "SUBMITTED";
      alerts.push({
        sessionId: session.id,
        classId,
        className: session.class.className,
        branchId: session.class.branchId,
        branchName: session.class.branch?.name ?? "—",
        sessionDate: session.sessionDate,
        sessionNumber: found.sessionNumber,
        level: found.alertLevel as "YELLOW" | "RED",
        note: found.teacherRequirement,
        done,
        overdue: !done && found.alertLevel === "RED" && session.sessionDate < today,
      });
    }
  }

  // Quá hạn lên đầu, rồi tới đỏ, rồi theo ngày — việc gấp nhất nằm trên cùng.
  return alerts.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.level !== b.level) return a.level === "RED" ? -1 : 1;
    return a.sessionDate.getTime() - b.sessionDate.getTime();
  });
}
