// Chữa lại usedSessionCount bị lệch so với bản ghi điểm danh thật.
//
// Vì sao có lệch: trước bản sửa ngày 2026-09-10, hủy một buổi ĐÃ điểm danh sẽ xóa bản
// ghi điểm danh nhưng KHÔNG trừ lại usedSessionCount — nên tiến độ học của những học
// viên đó bị đội lên vĩnh viễn, mỗi lần hủy buổi lại lệch thêm 1. Lỗi gốc đã sửa ở
// app/api/sessions/[id]/route.ts; script này dọn phần dữ liệu đã lỡ lệch.
//
// Quy tắc tính lại (giống bất biến số 7 trong check_money_integrity.ts):
//   - Ghi danh thường          : usedSessionCount = số buổi có mặt/học bù của chính nó
//   - Ghi danh do chuyển lớp   : = phần mang theo từ lớp trước + số buổi của chính nó
//     (tiến độ đi xuyên suốt các lớp nối tiếp — xem app/api/enrollments/[id]/transfer)
//
// Mặc định CHỈ XEM TRƯỚC, không ghi gì. Thêm --apply để thực sự sửa.
// Chạy: npx tsx scripts/repair_used_session_count.ts [--apply]
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function ownAttendance(enrollmentId: string) {
  return prisma.studentAttendance.count({
    where: { enrollmentId, status: { in: ["PRESENT", "MAKEUP"] } },
  });
}

async function main() {
  const enrollments = await prisma.enrollment.findMany({
    include: { student: true, class: { select: { classCode: true } } },
    orderBy: { enrollDate: "asc" },
  });

  // Tính đúng theo chuỗi chuyển lớp: phải xử lý ghi danh gốc trước rồi mới tới ghi danh
  // nối tiếp, nên dùng đệ quy có nhớ thay vì duyệt phẳng một lượt.
  const correctCache = new Map<string, number>();
  const byId = new Map(enrollments.map((item) => [item.id, item]));

  async function correctValue(enrollmentId: string): Promise<number> {
    const cached = correctCache.get(enrollmentId);
    if (cached !== undefined) return cached;
    const enrollment = byId.get(enrollmentId);
    if (!enrollment) return 0;
    const own = await ownAttendance(enrollmentId);
    const carried = enrollment.transferredFromEnrollmentId
      ? await correctValue(enrollment.transferredFromEnrollmentId)
      : 0;
    const value = own + carried;
    correctCache.set(enrollmentId, value);
    return value;
  }

  const drifted: { id: string; name: string; classCode: string; from: number; to: number }[] = [];
  for (const enrollment of enrollments) {
    const expected = await correctValue(enrollment.id);
    if (expected !== enrollment.usedSessionCount) {
      drifted.push({
        id: enrollment.id,
        name: enrollment.student.fullName,
        classCode: enrollment.class?.classCode ?? "không lớp",
        from: enrollment.usedSessionCount,
        to: expected,
      });
    }
  }

  if (drifted.length === 0) {
    console.log(`Không có ghi danh nào bị lệch (đã kiểm ${enrollments.length}).`);
    await prisma.$disconnect();
    return;
  }

  console.log(`${drifted.length} ghi danh bị lệch tiến độ:`);
  for (const item of drifted) {
    console.log(`  ${item.name.padEnd(22)} ${item.classCode.padEnd(14)} ${item.from} -> ${item.to}`);
  }

  if (!APPLY) {
    console.log("\nĐây mới là XEM TRƯỚC — chưa ghi gì. Chạy lại kèm --apply để sửa thật.");
    await prisma.$disconnect();
    return;
  }

  for (const item of drifted) {
    await prisma.enrollment.update({ where: { id: item.id }, data: { usedSessionCount: item.to } });
  }
  console.log(`\nĐã sửa ${drifted.length} ghi danh.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
