// Dựng chuỗi Lớp A → Lớp B → Lớp C → Lớp D cho 1 học viên từ toàn bộ enrollment của
// người đó — Enrollment.transferredFromEnrollmentId chỉ là con trỏ NGƯỢC 1 bước (mỗi
// enrollment biết nó chuyển TỪ đâu), không có field lưu sẵn cả chuỗi và Prisma không hỗ
// trợ include đệ quy tuỳ ý độ sâu — nên dựng trong bộ nhớ từ danh sách đã fetch sẵn
// (số enrollment/học sinh luôn nhỏ, không cần raw SQL CTE).

export type EnrollmentChainInput = {
  id: string;
  classId: string;
  className: string;
  transferredFromEnrollmentId: string | null;
  status: string;
  enrollDate: Date | string;
};

export type EnrollmentChainNode = EnrollmentChainInput & { isCurrent: boolean };

export function buildEnrollmentPipeline(
  enrollments: EnrollmentChainInput[],
  currentEnrollmentId: string,
): EnrollmentChainNode[] {
  const byId = new Map(enrollments.map((e) => [e.id, e]));
  const current = byId.get(currentEnrollmentId);
  if (!current) return [];

  const childrenOf = new Map<string, EnrollmentChainInput[]>();
  for (const e of enrollments) {
    if (!e.transferredFromEnrollmentId) continue;
    const list = childrenOf.get(e.transferredFromEnrollmentId) ?? [];
    list.push(e);
    childrenOf.set(e.transferredFromEnrollmentId, list);
  }

  // Đi NGƯỢC tới gốc — con trỏ ngược là 1-1 (mỗi enrollment chỉ có đúng 1
  // transferredFromEnrollmentId) nên chiều này không mơ hồ.
  const backward: EnrollmentChainInput[] = [];
  const visitedBackward = new Set<string>([current.id]);
  let cursor: EnrollmentChainInput | undefined = current;
  while (cursor?.transferredFromEnrollmentId && !visitedBackward.has(cursor.transferredFromEnrollmentId)) {
    const parent = byId.get(cursor.transferredFromEnrollmentId);
    if (!parent) break;
    visitedBackward.add(parent.id);
    backward.push(parent);
    cursor = parent;
  }
  backward.reverse();

  // Đi XUÔI từ current — nếu 1 enrollment có nhiều transferredTo (hiếm, vd tách lớp),
  // chỉ lấy đúng 1 nhánh (enrollDate sớm nhất) để hiển thị, không rẽ nhánh.
  const forward: EnrollmentChainInput[] = [];
  const visitedForward = new Set<string>([current.id]);
  let forwardCursor: EnrollmentChainInput | undefined = current;
  while (forwardCursor) {
    const children: EnrollmentChainInput[] = (childrenOf.get(forwardCursor.id) ?? [])
      .filter((c) => !visitedForward.has(c.id))
      .sort((a, b) => new Date(a.enrollDate).getTime() - new Date(b.enrollDate).getTime());
    const next: EnrollmentChainInput | undefined = children[0];
    if (!next) break;
    visitedForward.add(next.id);
    forward.push(next);
    forwardCursor = next;
  }

  return [...backward, current, ...forward].map((e) => ({ ...e, isCurrent: e.id === currentEnrollmentId }));
}
