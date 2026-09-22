import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import { applyBulkAssignment, planBulkAssignment, type BulkMode } from "@/lib/server/bulk-staff-assignment";

// Phân công hàng loạt từ lịch tổng — xem lib/server/bulk-staff-assignment.ts.
// Gửi không có confirm → trả kế hoạch để xem trước. confirm: true → lập lại kế hoạch trong
// giao dịch (phòng ai đó vừa xếp lịch làm phát sinh trùng) rồi ghi.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền phân công GV/TG" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const sessionIds: string[] = Array.isArray(body.sessionIds) ? [...new Set(body.sessionIds.map(String))].slice(0, 500) as string[] : [];
  // Danh sách GV và TG (lớp có thể 2 giáo viên, 2 trợ giảng). Vẫn nhận teacherId/assistantId
  // đơn lẻ cho tương thích.
  const toIds = (list: unknown, single: unknown) =>
    [...new Set([...(Array.isArray(list) ? list : []), ...(single ? [single] : [])].map(String).filter(Boolean))].slice(0, 5);
  const teacherIds = toIds(body.teacherIds, body.teacherId);
  const assistantIds = toIds(body.assistantIds, body.assistantId);
  const mode: BulkMode = body.mode === "REPLACE" ? "REPLACE" : "FILL_EMPTY";
  if (sessionIds.length === 0) return NextResponse.json({ error: "Chưa chọn buổi học nào." }, { status: 400 });
  if (!teacherIds.length && !assistantIds.length) {
    return NextResponse.json({ error: "Chọn giáo viên hoặc trợ giảng cần gán." }, { status: 400 });
  }
  if (teacherIds.some((id) => assistantIds.includes(id))) {
    return NextResponse.json({ error: "Một người không thể vừa là giáo viên vừa là trợ giảng của cùng buổi." }, { status: 400 });
  }

  const branches = await prisma.classSession.findMany({
    where: { id: { in: sessionIds } },
    select: { class: { select: { branchId: true } } },
    distinct: ["classId"],
  });
  for (const branchId of new Set(branches.map((b) => b.class.branchId))) {
    if (!(await canAccessBranch(branchId))) {
      return NextResponse.json({ error: "Có buổi học thuộc cơ sở bạn không có quyền." }, { status: 403 });
    }
  }

  // allowOverlap: người xếp lịch đã tick "cho phép xếp trùng giờ" (tối đa 2 lớp/khung giờ).
  const input = { sessionIds, teacherIds, assistantIds, mode, allowOverlap: Boolean(body.allowOverlap) };
  if (!body.confirm) {
    const plan = await planBulkAssignment(prisma, input);
    return NextResponse.json({ plan: { items: plan.items, counts: plan.counts } });
  }

  const result = await prisma.$transaction(async (tx) => {
    const plan = await planBulkAssignment(tx, input);
    const { written } = await applyBulkAssignment(tx, plan);
    return { plan, written };
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId: user.branchId,
      action: "bulk_assign_staff",
      entityType: "ClassSession",
      entityId: sessionIds[0],
      after: JSON.stringify({ teacherIds, assistantIds, mode, sessions: sessionIds.length, counts: result.plan.counts }),
    },
  });

  return NextResponse.json({ written: result.written, plan: { items: result.plan.items, counts: result.plan.counts } });
}
