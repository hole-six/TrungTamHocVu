import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canCreateWithOverride } from "@/lib/server/role-matrix";
import { issueBooksToStudent } from "@/lib/server/book-issue";

// XUẤT NHIỀU ĐẦU SÁCH CÙNG LÚC cho 1 học viên (phát cả bộ giáo trình đầu khóa).
// Body: { studentId, classId?, issueDate?, notes?, paidNow, items: [{ bookId, quantity }] }
export async function POST(req: NextRequest) {
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
    items: Array.isArray(body.items) ? body.items.map((item: { bookId: string; quantity: number }) => ({ bookId: String(item?.bookId ?? ""), quantity: Number(item?.quantity ?? 0) })) : [],
    issueDate: body.issueDate ? new Date(body.issueDate) : undefined,
    notes: body.notes ?? null,
    paidNow: body.paidNow === true,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const totalQuantity = result.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = result.items.reduce((sum, item) => sum + item.amount, 0);
  const linked = result.items.filter((item) => item.linkedChargeId);
  return NextResponse.json(
    {
      items: result.items,
      bookCount: result.items.length,
      totalQuantity,
      totalAmount,
      paidNow: body.paidNow === true,
      // Tiền sách chưa thu mà KHÔNG gắn được vào kỳ thu nào = sách đã giao nhưng không ai
      // bị tính tiền — nơi gọi phải nói rõ cho nhân viên, không được im lặng.
      chargeUpdated: linked.length > 0,
      chargeLinkedCount: linked.length,
      chargePeriodName: linked[0]?.chargePeriodName ?? null,
      deferredToNextPeriod: linked.some((item) => item.deferredToNextPeriod),
      unlinkedCount: body.paidNow === true ? 0 : result.items.length - linked.length,
      warnings: result.warnings,
    },
    { status: 201 },
  );
}
