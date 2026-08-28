import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { canTransitionPayrollRun, canEditPayroll } from "@/lib/server/payroll-rules";
import { hasPermission } from "@/lib/server/permissions";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canViewFullWithOverride, canViewWithOverride, canUpdateWithOverride, canDeleteWithOverride } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import { evaluatePayrollRunChecklist } from "@/lib/server/payroll-checklist";

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
  const access = user ? await getUserRoleAndOverride(user.id, "hr") : { role: null, override: null };
  if (user && !canViewWithOverride("hr", access.role, access.override)) {
    return NextResponse.json({ error: "Khong co quyen xem bang luong" }, { status: 403 });
  }
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const limitedToOwnPayroll = !canViewFullWithOverride("hr", access.role, access.override);
  if (limitedToOwnPayroll && !user.employeeId) {
    return NextResponse.json({ error: "Tài khoản chưa liên kết hồ sơ nhân viên" }, { status: 403 });
  }

  const run = await prisma.payrollRun.findUnique({
    where: { id: params.id },
    include: {
      lines: {
        where: limitedToOwnPayroll ? { employeeId: user.employeeId! } : undefined,
        include: { employee: true },
        orderBy: { employee: { fullName: "asc" } },
      },
    },
  });
  if (!run) return NextResponse.json({ error: "Không tìm thấy kỳ lương" }, { status: 404 });

  if (!(await canAccessBranch(run.branchId))) return NextResponse.json({ error: "Khong co quyen truy cap co so" }, { status: 403 });
  if (limitedToOwnPayroll && run.lines.length === 0) {
    return NextResponse.json({ error: "Không có dữ liệu lương của bạn trong kỳ này" }, { status: 404 });
  }
  return NextResponse.json({ item: run });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const run = await prisma.payrollRun.findUnique({ where: { id: params.id } });
  const access = await getUserRoleAndOverride(user.id, "hr");
  if (!canUpdateWithOverride("hr", access.role, access.override)) {
    return NextResponse.json({ error: "Khong co quyen cap nhat ky luong" }, { status: 403 });
  }
  if (run && !(await canAccessBranch(run.branchId))) {
    return NextResponse.json({ error: "Khong co quyen truy cap co so" }, { status: 403 });
  }
  if (!run) return NextResponse.json({ error: "Không tìm thấy kỳ lương" }, { status: 404 });

  const body = await req.json();
  if (!canTransitionPayrollRun(run.status, body.status)) {
    return NextResponse.json({ error: `Không thể chuyển kỳ lương từ "${run.status}" sang "${body.status}"` }, { status: 409 });
  }

  const requiredAction = STATUS_PERMISSION[body.status];
  if (requiredAction && !(await hasPermission(user, "payroll", requiredAction))) {
    return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này với kỳ lương" }, { status: 403 });
  }
  if (body.status === "APPROVED" || body.status === "LOCKED") {
    const checklist = await evaluatePayrollRunChecklist(run.id);
    if (!checklist?.isReady) {
      const pending = checklist?.items.filter((item) => !item.done).map((item) => item.label).join("; ") ?? "Checklist chưa hoàn tất";
      return NextResponse.json(
        { error: `Chưa thể ${body.status === "APPROVED" ? "duyệt" : "khóa"} kỳ lương. Cần hoàn tất: ${pending}.` },
        { status: 409 },
      );
    }
  }

  const now = new Date();
  const updated = await prisma.payrollRun.update({
    where: { id: params.id },
    data: {
      status: body.status,
      approvedAt: body.status === "APPROVED" ? now : run.approvedAt,
      lockedAt: body.status === "LOCKED" ? now : run.lockedAt,
      // Mở lại (REOPENED) chỉ đến từ PAID — xóa paidAt vì kỳ này không còn coi là đã
      // trả xong nữa, giữ nguyên approvedAt/lockedAt làm dấu vết lịch sử (giống cách
      // BillingPeriod giữ postedAt, chỉ xóa closedAt khi REOPENED).
      paidAt: body.status === "PAID" ? now : body.status === "REOPENED" ? null : run.paidAt,
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
  if (run && !(await canAccessBranch(run.branchId))) {
    return NextResponse.json({ error: "Khong co quyen truy cap co so" }, { status: 403 });
  }
  if (!run) return NextResponse.json({ error: "Không tìm thấy kỳ lương" }, { status: 404 });
  if (!canEditPayroll(run.status)) {
    return NextResponse.json({ error: "Kỳ lương đã duyệt/khóa, không thể xóa." }, { status: 409 });
  }

  await prisma.payrollRun.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
