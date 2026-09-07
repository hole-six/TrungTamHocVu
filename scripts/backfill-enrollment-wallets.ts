/**
 * Backfill Ví buổi học cho mọi enrollment PERIOD đang tồn tại — BẮT BUỘC chạy đúng 1
 * lần trước khi công thức sinh học phí mới (dựa trên Ví) đi vào hoạt động thật, nếu
 * không lần sinh hóa đơn tới sẽ tính như học sinh chưa đóng đồng nào.
 *
 * Công thức xấp xỉ (chấp nhận sai số nhỏ — xem kế hoạch mục 6 "Rủi ro"):
 *   tổng buổi đã "tính vào hóa đơn" (SUM charge.sessionCount, PERIOD, enrollment này)
 *   tổng buổi đã trả tiền (SUM tiền đã phân bổ cho charge đó / đơn giá của CHÍNH charge đó)
 *   Ví ban đầu = MAX(0, tổng đã trả tiền − tổng đã tính vào hóa đơn)
 *
 * Chạy: npx tsx scripts/backfill-enrollment-wallets.ts            (xem trước, không ghi)
 *       npx tsx scripts/backfill-enrollment-wallets.ts --apply    (ghi thật)
 */
import { prisma } from "../lib/prisma";

async function main() {
  const apply = process.argv.includes("--apply");

  const enrollments = await prisma.enrollment.findMany({
    where: { billingModel: "PERIOD" },
    select: { id: true, studentId: true, status: true },
  });

  console.log(`Tìm thấy ${enrollments.length} enrollment PERIOD.\n`);

  let toCreate = 0;
  let totalBalance = 0;
  const rows: { enrollmentId: string; studentId: string; balance: number }[] = [];

  for (const enrollment of enrollments) {
    const existingWallet = await prisma.enrollmentWallet.findUnique({ where: { enrollmentId: enrollment.id } });
    if (existingWallet) continue; // đã có ví (enrollment tạo sau khi có Ví) — không đụng vào

    const charges = await prisma.charge.findMany({
      where: { enrollmentId: enrollment.id, billingModel: "PERIOD" },
      include: { allocations: { where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } } } },
    });

    let sessionsBilled = 0;
    let sessionsPaid = 0;
    for (const charge of charges) {
      sessionsBilled += charge.sessionCount;
      const paidForThisCharge = charge.allocations.reduce((sum, a) => sum + a.amount, 0);
      // Trừ phần tiền sách trong charge trước khi quy ra buổi — allocations không tách
      // riêng học phí/sách, xấp xỉ theo tỉ lệ tuitionAmount trong tổng own-due của charge.
      const ownDue = charge.tuitionAmount + charge.materialsAmount;
      const tuitionShare = ownDue > 0 ? paidForThisCharge * (charge.tuitionAmount / ownDue) : 0;
      if (charge.unitPrice > 0) sessionsPaid += tuitionShare / charge.unitPrice;
    }

    const balance = Math.max(0, Math.round(sessionsPaid - sessionsBilled));
    if (balance > 0 || charges.length > 0) {
      rows.push({ enrollmentId: enrollment.id, studentId: enrollment.studentId, balance });
      totalBalance += balance;
      toCreate++;
    }
  }

  console.log(`Sẽ tạo ${toCreate} ví, tổng ${totalBalance} buổi.`);
  console.log("10 dòng đầu để kiểm tra:");
  for (const row of rows.slice(0, 10)) {
    console.log(`  enrollment=${row.enrollmentId} student=${row.studentId} balance=${row.balance}`);
  }

  if (!apply) {
    console.log("\n(Chưa ghi gì — chạy lại kèm --apply để ghi thật.)");
    return;
  }

  for (const row of rows) {
    await prisma.enrollmentWallet.create({
      data: {
        enrollmentId: row.enrollmentId,
        balance: row.balance,
        transactions: row.balance > 0
          ? { create: { kind: "MANUAL", amount: row.balance, note: "Backfill lúc triển khai Ví buổi học" } }
          : undefined,
      },
    });
  }
  console.log(`\nĐã ghi ${rows.length} ví.`);
}

main()
  .catch((error) => {
    console.error("Backfill thất bại:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
