// Xóa "số buổi đã mua" bị chép từ lớp sang các ghi danh ĐÓNG THEO THÁNG.
//
// Vì sao có: trước bản sửa, form ghi danh điền sẵn số buổi của lớp và API mặc định
// lấy class.totalSessions, nên mọi ghi danh theo tháng đều mang một con số không do ai
// cam kết cả. Hệ quả: màn hình dựng ra "đã học 27/48 · còn 21 buổi" trong khi quyền học
// thật của học viên nằm ở Ví buổi học — số buổi đã đóng tiền, không phải số buổi của lớp.
// Lớp chỉ là cái mác để xếp thời khóa biểu.
//
// Lỗi gốc đã sửa ở 3 tầng: form không điền sẵn nữa, API không mặc định nữa, và
// resolvePurchasedMainSessions bỏ qua hẳn cột này cho PERIOD. Script này dọn dữ liệu cũ.
//
// Mặc định CHỈ XEM TRƯỚC, không ghi gì. Thêm --apply để thực sự sửa.
// Chạy: npx tsx scripts/repair_period_session_count.ts [--apply]
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const enrollments = await prisma.enrollment.findMany({
    where: { billingModel: "PERIOD", purchasedMainSessionCount: { not: null } },
    include: {
      student: { select: { fullName: true } },
      class: { select: { classCode: true, totalSessions: true } },
      wallet: { select: { balance: true } },
    },
    orderBy: { enrollDate: "asc" },
  });

  if (enrollments.length === 0) {
    console.log("Không có ghi danh theo tháng nào còn mang số buổi của lớp.");
    await prisma.$disconnect();
    return;
  }

  const copiedFromClass = enrollments.filter((item) => item.purchasedMainSessionCount === item.class?.totalSessions);
  console.log(`${enrollments.length} ghi danh theo tháng còn mang "số buổi đã mua"`);
  console.log(`  trong đó ${copiedFromClass.length} trùng ĐÚNG số buổi dự kiến của lớp (tức là chép từ lớp ra).`);
  for (const item of enrollments.slice(0, 10)) {
    console.log(
      `  ${item.student.fullName.padEnd(24)} ${(item.class?.classCode ?? "không lớp").padEnd(14)}` +
        ` đã mua=${String(item.purchasedMainSessionCount).padStart(3)} · lớp dự kiến=${String(item.class?.totalSessions ?? "—").padStart(3)}` +
        ` · ví thật=${item.wallet ? item.wallet.balance : "chưa có ví"}`,
    );
  }
  if (enrollments.length > 10) console.log(`  ... và ${enrollments.length - 10} ghi danh nữa.`);

  if (!APPLY) {
    console.log("\nĐây mới là XEM TRƯỚC — chưa ghi gì. Chạy lại kèm --apply để sửa thật.");
    await prisma.$disconnect();
    return;
  }

  const result = await prisma.enrollment.updateMany({
    where: { billingModel: "PERIOD", purchasedMainSessionCount: { not: null } },
    data: { purchasedMainSessionCount: null },
  });
  console.log(`\nĐã xóa số buổi chép từ lớp ở ${result.count} ghi danh. Quyền học nay chỉ còn tính theo Ví buổi học.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
