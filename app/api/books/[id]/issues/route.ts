import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeStockBalance } from "@/lib/server/inventory-rules";
import { canEditCharges } from "@/lib/server/tuition-rules";
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
        notes: body.notes || null,
      },
    });

    let linkedChargeId: string | null = null;
    let chargeUpdated = false;

    const period = await tx.billingPeriod.findFirst({
      where: {
        branchId: student.branchId,
        startDate: { lte: issueDate },
        endDate: { gte: issueDate },
      },
      orderBy: { startDate: "desc" },
    });

    if (period && inferredClassId) {
      const charge = await tx.charge.findUnique({
        where: {
          studentId_classId_billingPeriodId: {
            studentId,
            classId: inferredClassId,
            billingPeriodId: period.id,
          },
        },
      });

      if (charge) {
        linkedChargeId = charge.id;
        await tx.bookIssue.update({ where: { id: issue.id }, data: { chargeId: charge.id } });

        if (canEditCharges(period.status)) {
          await tx.charge.update({
            where: { id: charge.id },
            data: {
              materialsAmount: charge.materialsAmount + issue.amount,
              totalAmount: charge.totalAmount + issue.amount,
            },
          });
          chargeUpdated = true;
        }
      }
    }

    await syncBookQuantityOnHand(book.id, tx);
    return { issue, linkedChargeId, chargeUpdated };
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
      classWarning: null,
    },
    { status: 201 },
  );
}
