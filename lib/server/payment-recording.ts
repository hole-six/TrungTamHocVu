import type { Prisma } from "@prisma/client";
import { computeOutstandingBalance } from "@/lib/server/balance";
import { chargeOwnDueAmount, computeTotalAmount } from "@/lib/server/tuition-rules";
import { topUpWalletFromPayment } from "@/lib/server/enrollment-wallet";
import { computeAdvanceBalance } from "@/lib/server/advance-payment";
import { computeCashDiscount } from "@/lib/cash-discount";

// GHI NHẬN MỘT KHOẢN THU HỌC PHÍ — tách khỏi route để chạy được trong bộ test tự động
// (tiền là chỗ không được phép "chắc là đúng"). Route /api/payments chỉ còn lo quyền,
// kiểm tra dữ liệu vào và gọi hàm này trong 1 giao dịch.

export type RecordPaymentParams = {
  studentId: string;
  amount: number;
  method: string;
  discountPercent: number;
  discountReason: string;
  paidDate?: Date | null;
  notes?: string | null;
  description?: string | null;
  categoryId?: string | null;
  userId: string;
  paymentNo: string;
  student: { branchId: string; fullName: string; studentCode: string };
};

export async function recordStudentPayment(tx: Prisma.TransactionClient, params: RecordPaymentParams) {
  const student = params.student;
  const paymentNo = params.paymentNo;
    const currentOutstanding = await computeOutstandingBalance(params.studentId, tx);
    // Chiết khấu tiền mặt: phụ huynh trả (100 − x)% của khoản nợ được xóa — xem
    // lib/cash-discount.ts (dùng chung với màn thu tiền để hai bên không lệch số).
    const discount = computeCashDiscount({ cash: params.amount, percent: params.discountPercent, outstanding: currentOutstanding });
    const discountAmount = discount.discountAmount;
    const discountNote =
      discountAmount > 0
        ? `Đã giảm ${discountAmount.toLocaleString("vi-VN")}đ do chiết khấu tiền mặt ${params.discountPercent}%` +
          ` (thu ${discount.cashForDebt.toLocaleString("vi-VN")}đ, xóa nợ ${discount.settledAmount.toLocaleString("vi-VN")}đ)` +
          `${params.discountReason ? ` · Lý do: ${params.discountReason}` : ""}`
        : null;
    const paymentNotes = [params.notes?.trim() || null, discountNote].filter(Boolean).join(" | ");

    // ĐÓNG TRƯỚC / THU DƯ ĐƯỢC PHÉP. Trước đây chỗ này chặn thẳng hai ca "chưa có công
    // nợ" và "thu vượt công nợ", khiến nhân viên không ghi nhận được đúng số tiền đã
    // cầm của phụ huynh — trong khi ở file quản lý thật của trung tâm, "TT dư" là một
    // tình trạng bình thường (260 dòng mang số dư âm ở cột "HP tồn tháng trước").
    // Nay phần vượt công nợ nằm lại trên phiếu thu ở dạng chưa phân bổ và sẽ tự trừ
    // vào phiếu học phí kỳ sau — xem lib/server/advance-payment.ts.
    //
    // Chiết khấu KHÔNG BAO GIỜ xóa nợ nhiều hơn số đang nợ: computeCashDiscount đã cắt
    // theo công nợ, phần tiền thu vượt mức "đủ trả nợ" thành tiền đóng trước chứ không
    // được nhân thêm chiết khấu (không còn nợ nào để giảm).
    if (params.discountPercent > 0 && currentOutstanding <= 0) {
      throw new Error("Học viên không còn công nợ nên không có gì để chiết khấu. Bỏ chiết khấu rồi thu lại.");
    }

    const payment = await tx.payment.create({
      data: {
        studentId: params.studentId,
        paymentNo,
        paidDate: params.paidDate ?? new Date(),
        amount: params.amount,
        method: params.method || null,
        receivedById: params.userId,
        notes: paymentNotes || null,
        status: "ALLOCATED",
      },
    });

    const openCharges = await tx.charge.findMany({
      where: { studentId: params.studentId },
      include: {
        allocations: { where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } } },
      },
      orderBy: [{ billingPeriod: { startDate: "asc" } }, { createdAt: "asc" }],
    });

    // Phân bổ: TIỀN MẶT trả nợ tới đâu ghi nhận tới đó; phần CHIẾT KHẤU giảm thẳng trên
    // phiếu học phí (đây là giảm giá, không phải tiền). Trước đây chiết khấu được ghi thành
    // "tiền dư" của học viên trong khi tiền mặt vẫn trả hết phiếu — hóa ra phụ huynh vừa trả
    // đủ vừa được cộng thêm một khoản dư không có gốc.
    let remainingCash = discount.cashForDebt;
    let remainingDiscount = discountAmount;
    let allocatedCash = 0;
    const chargeDiscountNote = `Giảm ${params.discountPercent}% do thu tiền mặt (phiếu thu ${paymentNo})${params.discountReason ? ` · ${params.discountReason}` : ""}`;

    for (const charge of openCharges) {
      if (remainingCash <= 0 && remainingDiscount <= 0) break;
      const alreadyPaid = charge.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
      // chargeOwnDueAmount (KHÔNG dùng totalAmount) — totalAmount cộng cả openingBalance
      // (bản chụp lại nợ charge kỳ TRƯỚC), nếu dùng trực tiếp sẽ đếm trùng đúng khoản nợ
      // đó 2 lần: 1 lần ở chính charge kỳ trước, 1 lần nữa ở đây.
      const due = chargeOwnDueAmount(charge) - alreadyPaid;
      if (due <= 0) continue;

      const cashPart = Math.min(due, remainingCash);
      const discountPart = Math.min(due - cashPart, remainingDiscount);

      if (cashPart > 0) {
        await tx.paymentAllocation.create({
          data: { paymentId: payment.id, chargeId: charge.id, amount: cashPart },
        });
        remainingCash -= cashPart;
        allocatedCash += cashPart;
      }

      if (discountPart > 0) {
        const tuitionAmount = Math.max(0, charge.tuitionAmount - discountPart);
        await tx.charge.update({
          where: { id: charge.id },
          data: {
            tuitionAmount,
            mainTuitionAmount: Math.max(0, charge.mainTuitionAmount - discountPart),
            totalAmount: computeTotalAmount(tuitionAmount, charge.materialsAmount, charge.openingBalance),
            notes: [charge.notes, `${chargeDiscountNote}: −${discountPart.toLocaleString("vi-VN")}đ`]
              .filter(Boolean)
              .join(" | "),
          },
        });
        remainingDiscount -= discountPart;
      }

      // Ví buổi học: học viên được quyền học theo GIÁ TRỊ đã thanh toán — tiền mặt cộng phần
      // được giảm giá. Nạp ví chỉ theo tiền mặt thì người được giảm giá bị thiếu buổi.
      if (charge.billingModel === "PERIOD" && charge.enrollmentId && cashPart + discountPart > 0) {
        await topUpWalletFromPayment(tx, {
          enrollmentId: charge.enrollmentId,
          paymentId: payment.id,
          amountVnd: cashPart + discountPart,
          unitPrice: charge.unitPrice,
          note: discountPart > 0
            ? `Gồm phần chiết khấu tiền mặt ${params.discountPercent}% (đã giảm ${discountPart.toLocaleString("vi-VN")}đ)`
            : undefined,
        });
      }
    }
    const remaining = params.amount - allocatedCash;

    const cashTxn = await tx.cashTransaction.create({
      data: {
        branchId: student.branchId,
        categoryId: params.categoryId ?? null,
        type: "THU",
        txnDate: params.paidDate ?? new Date(),
        description: params.description || `Thu học phí ${student.fullName} (${student.studentCode})`,
        detail: `Phiếu thu ${paymentNo}`,
        amount: params.amount,
        handledById: params.userId,
        status: "CONFIRMED",
        notes: paymentNotes || null,
      },
    });

    await tx.paymentCashPosting.create({
      data: {
        paymentId: payment.id,
        cashTransactionId: cashTxn.id,
        amount: params.amount,
        postingKind: "RECEIPT",
        notes: `Auto-post từ phiếu thu ${paymentNo}`,
      },
    });

    return {
      payment,
      unallocated: remaining,
      advanceBalance: await computeAdvanceBalance(tx, params.studentId),
      cashTransactionId: cashTxn.id,
      discountAmount,
      discountNote,
    };
}
