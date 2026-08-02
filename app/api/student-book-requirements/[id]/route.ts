import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { canEditCharges } from "@/lib/server/tuition-rules";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "tuition");
  if (!canUpdateWithOverride("tuition", role, override)) {
    return NextResponse.json({ error: "Bạn không có quyền xác nhận yêu cầu sách." }, { status: 403 });
  }

  const requirement = await prisma.studentBookRequirement.findUnique({
    where: { id: params.id },
    include: {
      student: true,
      enrollment: true,
      book: true,
      bookIssue: true,
    },
  });
  if (!requirement) return NextResponse.json({ error: "Không tìm thấy yêu cầu sách." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const nextStatus = String(body.status ?? "").toUpperCase();
  if (!["PENDING", "CONFIRMED", "DECLINED"].includes(nextStatus)) {
    return NextResponse.json({ error: "Trạng thái yêu cầu sách không hợp lệ." }, { status: 400 });
  }

  if (nextStatus === "CONFIRMED") {
    await prisma.$transaction(async (tx) => {
      let bookIssueId = requirement.bookIssueId;

      if (!requirement.bookIssueId) {
        const issue = await tx.bookIssue.create({
          data: {
            bookId: requirement.bookId,
            classId: requirement.classId,
            studentId: requirement.studentId,
            quantity: requirement.quantity,
            unitPrice: requirement.unitPriceSnapshot,
            amount: requirement.totalAmount,
            issueDate: new Date(),
            notes: requirement.notes ?? "Xác nhận mua bộ sách chuẩn của khóa",
          },
        });
        bookIssueId = issue.id;

        const period = await tx.billingPeriod.findFirst({
          where: {
            branchId: requirement.student.branchId,
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          },
          orderBy: { startDate: "desc" },
        });

        if (period) {
          const charge = await tx.charge.findUnique({
            where: {
              studentId_classId_billingPeriodId: {
                studentId: requirement.studentId,
                classId: requirement.classId,
                billingPeriodId: period.id,
              },
            },
          });

          if (charge && canEditCharges(period.status)) {
            await tx.bookIssue.update({ where: { id: issue.id }, data: { chargeId: charge.id } });
            await tx.charge.update({
              where: { id: charge.id },
              data: {
                materialsAmount: charge.materialsAmount + requirement.totalAmount,
                totalAmount: charge.totalAmount + requirement.totalAmount,
              },
            });
          }
        }
      }

      await tx.studentBookRequirement.update({
        where: { id: requirement.id },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          declinedAt: null,
          bookIssueId,
          notes: typeof body.notes === "string" ? body.notes : requirement.notes,
        },
      });
    });
  } else {
    await prisma.studentBookRequirement.update({
      where: { id: requirement.id },
      data: {
        status: nextStatus,
        declinedAt: nextStatus === "DECLINED" ? new Date() : null,
        confirmedAt: nextStatus === "PENDING" ? null : requirement.confirmedAt,
        notes: typeof body.notes === "string" ? body.notes : requirement.notes,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
