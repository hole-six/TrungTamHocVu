import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canViewFullWithOverride } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import { buildPayrollWorkbook } from "@/lib/server/payroll-export-sheet";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const access = await getUserRoleAndOverride(user.id, "hr");
  if (!canViewFullWithOverride("hr", access.role, access.override)) {
    return NextResponse.json({ error: "Bạn không có quyền xuất payroll." }, { status: 403 });
  }

  const run = await prisma.payrollRun.findUnique({
    where: { id: params.id },
    include: {
      lines: {
        include: { employee: true },
        orderBy: { employee: { fullName: "asc" } },
      },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Không tìm thấy kỳ lương." }, { status: 404 });
  }

  if (!(await canAccessBranch(run.branchId))) {
    return NextResponse.json({ error: "Bạn không được truy cập cơ sở này." }, { status: 403 });
  }

  const workbook = await buildPayrollWorkbook({
    periodName: run.periodName,
    status: run.status,
    lines: run.lines.map((line) => ({
      employeeCode: line.employee.employeeCode,
      fullName: line.employee.fullName,
      position: line.employee.position ?? "",
      bankName: line.employee.bankName ?? "",
      bankAccountNumber: line.employee.bankAccountNumber ?? "",
      bankAccountHolder: line.employee.bankAccountHolder ?? "",
      teachingHours: line.teachingHours,
      teachingAmount: line.teachingAmount,
      assistantHours: line.assistantHours,
      assistantAmount: line.assistantAmount,
      staffDays: line.staffDays,
      baseSalaryAmount: line.baseSalaryAmount,
      bonus: line.bonus,
      penalty: line.penalty,
      totalAmount: line.totalAmount,
    })),
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `bang-luong-${run.periodName}.xlsx`;

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "no-store",
    },
  });
}
