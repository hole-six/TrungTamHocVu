import type { Prisma } from "@prisma/client";

// Gắn bộ giáo trình chuẩn của khóa cho học viên khi vào một lớp.
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
      course: {
        select: {
          name: true,
          bookRequirements: {
            select: { id: true, bookId: true, quantity: true, book: { select: { unitPrice: true } } },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });
  // Lớp bổ trợ không có bộ sách riêng — học viên học bù bằng giáo trình của lớp chính.
  if (!cls || cls.isRemedial || !cls.course?.bookRequirements.length) return 0;

  // Không tạo trùng: học viên có thể quay lại đúng lớp đó (rút rồi ghi danh lại), hoặc
  // nhân viên đã phát sách thủ công trước khi ghi danh.
  const existing = await tx.studentBookRequirement.findMany({
    where: { studentId: params.studentId, classId: cls.id },
    select: { bookId: true },
  });
  const existingBookIds = new Set(existing.map((item) => item.bookId));

  const toCreate = cls.course.bookRequirements.filter((item) => !existingBookIds.has(item.bookId));
  if (toCreate.length === 0) return 0;

  await tx.studentBookRequirement.createMany({
    data: toCreate.map((item) => ({
      studentId: params.studentId,
      classId: cls.id,
      enrollmentId: params.enrollmentId,
      bookId: item.bookId,
      courseBookRequirementId: item.id,
      quantity: item.quantity,
      unitPriceSnapshot: item.book.unitPrice,
      totalAmount: item.quantity * item.book.unitPrice,
      status: "PENDING",
      notes: `Bộ sách chuẩn của khóa ${cls.course?.name ?? cls.className}`,
    })),
  });
  return toCreate.length;
}
