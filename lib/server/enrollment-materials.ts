import type { Prisma } from "@prisma/client";

// Gắn bộ giáo trình học viên phải mua khi vào một lớp.
//
// Có HAI nguồn sách, gộp lại thành một danh sách:
//   1. Bộ sách chuẩn của KHÓA (CourseBookRequirement) — khai báo một lần cho cả khóa.
//   2. Sách kèm theo của LỚP (ClassBookRequirement) — khai báo lúc mở lớp, vì lớp mới là
//      nơi biết chính xác năm nay phát cuốn nào. Không bắt buộc; lớp nào không gắn thì
//      học viên chỉ nhận bộ sách của khóa (hoặc không có cuốn nào).
// Trùng cuốn thì lấy theo khai báo của LỚP (cụ thể hơn khóa).
//
// Trước đây logic này chỉ nằm trong app/api/classes/[id]/enrollments (ghi danh tay), nên
// học viên vào lớp bằng 3 đường còn lại — chuyển lớp, kết thúc lớp chuyển hàng loạt, và
// từ CRM ghi danh thẳng — đều KHÔNG được gắn tài liệu của lớp mới. Kết quả: danh sách
// giáo trình cần phát của lớp thiếu người, và tiền sách của những người đó không bao giờ
// vào hóa đơn. Gom về một chỗ để cả 4 đường đi qua đúng một quy tắc.
export async function attachCourseBookRequirements(
  tx: Prisma.TransactionClient,
  params: { studentId: string; classId: string; enrollmentId: string },
): Promise<number> {
  const cls = await tx.class.findUnique({
    where: { id: params.classId },
    select: {
      id: true,
      className: true,
      isRemedial: true,
      classBooks: {
        select: { bookId: true, quantity: true, book: { select: { unitPrice: true, name: true } } },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      course: {
        select: {
          name: true,
          bookRequirements: {
            select: { id: true, bookId: true, quantity: true, book: { select: { unitPrice: true, name: true } } },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });
  // Lớp bổ trợ không có bộ sách riêng — học viên học bù bằng giáo trình của lớp chính.
  if (!cls || cls.isRemedial) return 0;

  type Wanted = { bookId: string; quantity: number; unitPrice: number; courseBookRequirementId: string | null; note: string };
  const wanted = new Map<string, Wanted>();
  for (const item of cls.course?.bookRequirements ?? []) {
    wanted.set(item.bookId, {
      bookId: item.bookId,
      quantity: item.quantity,
      unitPrice: item.book.unitPrice,
      courseBookRequirementId: item.id,
      note: `Bộ sách chuẩn của khóa ${cls.course?.name ?? cls.className}`,
    });
  }
  for (const item of cls.classBooks) {
    wanted.set(item.bookId, {
      bookId: item.bookId,
      quantity: item.quantity,
      unitPrice: item.book.unitPrice,
      courseBookRequirementId: null,
      note: `Sách kèm theo của lớp ${cls.className}`,
    });
  }
  if (wanted.size === 0) return 0;

  // Không tạo trùng: học viên có thể quay lại đúng lớp đó (rút rồi ghi danh lại), hoặc
  // nhân viên đã phát sách thủ công trước khi ghi danh.
  const existing = await tx.studentBookRequirement.findMany({
    where: { studentId: params.studentId, classId: cls.id },
    select: { bookId: true },
  });
  const existingBookIds = new Set(existing.map((item) => item.bookId));

  const toCreate = [...wanted.values()].filter((item) => !existingBookIds.has(item.bookId));
  if (toCreate.length === 0) return 0;

  await tx.studentBookRequirement.createMany({
    data: toCreate.map((item) => ({
      studentId: params.studentId,
      classId: cls.id,
      enrollmentId: params.enrollmentId,
      bookId: item.bookId,
      courseBookRequirementId: item.courseBookRequirementId,
      quantity: item.quantity,
      unitPriceSnapshot: item.unitPrice,
      totalAmount: item.quantity * item.unitPrice,
      status: "PENDING",
      notes: item.note,
    })),
  });
  return toCreate.length;
}
