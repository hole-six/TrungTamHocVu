// Gắn lại TIỀN ĐÃ THU nhưng đang nằm chết vào các phiếu học phí còn thiếu.
//
// Vì sao có tiền nằm chết: trước bản sửa ngày 2026-09-10, tiền chỉ được phân bổ đúng
// một lần tại thời điểm bấm thu, và chỉ vào những phiếu học phí ĐANG tồn tại lúc đó.
// Phiếu học phí sinh sau (kỳ tháng sau) không bao giờ ngó lại khoản tiền còn dư — nên
// học viên vừa có tiền treo trên phiếu thu vừa bị hệ thống báo còn nợ, và nhân viên đi
// đòi lại đúng khoản phụ huynh đã đóng. Lỗi gốc đã sửa: generateChargesForPeriod và
// generateCourseCharge nay đều gọi settleChargesFromAdvancePayments sau khi sinh phiếu.
// Script này dọn phần dữ liệu đã lỡ lệch từ trước.
//
// Mặc định CHỈ XEM TRƯỚC, không ghi gì. Thêm --apply để thực sự sửa.
// Chạy: npx tsx scripts/repair_advance_payments.ts [--apply]
import { PrismaClient } from "@prisma/client";
import { settleChargesFromAdvancePayments } from "../lib/server/advance-payment";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";

async function main() {
  const students = await prisma.student.findMany({
    where: { payments: { some: { status: { notIn: ["VOIDED", "REFUNDED"] } } } },
    select: {
      id: true,
      fullName: true,
      studentCode: true,
      payments: {
        where: { status: { notIn: ["VOIDED", "REFUNDED"] } },
        select: { amount: true, allocations: { select: { amount: true } } },
      },
      charges: {
        select: {
          tuitionAmount: true,
          materialsAmount: true,
          allocations: {
            where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } },
            select: { amount: true },
          },
        },
      },
    },
  });

  const stranded = students
    .map((student) => {
      const advance = student.payments.reduce(
        (sum, payment) => sum + payment.amount - payment.allocations.reduce((s, a) => s + a.amount, 0),
        0,
      );
      const unpaid = student.charges.reduce((sum, charge) => {
        const due = charge.tuitionAmount + charge.materialsAmount - charge.allocations.reduce((s, a) => s + a.amount, 0);
        return sum + Math.max(0, due);
      }, 0);
      return { id: student.id, name: student.fullName, code: student.studentCode, advance, unpaid };
    })
    .filter((item) => item.advance > 0 && item.unpaid > 0);

  if (stranded.length === 0) {
    console.log(`Không có học viên nào bị treo tiền đã thu (đã kiểm ${students.length}).`);
    await prisma.$disconnect();
    return;
  }

  console.log(`${stranded.length} học viên đang vừa có tiền dư vừa còn nợ:`);
  for (const item of stranded) {
    const willUse = Math.min(item.advance, item.unpaid);
    console.log(
      `  ${item.name.padEnd(24)} ${item.code.padEnd(12)} dư ${vnd(item.advance).padStart(14)} · nợ ${vnd(item.unpaid).padStart(14)} → sẽ gắn ${vnd(willUse)}`,
    );
  }

  if (!APPLY) {
    console.log("\nĐây mới là XEM TRƯỚC — chưa ghi gì. Chạy lại kèm --apply để sửa thật.");
    await prisma.$disconnect();
    return;
  }

  let totalAllocated = 0;
  for (const item of stranded) {
    const result = await prisma.$transaction((tx) => settleChargesFromAdvancePayments(tx, item.id));
    totalAllocated += result.allocated;
    console.log(`  ${item.name}: đã gắn ${vnd(result.allocated)} vào ${result.chargeIds.length} phiếu học phí.`);
  }
  console.log(`\nĐã gắn tổng cộng ${vnd(totalAllocated)} cho ${stranded.length} học viên.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
