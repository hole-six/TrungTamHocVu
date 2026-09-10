// Kiểm tra toàn vẹn TIỀN trên toàn bộ dữ liệu đang có.
// Chạy: npx tsx scripts/check_money_integrity.ts
//
// Mỗi mục dưới đây là một BẤT BIẾN: nếu sai thì có tiền đang bị đếm nhầm ở đâu đó,
// không phải chuyện hiển thị. Chạy sau mỗi lần sửa logic học phí/ví/thanh toán.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";

let failed = 0;
function check(ok: boolean, title: string, detail: string) {
  if (!ok) failed += 1;
  console.log(`${ok ? "ĐÚNG" : "SAI "}  ${title}`);
  if (detail) console.log(`        ${detail}`);
}

async function main() {
  // ---- 1. Số dư ví phải khớp đúng tổng các dòng giao dịch của chính nó ----
  // Ví là con số quyết định học viên còn được học bao nhiêu buổi. Nếu balance lệch khỏi
  // sổ giao dịch thì hoặc có chỗ cộng/trừ thẳng vào balance mà quên ghi giao dịch, hoặc
  // ngược lại — cả hai đều làm mất dấu vết tiền.
  const wallets = await prisma.enrollmentWallet.findMany({
    include: { transactions: true, enrollment: { include: { student: true } } },
  });
  const walletMismatch = wallets.filter((w) => {
    const sum = w.transactions.reduce((s, t) => s + t.amount, 0);
    return sum !== w.balance;
  });
  check(
    walletMismatch.length === 0,
    `Số dư ví khớp sổ giao dịch (${wallets.length} ví)`,
    walletMismatch
      .map((w) => `${w.enrollment.student.fullName}: balance=${w.balance}, tổng giao dịch=${w.transactions.reduce((s, t) => s + t.amount, 0)}`)
      .join("; "),
  );

  // ---- 2. Không trừ ví 2 lần cho cùng 1 buổi ----
  const dupDebits = await prisma.$queryRawUnsafe<{ wallet_id: string; session_id: string; n: number }[]>(
    `SELECT wallet_id, session_id, COUNT(*) as n FROM enrollment_wallet_transactions
     WHERE kind = 'SESSION_DEBIT' AND session_id IS NOT NULL
     GROUP BY wallet_id, session_id HAVING COUNT(*) > 1`,
  );
  check(dupDebits.length === 0, "Mỗi buổi chỉ trừ ví đúng 1 lần", dupDebits.map((d) => `ví ${d.wallet_id.slice(0, 8)} bị trừ ${d.n} lần cho 1 buổi`).join("; "));

  // ---- 3. Tiền đã phân bổ không được vượt quá số tiền của phiếu thu ----
  const payments = await prisma.payment.findMany({
    where: { status: { notIn: ["VOIDED", "REFUNDED"] } },
    include: { allocations: true, student: true },
  });
  const overAllocated = payments.filter((p) => p.allocations.reduce((s, a) => s + a.amount, 0) > p.amount);
  check(
    overAllocated.length === 0,
    `Phân bổ không vượt số tiền phiếu thu (${payments.length} phiếu)`,
    overAllocated.map((p) => `${p.student.fullName} phiếu ${p.paymentNo}: thu ${vnd(p.amount)}, phân bổ ${vnd(p.allocations.reduce((s, a) => s + a.amount, 0))}`).join("; "),
  );

  // ---- 4. Không thu quá số tiền của từng phiếu học phí ----
  const charges = await prisma.charge.findMany({
    include: { allocations: { where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } } }, student: true, billingPeriod: true },
  });
  const overPaid = charges.filter((c) => {
    const paid = c.allocations.reduce((s, a) => s + a.amount, 0);
    return paid > c.tuitionAmount + c.materialsAmount;
  });
  check(
    overPaid.length === 0,
    `Không thu vượt phiếu học phí (${charges.length} phiếu)`,
    overPaid.map((c) => `${c.student.fullName} kỳ ${c.billingPeriod.periodName}: phải thu ${vnd(c.tuitionAmount + c.materialsAmount)}, đã thu ${vnd(c.allocations.reduce((s, a) => s + a.amount, 0))}`).join("; "),
  );

  // ---- 5. Giá trị chuyển lớp không vượt tiền thật đã thu ----
  // Đây là quy tắc gốc: SỐ TIỀN THU VÀO là số tiền đích đến cuối cùng.
  const transferred = await prisma.enrollment.findMany({
    where: { transferredFromEnrollmentId: { not: null }, billingModel: "COURSE" },
    include: { student: true, transferredFrom: true },
  });
  const badTransfers: string[] = [];
  for (const enrollment of transferred) {
    const from = enrollment.transferredFrom;
    if (!from) continue;
    const fromCharges = await prisma.charge.findMany({
      where: { enrollmentId: from.id },
      include: { allocations: { where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } } } },
    });
    const paidTuition = fromCharges.reduce((sum, charge) => {
      const paid = charge.allocations.reduce((s, a) => s + a.amount, 0);
      const own = charge.tuitionAmount + charge.materialsAmount;
      return sum + (own > 0 ? Math.round((paid * charge.tuitionAmount) / own) : paid);
    }, 0);
    if (enrollment.transferredValueAmount > paidTuition) {
      badTransfers.push(`${enrollment.student.fullName}: mang sang ${vnd(enrollment.transferredValueAmount)} nhưng lớp cũ chỉ thu được ${vnd(paidTuition)}`);
    }
  }
  check(badTransfers.length === 0, `Giá trị chuyển lớp không vượt tiền đã thu (${transferred.length} ca)`, badTransfers.join("; "));

  // ---- 6. Buổi bổ trợ không gắn với buổi đã hủy ----
  // Buổi không diễn ra thì không ai vắng — credit cấp từ buổi đó phải bị thu hồi.
  const orphanCredits = await prisma.sessionCredit.findMany({
    where: { status: "AVAILABLE", sourceSession: { status: "CANCELLED" } },
    include: { student: true },
  });
  check(
    orphanCredits.length === 0,
    "Không còn buổi bổ trợ cấp từ buổi đã hủy",
    orphanCredits.map((c) => c.student.fullName).join(", "),
  );

  // ---- 7. Tiến độ điểm danh khớp bản ghi thật ----
  // Quy tắc KHÔNG giống nhau cho 2 nhóm, và đây là chỗ dễ hiểu nhầm nhất:
  //   - Ghi danh MỚI (không chuyển từ đâu tới): usedSessionCount phải BẰNG ĐÚNG số buổi
  //     có mặt/học bù của chính ghi danh đó.
  //   - Ghi danh do CHUYỂN LỚP: tiến độ học đi xuyên suốt các lớp nối tiếp nên
  //     usedSessionCount = phần mang theo từ lớp cũ + số buổi học ở lớp mới, tức luôn
  //     LỚN HƠN HOẶC BẰNG số bản ghi điểm danh của riêng lớp mới. Nhỏ hơn mới là sai.
  const enrollments = await prisma.enrollment.findMany({ include: { student: true, class: true } });
  const progressMismatch: string[] = [];
  for (const enrollment of enrollments) {
    const attended = await prisma.studentAttendance.count({
      where: { enrollmentId: enrollment.id, status: { in: ["PRESENT", "MAKEUP"] } },
    });
    const isTransferred = Boolean(enrollment.transferredFromEnrollmentId);
    const ok = isTransferred ? enrollment.usedSessionCount >= attended : enrollment.usedSessionCount === attended;
    if (!ok) {
      progressMismatch.push(
        `${enrollment.student.fullName} (${enrollment.class?.classCode ?? "không lớp"}${isTransferred ? ", chuyển lớp" : ""}): ` +
          `usedSessionCount=${enrollment.usedSessionCount}, điểm danh của ghi danh này=${attended}`,
      );
    }
  }
  check(
    progressMismatch.length === 0,
    `Tiến độ điểm danh khớp bản ghi thật (${enrollments.length} ghi danh)`,
    progressMismatch.slice(0, 6).join("; "),
  );

  // ---- 8. Tiền đóng trước phải được dùng hết trước khi còn phiếu học phí chưa thu ----
  // Tiền đã thu mà chưa gắn vào phiếu nào (đóng trước / thu dư) là chuyện bình thường,
  // NHƯNG chỉ khi học viên đó không còn phiếu học phí nào thiếu tiền. Nếu vừa còn nợ
  // vừa còn tiền dư treo thì nghĩa là bước tự trừ tiền đóng trước đã không chạy —
  // phụ huynh sẽ bị đòi lại đúng khoản họ đã đóng. Xem lib/server/advance-payment.ts.
  const studentsWithMoney = await prisma.student.findMany({
    where: { OR: [{ payments: { some: {} } }, { charges: { some: {} } }] },
    select: {
      id: true,
      fullName: true,
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
  const strandedAdvance = studentsWithMoney
    .map((student) => {
      const advance = student.payments.reduce(
        (sum, payment) => sum + payment.amount - payment.allocations.reduce((s, a) => s + a.amount, 0),
        0,
      );
      const unpaid = student.charges.reduce((sum, charge) => {
        const due = charge.tuitionAmount + charge.materialsAmount - charge.allocations.reduce((s, a) => s + a.amount, 0);
        return sum + Math.max(0, due);
      }, 0);
      return { name: student.fullName, advance, unpaid };
    })
    .filter((item) => item.advance > 0 && item.unpaid > 0);
  check(
    strandedAdvance.length === 0,
    `Tiền đóng trước không bị treo khi vẫn còn nợ (${studentsWithMoney.length} học viên)`,
    strandedAdvance.slice(0, 6).map((item) => `${item.name}: dư ${vnd(item.advance)} nhưng vẫn nợ ${vnd(item.unpaid)}`).join("; "),
  );


  console.log(failed === 0 ? "\n==> TOÀN BỘ BẤT BIẾN VỀ TIỀN ĐỀU ĐÚNG." : `\n==> CÓ ${failed} BẤT BIẾN BỊ SAI.`);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
