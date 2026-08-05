import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate, canUpdate, canView } from "@/lib/server/role-matrix";
import { canEditPayroll } from "@/lib/server/payroll-rules";
import { evaluatePayrollRunChecklist } from "@/lib/server/payroll-checklist";
import { buildPayrollEmployeeRows } from "@/lib/server/payroll-row-builder";
import { getCurrentBranchId } from "@/lib/branch-filter";
import PayrollWorkspace from "@/components/payroll/PayrollWorkspace";

function currentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const VALID_FILTERS = new Set(["all", "missing-bank", "ready-bank", "missing-rate"]);

export default async function PayrollPage({
  searchParams,
}: {
  searchParams?: { period?: string; employeeId?: string; filter?: string };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;

  if ((role === "TEACHER" || role === "TEACHING_ASSISTANT") && user?.employeeId) {
    redirect(`/payroll/employees/${user.employeeId}`);
  }

  if (!canView("hr", role)) notFound();

  const canManageEmployees = canCreate("hr", role);
  const canManagePayrollRuns = canUpdate("hr", role);
  const canCreateTimesheet = canCreate("timesheet", role);

  const period = searchParams?.period && /^\d{4}-\d{2}$/.test(searchParams.period) ? searchParams.period : currentMonthString();
  const filter = searchParams?.filter && VALID_FILTERS.has(searchParams.filter) ? searchParams.filter : "all";
  const activeBranchId = await getCurrentBranchId();

  const run = await prisma.payrollRun.findFirst({
    where: { periodName: period, ...(activeBranchId ? { branchId: activeBranchId } : {}) },
  });

  const [rows, checklist, branches] = await Promise.all([
    buildPayrollEmployeeRows({
      branchId: activeBranchId,
      period,
      runId: run?.id ?? null,
      forceIncludeEmployeeId: searchParams?.employeeId ?? null,
    }),
    run ? evaluatePayrollRunChecklist(run.id) : Promise.resolve(null),
    canManagePayrollRuns ? prisma.branch.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  const eligibleEmployees =
    run && canEditPayroll(run.status)
      ? await prisma.employee.findMany({
          where: {
            branchId: run.branchId,
            resignDate: null,
            id: { notIn: rows.filter((row) => row.lineId).map((row) => row.id) },
          },
          select: { id: true, fullName: true },
          orderBy: { fullName: "asc" },
        })
      : [];

  const initialEmployeeId =
    searchParams?.employeeId && rows.some((row) => row.id === searchParams.employeeId) ? searchParams.employeeId : null;

  return (
    <PayrollWorkspace
      rows={rows}
      period={period}
      run={run ? { id: run.id, periodName: run.periodName, status: run.status, lineCount: rows.filter((row) => row.lineId).length } : null}
      branches={branches}
      eligibleEmployees={eligibleEmployees}
      checklist={checklist ? { items: checklist.items, isReady: checklist.isReady } : null}
      initialEmployeeId={initialEmployeeId}
      initialFilter={filter as "all" | "missing-bank" | "ready-bank" | "missing-rate"}
      permissions={{ canManageEmployees, canManagePayrollRuns, canCreateTimesheet }}
    />
  );
}
