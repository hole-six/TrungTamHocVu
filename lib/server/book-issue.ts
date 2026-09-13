// XUẤT SÁCH / GIÁO TRÌNH cho 1 học viên — 1 hoặc NHIỀU đầu sách trong cùng 1 lần.
// Trước đây mỗi lần xuất chỉ được 1 đầu sách: đầu khóa phát cả bộ 3–4 cuốn thì phải mở
// form, chọn, xác nhận 3–4 lượt. Giờ chọn cả giỏ rồi ghi nhận 1 lần, tất cả trong 1
// transaction (hoặc xuất đủ cả giỏ, hoặc không xuất cuốn nào).
import { prisma } from "@/lib/prisma";
import { computeStockBalance } from "@/lib/server/inventory-rules";
import { canEditCharges, chargeOwnDueAmount } from "@/lib/server/tuition-rules";
import { syncBookQuantityOnHand } from "@/lib/server/database-sync";
import { canAccessBranch } from "@/lib/branch-filter";

export type BookIssueItemInput = { bookId: string; quantity: number };

export type BookIssueResultItem = {
  issueId: string;
  bookId: string;
  bookName: string;
  quantity: number;
  amount: number;
  linkedChargeId: string | null;
  chargePeriodName: string | null;
  deferredToNextPeriod: boolean;
  onHand: number;
};

export async function issueBooksToStudent(params: {
  studentId: string;
  classId?: string | null;
  items: BookIssueItemInput[];
  issueDate?: Date;
  notes?: string | null;
  paidNow: boolean;
}): Promise<{ error: string; status: number } | { items: BookIssueResultItem[]; warnings: string[] }> {
  const { studentId, paidNow } = params;
  if (!studentId) return { error: "Thiếu học viên", status: 400 };

  // Gộp dòng trùng sách (chọn cùng 1 cuốn 2 lần) thành 1 lượt xuất.
  const merged = new Map<string, number>();
  for (const item of params.items ?? []) {
    const quantity = Number(item.quantity);
    if (!item.bookId) continue;
    if (!Number.isInteger(quantity) || quantity <= 0) return { error: "Số lượng không hợp lệ", status: 400 };
    merged.set(item.bookId, (merged.get(item.bookId) ?? 0) + quantity);
  }
  if (merged.size === 0) return { error: "Chưa chọn sách nào để xuất", status: 400 };
  if (merged.size > 50) return { error: "Mỗi lần xuất tối đa 50 đầu sách", status: 400 };

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return { error: "Không tìm thấy học viên", status: 404 };
  if (!(await canAccessBranch(student.branchId))) {
    return { error: "Học viên không thuộc chi nhánh của bạn", status: 403 };
  }

  const books = await prisma.book.findMany({ where: { id: { in: [...merged.keys()] } } });
  if (books.length !== merged.size) return { error: "Có đầu sách không còn tồn tại, tải lại danh sách sách", status: 404 };

  const activeEnrollments = await prisma.enrollment.findMany({
    where: { studentId, status: "ACTIVE" },
    orderBy: [{ enrollDate: "desc" }, { createdAt: "desc" }],
    select: { classId: true },
  });
  if (activeEnrollments.length === 0) {
    return { error: "Học viên chưa có lớp đang học, không thể phát sinh sách rời khỏi lớp.", status: 400 };
  }
  const requestedClassId = String(params.classId ?? "").trim();
  if (requestedClassId && !activeEnrollments.some((item) => item.classId === requestedClassId)) {
    return { error: "Lớp được chọn không nằm trong danh sách lớp đang học của học viên.", status: 400 };
  }
  if (activeEnrollments.length > 1 && !requestedClassId) {
    return { error: "Học viên đang học nhiều lớp. Hãy chọn đúng lớp cần gắn phát sinh sách.", status: 400 };
  }
  const classId = requestedClassId || activeEnrollments[0].classId;
  const issueDate = params.issueDate ?? new Date();

  const created = await prisma.$transaction(async (tx) => {
    const results: Omit<BookIssueResultItem, "onHand">[] = [];
    for (const book of books) {
      const quantity = merged.get(book.id)!;
      // Thực tế trung tâm: sách thường thu tiền ngay lúc đưa sách. Chỉ khi CHƯA thu thì
      // khoản đó mới được cộng vào kỳ học phí để thu chung.
      const issue = await tx.bookIssue.create({
        data: {
          bookId: book.id,
          classId,
          studentId,
          quantity,
          unitPrice: book.unitPrice,
          amount: quantity * book.unitPrice,
          issueDate,
          paymentStatus: paidNow ? "PAID" : "UNPAID",
          notes: params.notes || null,
        },
      });

      let linkedChargeId: string | null = null;
      let chargePeriodName: string | null = null;
      let deferredToNextPeriod = false;

      if (!paidNow && classId) {
        const period = await tx.billingPeriod.findFirst({
          where: { branchId: student.branchId, startDate: { lte: issueDate }, endDate: { gte: issueDate } },
          orderBy: { startDate: "desc" },
        });
        // Kỳ của tháng đang đứng nếu tháng đó CHƯA thu xong; đã thu xong rồi thì đẩy sang
        // kỳ kế tiếp — không mở lại một tháng phụ huynh đã đóng đủ.
        const candidates = period
          ? await tx.billingPeriod.findMany({
              where: { branchId: student.branchId, startDate: { gte: period.startDate } },
              orderBy: { startDate: "asc" },
              take: 6,
            })
          : [];
        for (const candidate of candidates) {
          if (!canEditCharges(candidate.status)) continue;
          const charge = await tx.charge.findUnique({
            where: { studentId_classId_billingPeriodId: { studentId, classId, billingPeriodId: candidate.id } },
            include: { allocations: { where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } } } },
          });
          if (!charge) continue;
          const paid = charge.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
          const ownDue = chargeOwnDueAmount(charge);
          // Chỉ bỏ qua kỳ ĐÃ THU ĐỦ thật sự. Kỳ chưa phát sinh khoản nào (ownDue = 0) KHÔNG
          // phải là "đã thu xong" — đó là kỳ trống và hoàn toàn nhận được tiền sách.
          if (ownDue > 0 && paid >= ownDue) continue;
          await tx.charge.update({
            where: { id: charge.id },
            data: { materialsAmount: charge.materialsAmount + issue.amount, totalAmount: charge.totalAmount + issue.amount },
          });
          await tx.bookIssue.update({ where: { id: issue.id }, data: { chargeId: charge.id } });
          linkedChargeId = charge.id;
          chargePeriodName = candidate.periodName;
          deferredToNextPeriod = candidate.id !== period?.id;
          break;
        }
      }

      await syncBookQuantityOnHand(book.id, tx);
      results.push({
        issueId: issue.id,
        bookId: book.id,
        bookName: book.name,
        quantity,
        amount: issue.amount,
        linkedChargeId,
        chargePeriodName,
        deferredToNextPeriod,
      });
    }
    return results;
  });

  const warnings: string[] = [];
  const items: BookIssueResultItem[] = [];
  for (const item of created) {
    const balance = await computeStockBalance(item.bookId);
    await syncBookQuantityOnHand(item.bookId);
    if (balance.onHand < 0) warnings.push(`${item.bookName}: tồn kho đang âm (${balance.onHand}) — cần kiểm tra lại phiếu nhập.`);
    items.push({ ...item, onHand: balance.onHand });
  }
  return { items, warnings };
}
