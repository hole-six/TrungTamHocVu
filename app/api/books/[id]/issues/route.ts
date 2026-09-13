import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canCreateWithOverride } from "@/lib/server/role-matrix";
import { issueBooksToStudent } from "@/lib/server/book-issue";

// Xuất 1 đầu sách cho học viên. Toàn bộ nghiệp vụ nằm ở lib/server/book-issue.ts, dùng
// chung với route xuất NHIỀU đầu sách một lần (app/api/book-issues/batch).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "inventory");
  if (!canCreateWithOverride("inventory", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xuất giáo trình" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const result = await issueBooksToStudent({
    studentId: String(body.studentId ?? "").trim(),
    classId: body.classId,
    items: [{ bookId: params.id, quantity: Number(body.quantity ?? 1) }],
    issueDate: body.issueDate ? new Date(body.issueDate) : undefined,
    notes: body.notes ?? null,
    paidNow: body.paidNow === true,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const item = result.items[0];
  return NextResponse.json(
    {
      item: { id: item.issueId, bookId: item.bookId, quantity: item.quantity, amount: item.amount },
      balance: { onHand: item.onHand },
      warning: result.warnings[0] ?? null,
      linkedChargeId: item.linkedChargeId,
      chargeUpdated: Boolean(item.linkedChargeId),
      chargePeriodName: item.chargePeriodName,
      deferredToNextPeriod: item.deferredToNextPeriod,
      paidNow: body.paidNow === true,
      classWarning: null,
    },
    { status: 201 },
  );
}
