import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canDeleteWithOverride } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import { canEditCharges } from "@/lib/server/tuition-rules";
import { syncBookQuantityOnHand } from "@/lib/server/database-sync";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { role, override } = await getUserRoleAndOverride(user.id, "inventory");
  if (!canDeleteWithOverride("inventory", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền thu hồi sách đã phát." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const issueIds: string[] = Array.isArray(body.issueIds)
    ? [...new Set<string>(body.issueIds.map((id: unknown) => String(id ?? "").trim()).filter((id: string) => id.length > 0))]
    : [];
  if (issueIds.length === 0) return NextResponse.json({ error: "Chưa chọn dòng sách cần thu hồi." }, { status: 400 });
  if (issueIds.length > 200) return NextResponse.json({ error: "Mỗi lần chỉ thu hồi tối đa 200 dòng sách." }, { status: 400 });

  const issues = await prisma.bookIssue.findMany({
    where: { id: { in: issueIds } },
    include: {
      book: true,
      student: { select: { id: true, branchId: true, studentCode: true, fullName: true } },
      class: { select: { id: true, classCode: true, className: true } },
      charge: { include: { billingPeriod: true } },
    },
  });
  if (issues.length !== issueIds.length) {
    return NextResponse.json({ error: "Có dòng sách không còn tồn tại. Tải lại danh sách rồi thử lại." }, { status: 404 });
  }

  const branchIds = new Set(issues.map((issue) => issue.student.branchId));
  if (branchIds.size !== 1) return NextResponse.json({ error: "Chỉ thu hồi cùng lúc sách trong cùng một cơ sở." }, { status: 400 });
  const branchId = [...branchIds][0];
  if (!(await canAccessBranch(branchId))) return NextResponse.json({ error: "Không có quyền truy cập cơ sở này." }, { status: 403 });

  const paidIssues = issues.filter((issue) => issue.paymentStatus !== "UNPAID");
  if (paidIssues.length) {
    return NextResponse.json(
      {
        error: "Có sách đã thu tiền, không tự xóa. Hãy xử lý hoàn tiền/giữ tiền riêng trước.",
        blocked: paidIssues.map((issue) => ({
          id: issue.id,
          student: `${issue.student.fullName} (${issue.student.studentCode})`,
          bookName: issue.book.name,
          paymentStatus: issue.paymentStatus,
          amount: issue.amount,
        })),
      },
      { status: 409 },
    );
  }

  const lockedIssues = issues.filter((issue) => issue.charge && !canEditCharges(issue.charge.billingPeriod.status));
  if (lockedIssues.length) {
    return NextResponse.json(
      {
        error: "Có dòng sách nằm trong kỳ học phí đã chốt, không thể thu hồi trực tiếp.",
        blocked: lockedIssues.map((issue) => ({
          id: issue.id,
          student: `${issue.student.fullName} (${issue.student.studentCode})`,
          bookName: issue.book.name,
          periodName: issue.charge?.billingPeriod.periodName,
        })),
      },
      { status: 409 },
    );
  }

  const bookIds = [...new Set(issues.map((issue) => issue.bookId))];
  const chargeDeltas = new Map<string, number>();
  for (const issue of issues) {
    if (!issue.chargeId) continue;
    chargeDeltas.set(issue.chargeId, (chargeDeltas.get(issue.chargeId) ?? 0) + issue.amount);
  }

  await prisma.$transaction(async (tx) => {
    for (const [chargeId, delta] of chargeDeltas) {
      const charge = await tx.charge.findUnique({ where: { id: chargeId }, select: { materialsAmount: true, totalAmount: true } });
      if (!charge) continue;
      await tx.charge.update({
        where: { id: chargeId },
        data: {
          materialsAmount: Math.max(0, charge.materialsAmount - delta),
          totalAmount: Math.max(0, charge.totalAmount - delta),
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        branchId,
        action: "revoke-book-issues",
        entityType: "BookIssue",
        entityId: issueIds.join(","),
        before: JSON.stringify(issues),
        reason: String(body.reason ?? "").trim() || "Thu hồi sách đã phát",
      },
    });

    await tx.bookIssue.deleteMany({ where: { id: { in: issueIds } } });
    for (const bookId of bookIds) await syncBookQuantityOnHand(bookId, tx);
  });

  for (const bookId of bookIds) await syncBookQuantityOnHand(bookId);

  return NextResponse.json({
    ok: true,
    revokedCount: issues.length,
    totalQuantity: issues.reduce((total, issue) => total + issue.quantity, 0),
    totalAmount: issues.reduce((total, issue) => total + issue.amount, 0),
  });
}
