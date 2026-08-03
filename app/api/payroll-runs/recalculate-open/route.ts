import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { generatePayrollForRun } from "@/lib/server/payroll-generation";

const EDITABLE_STATUSES = ["DRAFT", "CALCULATED", "REVIEWED"] as const;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canUpdateWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Bạn không có quyền tính lại payroll" }, { status: 403 });
  }

  const activeBranchId = await getCurrentBranchId();
  const runs = await prisma.payrollRun.findMany({
    where: {
      ...(activeBranchId ? { branchId: activeBranchId } : {}),
      status: { in: [...EDITABLE_STATUSES] },
    },
    orderBy: [{ periodName: "desc" }],
    select: { id: true, periodName: true },
  });

  let recalculatedRuns = 0;
  const failures: string[] = [];

  for (const run of runs) {
    const result = await generatePayrollForRun(run.id);
    if ("error" in result) {
      failures.push(`${run.periodName}: ${result.error}`);
      continue;
    }
    recalculatedRuns += 1;
  }

  return NextResponse.json({
    recalculatedRuns,
    totalRuns: runs.length,
    failures,
  });
}
