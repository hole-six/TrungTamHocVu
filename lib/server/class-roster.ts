import type { Prisma } from "@prisma/client";

// AI thuộc về MỘT BUỔI HỌC CỤ THỂ — nguồn sự thật duy nhất cho: danh sách điểm danh,
// trừ ví buổi học, và cấp buổi bổ trợ khi vắng.
//
// Trước đây cả 3 nơi đều tự hỏi "mọi ghi danh đang ACTIVE của lớp này", KHÔNG xét ngày
// vào lớp và ngày rời lớp. Hậu quả có thật:
//   - Học viên vừa chuyển vào hôm nay vẫn hiện trong danh sách điểm danh của buổi từ
//     3 tháng trước; điểm danh nhầm là cộng tiến độ và TRỪ VÍ cho buổi họ chưa từng học.
//   - Học viên đã rút/đã chuyển đi thì biến mất khỏi danh sách của chính những buổi họ
//     đã học thật, nên lịch sử buổi đó nhìn vào bị thiếu người.
//   - Hoàn thành lại một buổi cũ (sửa điểm danh, chạy lại) trừ ví đúng những người
//     không liên quan.
//
// Quy tắc: một ghi danh được tính cho buổi ngày D khi
//   (1) đã vào lớp không muộn hơn D  → enrollDate <= D
//   (2) chưa rời lớp tính đến D      → endDate = null hoặc endDate >= D
//   (3) không phải PENDING (chưa thực sự vào học).
//
// MỖI HỌC VIÊN CHỈ ĐƯỢC TÍNH 1 LẦN cho 1 buổi. Ngày chuyển lớp, ghi danh cũ (endDate =
// hôm nay) và ghi danh mới (enrollDate = hôm nay) cùng thỏa điều kiện trên — nếu không
// khử trùng thì học viên hiện 2 dòng trong danh sách điểm danh và bị TRỪ VÍ 2 lần
// (trong đó ví cũ vừa bị chuyển sạch về 0 nên sẽ âm). Ưu tiên giữ ghi danh đang ACTIVE,
// sau đó tới ghi danh có ngày vào lớp mới nhất.
export type RosterEnrollment = {
  id: string;
  studentId: string;
  status: string;
  enrollDate: Date;
  endDate: Date | null;
  billingModel: string;
};

export function dedupeRosterByStudent<T extends RosterEnrollment>(enrollments: T[]): T[] {
  const bestByStudent = new Map<string, T>();
  for (const item of enrollments) {
    const current = bestByStudent.get(item.studentId);
    if (!current) {
      bestByStudent.set(item.studentId, item);
      continue;
    }
    const currentIsActive = current.status === "ACTIVE";
    const itemIsActive = item.status === "ACTIVE";
    if (itemIsActive && !currentIsActive) {
      bestByStudent.set(item.studentId, item);
      continue;
    }
    if (itemIsActive === currentIsActive && item.enrollDate > current.enrollDate) {
      bestByStudent.set(item.studentId, item);
    }
  }
  return [...bestByStudent.values()];
}

export function enrolledOnDateFilter(sessionDate: Date): Prisma.EnrollmentWhereInput {
  return {
    status: { not: "PENDING" },
    enrollDate: { lte: sessionDate },
    OR: [{ endDate: null }, { endDate: { gte: sessionDate } }],
  };
}

/** Danh sách ghi danh thực sự thuộc về buổi học này, đã khử trùng theo học viên. */
export async function getEnrollmentsForSession(
  tx: Prisma.TransactionClient,
  params: { classId: string; sessionDate: Date; billingModel?: string },
): Promise<RosterEnrollment[]> {
  const rows = await tx.enrollment.findMany({
    where: {
      classId: params.classId,
      ...(params.billingModel ? { billingModel: params.billingModel } : {}),
      ...enrolledOnDateFilter(params.sessionDate),
    },
    select: { id: true, studentId: true, status: true, enrollDate: true, endDate: true, billingModel: true },
    orderBy: { enrollDate: "asc" },
  });
  return dedupeRosterByStudent(rows);
}
