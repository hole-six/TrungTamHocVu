import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { canEditPayroll } from "@/lib/server/payroll-rules";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canUpdateWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa dòng lương" }, { status: 403 });
  }

  const line = await prisma.payrollLine.findUnique({ where: { id: params.id }, include: { payrollRun: true } });
  if (!line) return NextResponse.json({ error: "Không tìm thấy dòng lương" }, { status: 404 });
  if (!canEditPayroll(line.payrollRun.status)) {
    return NextResponse.json({ error: "Kỳ lương đã duyệt/khóa, không thể sửa." }, { status: 409 });
  }

  const body = await req.json();
  const bonus = "bonus" in body ? Number(body.bonus) : line.bonus;
  const penalty = "penalty" in body ? Number(body.penalty) : line.penalty;
  const baseSalaryAmount = "baseSalaryAmount" in body ? Number(body.baseSalaryAmount) : line.baseSalaryAmount;
  const totalAmount = line.teachingAmount + line.assistantAmount + baseSalaryAmount + bonus - penalty;

  const updated = await prisma.payrollLine.update({
    where: { id: params.id },
    data: { bonus, penalty, baseSalaryAmount, totalAmount, notes: "notes" in body ? body.notes || null : line.notes },
  });

  return NextResponse.json({ item: updated });
}
