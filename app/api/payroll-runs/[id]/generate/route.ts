import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { generatePayrollForRun } from "@/lib/server/payroll-generation";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { prisma } from "@/lib/prisma";
import { canAccessBranch } from "@/lib/branch-filter";

// Tổng hợp lương từ SessionAssignment (giờ dạy/trợ giảng theo buổi, đã snapshot
// hourlyRate lúc phân công) + TimesheetEntry (ngày công chấm theo giờ hành chính)
// trong khoảng ngày của kỳ lương — nguồn Report_Cong_Luong.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canUpdateWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền tính lương" }, { status: 403 });
  }

  const run = await prisma.payrollRun.findUnique({ where: { id: params.id }, select: { branchId: true } });
  if (!run) return NextResponse.json({ error: "Khong tim thay ky luong" }, { status: 404 });
  if (!(await canAccessBranch(run.branchId))) {
    return NextResponse.json({ error: "Khong co quyen truy cap co so cua ky luong" }, { status: 403 });
  }

  const result = await generatePayrollForRun(params.id);
  if ("error" in result) {
    const status = result.error === "Không tìm thấy kỳ lương" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
