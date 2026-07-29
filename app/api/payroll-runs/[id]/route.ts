import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { canTransitionPayrollRun } from "@/lib/server/payroll-rules";
import { hasPermission } from "@/lib/server/permissions";

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
