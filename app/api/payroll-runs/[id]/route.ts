import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { canTransitionPayrollRun, canEditPayroll } from "@/lib/server/payroll-rules";
import { hasPermission } from "@/lib/server/permissions";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canDeleteWithOverride } from "@/lib/server/role-matrix";

// Trạng thái đích -> quyền cần có. APPROVED/LOCKED/PAID là các bước không thể đảo
// ngược (chốt lương) nên gác bằng RBAC, không chỉ đăng nhập là đủ (Master Spec §10).
const STATUS_PERMISSION: Record<string, string> = {
  APPROVED: "approve",
  LOCKED: "post",
  PAID: "post",
  REOPENED: "reopen",
};

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const run = await prisma.payrollRun.findUnique({
    where: { id: params.id },
    include: { lines: { include: { employee: true }, orderBy: { employee: { fullName: "asc" } } } },
  });
  if (!run) return NextResponse.json({ error: "Không tìm thấy kỳ lương" }, { status: 404 });

  return NextResponse.json({ item: run });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const run = await prisma.payrollRun.findUnique({ where: { id: params.id } });
  if (!run) return NextResponse.json({ error: "Không tìm thấy kỳ lương" }, { status: 404 });

  const body = await req.json();
  if (!canTransitionPayrollRun(run.status, body.status)) {
    return NextResponse.json({ error: `Không thể chuyển kỳ lương từ "${run.status}" sang "${body.status}"` }, { status: 409 });
  }

  const requiredAction = STATUS_PERMISSION[body.status];
  if (requiredAction && !(await hasPermission(user, "payroll", requiredAction))) {
    return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này với kỳ lương" }, { status: 403 });
  }

  const now = new Date();
  const updated = await prisma.payrollRun.update({
    where: { id: params.id },
    data: {
      status: body.status,
      approvedAt: body.status === "APPROVED" ? now : run.approvedAt,
      lockedAt: body.status === "LOCKED" ? now : run.lockedAt,
      paidAt: body.status === "PAID" ? now : run.paidAt,
    },
  });

  return NextResponse.json({ item: updated });
}

// Chỉ cho xóa khi kỳ lương còn ở trạng thái "có thể sửa" (DRAFT/CALCULATED/REVIEWED)
// — cùng ngưỡng với canEditPayroll đang gác việc sửa dòng lương, để không xóa được
// kỳ đã duyệt/khóa/đã trả (Master Spec §10, các bước này không thể đảo ngược).
// PayrollRun.lines có onDelete: Cascade nên xóa run tự dọn sạch line, không cần xóa tay.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canDeleteWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa kỳ lương" }, { status: 403 });
  }

  const run = await prisma.payrollRun.findUnique({ where: { id: params.id } });
  if (!run) return NextResponse.json({ error: "Không tìm thấy kỳ lương" }, { status: 404 });
  if (!canEditPayroll(run.status)) {
    return NextResponse.json({ error: "Kỳ lương đã duyệt/khóa, không thể xóa." }, { status: 409 });
  }

  await prisma.payrollRun.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
