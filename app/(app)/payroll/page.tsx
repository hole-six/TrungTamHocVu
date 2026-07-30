import { redirect, notFound } from "next/navigation";
import PayrollWorkspace from "@/components/payroll/PayrollWorkspace";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate, canUpdate, canView } from "@/lib/server/role-matrix";

export default async function PayrollPage() {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;

  if ((role === "TEACHER" || role === "TEACHING_ASSISTANT") && user?.employeeId) {
    redirect(`/payroll/employees/${user.employeeId}`);
  }

  if (!canView("hr", role)) {
    notFound();
  }

  return (
    <PayrollWorkspace
      canManageEmployees={canCreate("hr", role)}
      canManagePayrollRuns={canUpdate("hr", role)}
    />
  );
}
