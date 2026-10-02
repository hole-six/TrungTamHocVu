// HỌC VIÊN CẦN CHĂM SÓC — kết luận từ NHẬT KÝ HỌC TẬP, không ai tick tay.
//
// Người gọi phụ huynh cần biết "em này đang sao", chứ không phải chỉ một con số. Vì vậy
// mỗi dấu hiệu trả về một LÝ DO gọn để hiện thẳng trên cột, bấm vào mới xem chi tiết.
//
// Dùng chung cho cột "Cần chăm sóc" ở /students và danh sách theo từng cơ sở trên bảng
// điều hành — một hàm duy nhất để hai nơi không bao giờ ra hai con số khác nhau.

/** Một buổi trong nhật ký của học viên, mới nhất đứng TRƯỚC. */
export type CareSession = {
  sessionId: string;
  sessionDate: Date;
  /** Trung bình các đầu điểm có nhập của buổi đó; null = buổi không chấm điểm. */
  score: number | null;
  /** "Đủ" | "Chưa nộp" | "Không có BTVN" | null */
  homeworkStatus: string | null;
  /** PRESENT | ABSENT | null (chưa điểm danh) */
  attendance: string | null;
};

export type CareReason = { code: string; label: string };

export type CareVerdict = {
  needsCare: boolean;
  reasons: CareReason[];
  /** Trung bình của tối đa 3 buổi gần nhất CÓ chấm điểm; null = chưa có điểm nào. */
  recentAverage: number | null;
  scoredSessions: number;
};

/** Ngưỡng để sau này chỉnh theo thực tế mà không phải sửa logic. */
export const CARE_THRESHOLDS = {
  /** Trung bình 3 buổi gần nhất dưới mức này là cần chăm sóc. */
  lowAverage: 7,
  /** Số buổi gần nhất dùng để tính trung bình. */
  recentScoreWindow: 3,
  /** Số buổi gần nhất xét bài tập, và số lần chưa nộp đủ để cảnh báo. */
  homeworkWindow: 3,
  homeworkMisses: 2,
  /** Số buổi gần nhất xét điểm danh, và số lần vắng đủ để cảnh báo. */
  absenceWindow: 4,
  absences: 2,
};

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Kết luận từ danh sách buổi gần nhất của một học viên (mới nhất đứng trước).
 *
 * Hàm thuần, không đụng CSDL — để test được mọi ca mà không cần dựng dữ liệu thật.
 */
export function evaluateStudentCare(sessions: CareSession[]): CareVerdict {
  const reasons: CareReason[] = [];

  const scored = sessions.filter((item) => item.score != null);
  const recentScores = scored.slice(0, CARE_THRESHOLDS.recentScoreWindow).map((item) => item.score as number);
  const recentAverage = recentScores.length > 0 ? round1(recentScores.reduce((a, b) => a + b, 0) / recentScores.length) : null;

  // 1. Điểm trung bình tụt — chỉ kết luận khi đã đủ số buổi, tránh một buổi điểm thấp
  //    đã bị gắn mác "cần chăm sóc".
  if (recentAverage != null && recentScores.length >= CARE_THRESHOLDS.recentScoreWindow && recentAverage < CARE_THRESHOLDS.lowAverage) {
    reasons.push({ code: "LOW_AVERAGE", label: `TB ${CARE_THRESHOLDS.recentScoreWindow} buổi: ${recentAverage.toFixed(1)}` });
  }

  // 2. Điểm đang đi xuống liên tiếp (buổi sau thấp hơn buổi trước).
  if (recentScores.length >= 3) {
    const [newest, middle, oldest] = recentScores;
    if (newest < middle && middle < oldest) {
      reasons.push({ code: "FALLING", label: `Điểm giảm 3 buổi: ${oldest} → ${middle} → ${newest}` });
    }
  }

  // 3. Không làm bài tập.
  const homeworkWindow = sessions.slice(0, CARE_THRESHOLDS.homeworkWindow);
  const misses = homeworkWindow.filter((item) => item.homeworkStatus === "Chưa nộp").length;
  if (misses >= CARE_THRESHOLDS.homeworkMisses) {
    reasons.push({ code: "HOMEWORK", label: `${misses} buổi chưa nộp bài` });
  }

  // 4. Vắng nhiều.
  const absenceWindow = sessions.slice(0, CARE_THRESHOLDS.absenceWindow);
  const absences = absenceWindow.filter((item) => item.attendance === "ABSENT").length;
  if (absences >= CARE_THRESHOLDS.absences) {
    reasons.push({ code: "ABSENCE", label: `Vắng ${absences}/${absenceWindow.length} buổi gần nhất` });
  }

  return { needsCare: reasons.length > 0, reasons, recentAverage, scoredSessions: scored.length };
}

/** Gộp các lý do thành một dòng ngắn để hiện thẳng trên cột. */
export function describeCare(verdict: CareVerdict): string {
  return verdict.reasons.map((item) => item.label).join(" · ");
}

// ---------------------------------------------------------------------------------
// ĐỌC NHẬT KÝ THẬT RỒI KẾT LUẬN
import { prisma } from "@/lib/prisma";

/** Số buổi gần nhất cần lấy để xét đủ mọi dấu hiệu. */
const LOOKBACK = Math.max(CARE_THRESHOLDS.recentScoreWindow, CARE_THRESHOLDS.homeworkWindow, CARE_THRESHOLDS.absenceWindow) + 2;

/**
 * Kết luận "cần chăm sóc" cho một loạt học viên.
 *
 * Lấy một lượt điểm danh + nhật ký của tất cả học viên rồi tính trong bộ nhớ — hỏi từng
 * em một sẽ thành hàng trăm truy vấn cho một trang danh sách.
 */
export async function buildStudentCareMap(studentIds: string[]): Promise<Map<string, CareVerdict>> {
  const result = new Map<string, CareVerdict>();
  if (studentIds.length === 0) return result;

  const [attendances, entries] = await Promise.all([
    prisma.studentAttendance.findMany({
      where: { studentId: { in: studentIds }, session: { status: { notIn: ["CANCELLED", "RESCHEDULED"] } } },
      select: { studentId: true, status: true, sessionId: true, session: { select: { sessionDate: true } } },
      orderBy: { session: { sessionDate: "desc" } },
    }),
    prisma.journalEntry.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        studentId: true,
        homeworkStatus: true,
        scores: { select: { score: true } },
        journal: { select: { sessionId: true, session: { select: { sessionDate: true } } } },
      },
    }),
  ]);

  // Gộp theo (học viên, buổi): một buổi có cả điểm danh lẫn nhật ký.
  type Bucket = Map<string, CareSession>;
  const byStudent = new Map<string, Bucket>();
  const bucketOf = (studentId: string) => {
    const found = byStudent.get(studentId) ?? new Map<string, CareSession>();
    byStudent.set(studentId, found);
    return found;
  };
  const ensure = (studentId: string, sessionId: string, sessionDate: Date): CareSession => {
    const bucket = bucketOf(studentId);
    const found = bucket.get(sessionId) ?? { sessionId, sessionDate, score: null, homeworkStatus: null, attendance: null };
    bucket.set(sessionId, found);
    return found;
  };

  for (const item of attendances) {
    ensure(item.studentId, item.sessionId, item.session.sessionDate).attendance = item.status;
  }
  for (const item of entries) {
    const sessionId = item.journal.sessionId;
    const row = ensure(item.studentId, sessionId, item.journal.session.sessionDate);
    row.homeworkStatus = item.homeworkStatus;
    // Điểm của buổi = trung bình các đầu điểm CÓ nhập; buổi không chấm thì để null.
    const scores = item.scores.map((score) => score.score).filter((value): value is number => value != null);
    row.score = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  }

  for (const studentId of studentIds) {
    const sessions = [...(byStudent.get(studentId)?.values() ?? [])]
      .sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime())
      .slice(0, LOOKBACK);
    result.set(studentId, evaluateStudentCare(sessions));
  }
  return result;
}
