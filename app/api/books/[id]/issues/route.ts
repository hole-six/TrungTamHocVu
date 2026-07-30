import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeStockBalance } from "@/lib/server/inventory-rules";
import { canEditCharges } from "@/lib/server/tuition-rules";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";

// Xuất giáo trình cho học viên — nguồn XuatNhapSach/T_SachXuat, feed thẳng vào
// TienGiaoTrinh khi sinh học phí (billing-periods/[id]/generate-charges). Spec §14
// liệt kê "Âm kho và điều chỉnh kho" là điểm KHÔNG được tự động quyết định — nên ở
// đây không chặn cứng khi xuất vượt tồn, chỉ cảnh báo để nhân sự tự quyết định.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canCreate("inventory", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xuất giáo trình" }, { status: 403 });
  }

  const book = await prisma.book.findUnique({ where: { id: params.id } });
  if (!book) return NextResponse.json({ error: "Không tìm thấy sách" }, { status: 404 });

  const body = await req.json();
  const studentId = String(body.studentId ?? "").trim();
  const quantity = Number(body.quantity ?? 1);
  if (!studentId) return NextResponse.json({ error: "Thiếu học viên" }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity <= 0) return NextResponse.json({ error: "Số lượng không hợp lệ" }, { status: 400 });

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });
  if (user.branchId && student.branchId !== user.branchId) {
    return NextResponse.json({ error: "Học viên không thuộc chi nhánh của bạn" }, { status: 403 });
  }

  const unitPrice = book.unitPrice;
  const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();

  const activeEnrollments = await prisma.enrollment.findMany({
    where: { studentId, status: "ACTIVE" },
    select: { classId: true },
  });
  const inferredClassId =
    body.classId || (activeEnrollments.length === 1 ? activeEnrollments[0].classId : null);

  const result = await prisma.$transaction(async (tx) => {
    const issue = await tx.bookIssue.create({
      data: {
        bookId: book.id,
        classId: inferredClassId || null,
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

    if (inferredClassId) {
      const period = await tx.billingPeriod.findFirst({
        where: {
          branchId: student.branchId,
          startDate: { lte: issueDate },
          endDate: { gte: issueDate },
        },
        orderBy: { startDate: "desc" },
      });

      if (period) {
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
    }

    return { issue, linkedChargeId, chargeUpdated };
  });

  const balance = await computeStockBalance(book.id);
  const warning = balance.onHand < 0 ? `Tồn kho hiện đang âm (${balance.onHand}) — cần kiểm tra lại phiếu nhập.` : null;

  const classWarning =
    !inferredClassId && activeEnrollments.length > 1
      ? "Học viên đang có nhiều ghi danh active, phiếu xuất chưa tự gắn vào lớp/công nợ nào."
      : null;

  return NextResponse.json(
    {
      item: result.issue,
      balance,
      warning,
      linkedChargeId: result.linkedChargeId,
      chargeUpdated: result.chargeUpdated,
      classWarning,
    },
    { status: 201 }
  );
}
