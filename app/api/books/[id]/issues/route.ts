import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeStockBalance } from "@/lib/server/inventory-rules";
import { canEditCharges, chargeOwnDueAmount } from "@/lib/server/tuition-rules";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canCreateWithOverride } from "@/lib/server/role-matrix";
import { syncBookQuantityOnHand } from "@/lib/server/database-sync";
import { canAccessBranch } from "@/lib/branch-filter";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "inventory");
  if (!canCreateWithOverride("inventory", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xuất giáo trình" }, { status: 403 });
  }

  const book = await prisma.book.findUnique({ where: { id: params.id } });
  if (!book) return NextResponse.json({ error: "Không tìm thấy sách" }, { status: 404 });

  const body = await req.json();
  const studentId = String(body.studentId ?? "").trim();
  const quantity = Number(body.quantity ?? 1);
  const requestedClassId = String(body.classId ?? "").trim();

  if (!studentId) return NextResponse.json({ error: "Thiếu học viên" }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Số lượng không hợp lệ" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });
  if (!(await canAccessBranch(student.branchId))) {
    return NextResponse.json({ error: "Học viên không thuộc chi nhánh của bạn" }, { status: 403 });
  }

  const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();
  const activeEnrollments = await prisma.enrollment.findMany({
    where: { studentId, status: "ACTIVE" },
    orderBy: [{ enrollDate: "desc" }, { createdAt: "desc" }],
    select: { classId: true, class: { select: { className: true } } },
  });

  if (activeEnrollments.length === 0) {
    return NextResponse.json(
      { error: "Học viên chưa có lớp đang học, không thể phát sinh sách rời khỏi lớp." },
      { status: 400 },
    );
  }

  const activeClassIds = new Set(activeEnrollments.map((item) => item.classId));
  if (requestedClassId && !activeClassIds.has(requestedClassId)) {
    return NextResponse.json(
      { error: "Lớp được chọn không nằm trong danh sách lớp đang học của học viên." },
      { status: 400 },
    );
  }

  if (activeEnrollments.length > 1 && !requestedClassId) {
    return NextResponse.json(
      { error: "Học viên đang học nhiều lớp. Hãy chọn đúng lớp cần gắn phát sinh sách." },
      { status: 400 },
    );
  }

  const inferredClassId = requestedClassId || activeEnrollments[0].classId;
  const unitPrice = book.unitPrice;

  // Thực tế trung tâm: sách thường thu tiền ngay lúc đưa sách. Chỉ khi CHƯA thu thì
  // khoản đó mới được cộng vào kỳ học phí để thu chung. Trước đây route luôn cộng vào
  // kỳ thu bất kể đã thu hay chưa, nên sách thu tiền mặt vẫn nằm trong công nợ (đếm 2
  // lần), còn khi không gắn được kỳ nào thì im lặng bỏ qua (thu hụt, không ai biết).
  const paidNow = body.paidNow === true;

  const result = await prisma.$transaction(async (tx) => {
    const issue = await tx.bookIssue.create({
      data: {
        bookId: book.id,
        classId: inferredClassId,
        studentId,
        quantity,
        unitPrice,
        amount: quantity * unitPrice,
        issueDate,
        paymentStatus: paidNow ? "PAID" : "UNPAID",
        notes: body.notes || null,
      },
    });

    let linkedChargeId: string | null = null;
    let chargeUpdated = false;
    let chargePeriodName: string | null = null;
    let deferredToNextPeriod = false;

    if (!paidNow && inferredClassId) {
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
          where: {
            studentId_classId_billingPeriodId: {
              studentId,
              classId: inferredClassId,
              billingPeriodId: candidate.id,
            },
          },
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
          data: {
            materialsAmount: charge.materialsAmount + issue.amount,
            totalAmount: charge.totalAmount + issue.amount,
          },
        });
        await tx.bookIssue.update({ where: { id: issue.id }, data: { chargeId: charge.id } });
        linkedChargeId = charge.id;
        chargeUpdated = true;
        chargePeriodName = candidate.periodName;
        deferredToNextPeriod = candidate.id !== period?.id;
        break;
      }
    }

    await syncBookQuantityOnHand(book.id, tx);
    return { issue, linkedChargeId, chargeUpdated, chargePeriodName, deferredToNextPeriod, paidNow };
  });

  const balance = await computeStockBalance(book.id);
  await syncBookQuantityOnHand(book.id);
  const warning = balance.onHand < 0 ? `Tồn kho hiện đang âm (${balance.onHand}) — cần kiểm tra lại phiếu nhập.` : null;

  return NextResponse.json(
    {
      item: result.issue,
      balance,
      warning,
      linkedChargeId: result.linkedChargeId,
      chargeUpdated: result.chargeUpdated,
      chargePeriodName: result.chargePeriodName,
      deferredToNextPeriod: result.deferredToNextPeriod,
      paidNow: result.paidNow,
      classWarning: null,
    },
    { status: 201 },
  );
}
