// Kiểm chứng quy tắc "SỐ TIỀN THU VÀO là số tiền đích đến cuối cùng" cho gói THEO KHÓA:
// giá trị mang sang lớp mới không bao giờ được vượt quá tiền học phí thật đã thu trừ đi
// giá trị số buổi đã dạy. Chạy: npx tsx scripts/check_transfer_value_qa.ts
import { PrismaClient } from "@prisma/client";
import { getEnrollmentLearningSnapshot } from "../lib/server/enrollment-learning";

const prisma = new PrismaClient();

async function main() {
  const enrollments = await prisma.enrollment.findMany({
    where: { billingModel: "COURSE", status: "ACTIVE" },
    include: { student: true, class: { include: { course: true } } },
  });

  let failures = 0;
  for (const enrollment of enrollments) {
    const snapshot = await getEnrollmentLearningSnapshot(prisma, enrollment as never);
    const consumed = snapshot.completedMainSessions * snapshot.unitPrice;
    const paid = snapshot.paidTuitionAmount ?? 0;
    const moneyRoom = Math.max(0, paid - consumed);

    const ok = snapshot.transferableValue <= moneyRoom && snapshot.transferableValue <= snapshot.remainingValue;
    if (!ok) failures += 1;

    console.log(
      [
        ok ? "PASS" : "FAIL",
        enrollment.student.fullName.padEnd(20),
        `mua ${String(snapshot.purchasedMainSessions).padStart(3)} buổi`,
        `đã học ${String(snapshot.completedMainSessions).padStart(3)}`,
        `đã thu ${paid.toLocaleString("vi-VN").padStart(12)}đ`,
        `đã dạy ${consumed.toLocaleString("vi-VN").padStart(12)}đ`,
        `→ theo quyền lợi ${snapshot.remainingValue.toLocaleString("vi-VN").padStart(11)}đ`,
        `theo tiền thật ${moneyRoom.toLocaleString("vi-VN").padStart(11)}đ`,
        `CHUYỂN ĐƯỢC ${snapshot.transferableValue.toLocaleString("vi-VN").padStart(11)}đ (${snapshot.transferableSessions} buổi)`,
      ].join("  "),
    );
  }

  console.log(failures === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG QUY TẮC." : `\nCÓ ${failures} TRƯỜNG HỢP SAI.`);
  await prisma.$disconnect();
  if (failures > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
