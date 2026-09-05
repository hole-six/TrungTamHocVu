import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { canEditPayroll } from "@/lib/server/payroll-rules";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canUpdateWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa dòng lương" }, { status: 403 });
  }

  const line = await prisma.payrollLine.findUnique({ where: { id: params.id }, include: { payrollRun: true } });
  if (line && !(await canAccessBranch(line.payrollRun.branchId))) {
    return NextResponse.json({ error: "Khong co quyen truy cap co so" }, { status: 403 });
  }
  if (!line) return NextResponse.json({ error: "Không tìm thấy dòng lương" }, { status: 404 });
  if (!canEditPayroll(line.payrollRun.status)) {
    return NextResponse.json({ error: "Kỳ lương đã duyệt/khóa, không thể sửa." }, { status: 409 });
  }

  const body = await req.json();
  // Các khoản cộng/trừ itemize đúng theo phiếu lương thật (xem ghi chú model
  // PayrollLine trong schema.prisma) — bonus/penalty/baseSalaryAmount giữ đúng field
  // cũ, còn lại đều mới. assistantRatingBonus KHÔNG sửa tay ở đây — nó tự tính lại từ
  // AssistantMonthlyBonus mỗi lần "Tính lại lương" (generatePayrollForRun).
  const numericFields = [
    "otHours", "otAmount", "kpiBonus", "parkingAllowance", "supportAllowance",
    "bonus", "penalty", "socialInsuranceDeduction", "utilityDeduction", "holidayBonus", "otherDeduction", "baseSalaryAmount",
  ] as const;
  const values: Record<string, number> = {};
  for (const field of numericFields) {
    values[field] = field in body ? Number(body[field]) : (line as unknown as Record<string, number>)[field];
  }
  if (!Object.values(values).every((value) => Number.isFinite(value) && value >= 0)) {
    return NextResponse.json({ error: "Cac khoan luong phai la so khong am" }, { status: 400 });
  }

  const totalAmount =
    line.teachingAmount +
    line.assistantAmount +
    values.baseSalaryAmount +
    values.otAmount +
    values.kpiBonus +
    line.assistantRatingBonus +
    values.parkingAllowance +
    values.supportAllowance +
    values.bonus -
    values.penalty -
    values.socialInsuranceDeduction -
    values.utilityDeduction +
    values.holidayBonus -
    values.otherDeduction;
  if (totalAmount < 0) {
    return NextResponse.json({ error: "Tien phat khong duoc lon hon tong thu nhap" }, { status: 400 });
  }

  const updated = await prisma.payrollLine.update({
    where: { id: params.id },
    data: { ...values, totalAmount, notes: "notes" in body ? body.notes || null : line.notes },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canUpdateWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa dòng lương" }, { status: 403 });
  }

  const line = await prisma.payrollLine.findUnique({ where: { id: params.id }, include: { payrollRun: true } });
  if (line && !(await canAccessBranch(line.payrollRun.branchId))) {
    return NextResponse.json({ error: "Khong co quyen truy cap co so" }, { status: 403 });
  }
  if (!line) return NextResponse.json({ error: "Không tìm thấy dòng lương" }, { status: 404 });
  if (!canEditPayroll(line.payrollRun.status)) {
    return NextResponse.json({ error: "Kỳ lương đã duyệt/khóa, không thể xóa dòng." }, { status: 409 });
  }

  await prisma.payrollLine.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
