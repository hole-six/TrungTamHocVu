import type { Prisma } from "@prisma/client";
import { getEnrollmentsForSession } from "./class-roster";

// Ví buổi học — chỉ áp dụng cho Enrollment.billingModel = "PERIOD". Xem kế hoạch đã
// duyệt (phiên 2026-09-07): tách biệt hoàn toàn khỏi Class.totalSessions (chỉ là dự
// kiến lịch) và khỏi Enrollment.usedSessionCount (tiến độ điểm danh — đo nội dung đã
// dạy, không phải quyền học còn lại vì tiền đã đóng).
//
// Đúng 2 sự kiện làm ví đổi:
//   - Nạp: 1 khoản thanh toán được phân bổ cho charge PERIOD của enrollment đó.
//   - Trừ: 1 ClassSession của lớp đó chuyển COMPLETED — trừ 1 cho MỌI enrollment
//     PERIOD đang ACTIVE trong lớp, vô điều kiện, không quan tâm học sinh đó
//     PRESENT hay ABSENT ở buổi này (lớp đã "giao hàng" 1 buổi thật).
// Buổi bị hủy không sinh giao dịch nào — đây là toàn bộ cơ chế "buổi dư tự động
// mang sang tháng sau", không cần bước bù riêng.

const KIND_TOPUP = "TOPUP";
const KIND_SESSION_DEBIT = "SESSION_DEBIT";
const KIND_TRANSFER_IN = "TRANSFER_IN";
const KIND_TRANSFER_OUT = "TRANSFER_OUT";
const KIND_REFUND = "REFUND";
const KIND_MANUAL = "MANUAL";
const KIND_FORFEIT = "FORFEIT";

export async function ensureWallet(tx: Prisma.TransactionClient, enrollmentId: string) {
  const existing = await tx.enrollmentWallet.findUnique({ where: { enrollmentId } });
  if (existing) return existing;
  return tx.enrollmentWallet.create({ data: { enrollmentId, balance: 0 } });
}

// Trừ 1 buổi cho mọi enrollment PERIOD đang ACTIVE của lớp khi 1 buổi thật hoàn
// thành. Idempotent qua khóa duy nhất (walletId, sessionId) — gọi lại nhiều lần
// (sửa điểm danh, chạy lại API) không bao giờ trừ 2 lần cho cùng 1 buổi.
export async function debitWalletsForCompletedSession(tx: Prisma.TransactionClient, sessionId: string) {
  const session = await tx.classSession.findUnique({
    where: { id: sessionId },
    select: { classId: true, sessionDate: true, status: true },
  });
  if (!session) return;
  // Chỉ buổi ĐÃ DẠY THẬT mới được trừ ví. Trước đây hàm này tin người gọi đã kiểm tra
  // trạng thái hộ — đúng với API điểm danh (đặt COMPLETED ngay trước khi gọi), nhưng
  // sai với mọi chỗ gọi khác (script seed gọi thẳng theo id buổi). Buổi trung tâm cho
  // nghỉ mà vẫn trừ ví là thu tiền học viên cho một buổi chưa từng diễn ra — đúng cột
  // "Số buổi nghỉ trừ ngoại lệ" trong file quản lý. Quy tắc phải nằm TRONG hàm, không
  // nằm ở người gọi.
  if (session.status !== "COMPLETED") return;

  // Chỉ trừ những ghi danh THỰC SỰ thuộc về buổi này (đã vào lớp trước/đúng ngày đó và
  // chưa rời lớp tính tới ngày đó) — xem lib/server/class-roster.ts. Trước đây lấy mọi
  // ghi danh đang ACTIVE của lớp nên hoàn thành lại một buổi cũ sẽ trừ ví của cả những
  // học viên mới chuyển vào sau buổi đó.
  const enrollments = await getEnrollmentsForSession(tx, {
    classId: session.classId,
    sessionDate: session.sessionDate,
    billingModel: "PERIOD",
  });

  for (const enrollment of enrollments) {
    const wallet = await ensureWallet(tx, enrollment.id);
    const already = await tx.enrollmentWalletTxn.findUnique({
      where: { walletId_sessionId: { walletId: wallet.id, sessionId } },
    });
    if (already) continue;

    await tx.enrollmentWalletTxn.create({
      data: { walletId: wallet.id, kind: KIND_SESSION_DEBIT, amount: -1, sessionId },
    });
    await tx.enrollmentWallet.update({ where: { id: wallet.id }, data: { balance: { decrement: 1 } } });
  }
}

// Hoàn lại đúng những giao dịch trừ ví gắn với 1 session, khi session đó bị sửa
// ngược khỏi COMPLETED (hủy buổi, sửa lại điểm danh...). Xóa đúng dòng giao dịch của
// session đó thay vì cộng bù mù — nếu session này chưa từng bị trừ (không phải
// PERIOD, hoặc enrollment không ACTIVE lúc đó) thì không có gì để hoàn, an toàn.
export async function reverseWalletDebitsForSession(tx: Prisma.TransactionClient, sessionId: string) {
  const txns = await tx.enrollmentWalletTxn.findMany({
    where: { sessionId, kind: KIND_SESSION_DEBIT },
  });
  for (const txn of txns) {
    await tx.enrollmentWalletTxn.delete({ where: { id: txn.id } });
    await tx.enrollmentWallet.update({ where: { id: txn.walletId }, data: { balance: { increment: 1 } } });
  }
}

// Nạp ví khi 1 khoản thanh toán được phân bổ cho charge PERIOD của enrollment đó.
// Quy đổi 1 LẦN DUY NHẤT theo đơn giá tại đúng thời điểm này — số buổi ra rồi thì cố
// định, giá lớp đổi sau không tính lại (chốt nghiệp vụ, xem kế hoạch mục 3.1).
export async function topUpWalletFromPayment(
  tx: Prisma.TransactionClient,
  params: { enrollmentId: string; paymentId: string; amountVnd: number; unitPrice: number; note?: string },
) {
  const { enrollmentId, paymentId, amountVnd, unitPrice, note } = params;
  if (unitPrice <= 0 || amountVnd <= 0) return { sessionsAdded: 0 };

  const sessionsAdded = Math.floor(amountVnd / unitPrice);
  if (sessionsAdded <= 0) return { sessionsAdded: 0 };

  const wallet = await ensureWallet(tx, enrollmentId);
  await tx.enrollmentWalletTxn.create({
    data: {
      walletId: wallet.id,
      kind: KIND_TOPUP,
      amount: sessionsAdded,
      paymentId,
      unitPriceAtTime: unitPrice,
      note: note ?? null,
    },
  });
  await tx.enrollmentWallet.update({ where: { id: wallet.id }, data: { balance: { increment: sessionsAdded } } });
  return { sessionsAdded };
}

// Chuyển lớp giữa chừng (PERIOD), giá 2 lớp khác nhau — chốt: quy đổi qua tiền
// (mục 3.9). Trả về phần tiền lẻ không quy đổi hết thành buổi để nơi gọi tự quyết
// đưa vào công nợ/CreditBalance, không tự ý xử lý ở đây.
export async function transferWalletToNewEnrollment(
  tx: Prisma.TransactionClient,
  params: { fromEnrollmentId: string; toEnrollmentId: string; oldUnitPrice: number; newUnitPrice: number },
) {
  const { fromEnrollmentId, toEnrollmentId, oldUnitPrice, newUnitPrice } = params;
  const fromWallet = await ensureWallet(tx, fromEnrollmentId);
  const remainingSessions = Math.max(0, fromWallet.balance);

  if (remainingSessions === 0) {
    return { movedSessions: 0, remainingCashAmount: 0 };
  }

  const remainingValue = remainingSessions * Math.max(0, oldUnitPrice);
  const movedSessions = newUnitPrice > 0 ? Math.floor(remainingValue / newUnitPrice) : 0;
  const remainingCashAmount = newUnitPrice > 0 ? remainingValue - movedSessions * newUnitPrice : remainingValue;

  await tx.enrollmentWalletTxn.create({
    data: { walletId: fromWallet.id, kind: KIND_TRANSFER_OUT, amount: -remainingSessions, note: `Chuyển sang enrollment ${toEnrollmentId}` },
  });
  await tx.enrollmentWallet.update({ where: { id: fromWallet.id }, data: { balance: 0 } });

  if (movedSessions > 0) {
    const toWallet = await ensureWallet(tx, toEnrollmentId);
    await tx.enrollmentWalletTxn.create({
      data: { walletId: toWallet.id, kind: KIND_TRANSFER_IN, amount: movedSessions, note: `Nhận từ enrollment ${fromEnrollmentId}` },
    });
    await tx.enrollmentWallet.update({ where: { id: toWallet.id }, data: { balance: { increment: movedSessions } } });
  }

  return { movedSessions, remainingCashAmount };
}

// Kết thúc enrollment còn dư ví — nhân viên tự chọn (chốt nghiệp vụ mục 3.10, KHÔNG
// tự động hóa). "Đã hoàn tiền": đóng ví về 0, việc chuyển tiền mặt thật diễn ra
// NGOÀI hệ thống. "Giữ lại": không đổi gì, ví treo nguyên trên enrollment đã đóng.
// BỎ DỞ THÌ MẤT TIỀN — chính sách của trung tâm: tiền đã thu KHÔNG hoàn lại khi học
// viên tự nghỉ giữa chừng. Buổi còn dư trong ví chỉ được mang sang tháng sau khi học
// viên VẪN HỌC TIẾP (và phần dư đó là do trung tâm cho nghỉ, xem debitWalletsForCompletedSession).
//
// Cố ý GHI MỘT DÒNG GIAO DỊCH thay vì đặt thẳng balance = 0: số dư ví phải luôn khớp
// tổng sổ giao dịch (bất biến số 1 trong scripts/check_money_integrity.ts), và quan
// trọng hơn là phải tra lại được đã mất bao nhiêu buổi, ngày nào, vì lý do gì — nếu
// sau này trung tâm quyết định châm chước cho học viên quay lại thì còn căn cứ.
export async function forfeitWallet(tx: Prisma.TransactionClient, enrollmentId: string, note?: string) {
  const wallet = await ensureWallet(tx, enrollmentId);
  if (wallet.balance <= 0) return { forfeitedSessions: 0 };

  const forfeitedSessions = wallet.balance;
  await tx.enrollmentWalletTxn.create({
    data: {
      walletId: wallet.id,
      kind: KIND_FORFEIT,
      amount: -forfeitedSessions,
      note: note ?? "Bỏ dở giữa chừng — không hoàn tiền theo chính sách trung tâm",
    },
  });
  await tx.enrollmentWallet.update({ where: { id: wallet.id }, data: { balance: 0 } });
  return { forfeitedSessions };
}

export async function markWalletRefunded(tx: Prisma.TransactionClient, enrollmentId: string, note?: string) {
  const wallet = await ensureWallet(tx, enrollmentId);
  if (wallet.balance <= 0) return { refundedSessions: 0 };

  const refundedSessions = wallet.balance;
  await tx.enrollmentWalletTxn.create({
    data: { walletId: wallet.id, kind: KIND_REFUND, amount: -refundedSessions, note: note ?? "Đã hoàn tiền mặt (ghi nhận thủ công)" },
  });
  await tx.enrollmentWallet.update({ where: { id: wallet.id }, data: { balance: 0 } });
  return { refundedSessions };
}

export async function getWalletBalance(tx: Prisma.TransactionClient, enrollmentId: string): Promise<number> {
  const wallet = await tx.enrollmentWallet.findUnique({ where: { enrollmentId } });
  return wallet?.balance ?? 0;
}
