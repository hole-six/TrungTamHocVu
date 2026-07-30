import { notFound } from "next/navigation";
import ReportsWorkspace from "@/components/reports/ReportsWorkspace";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;

  if (!canView("reports", role)) {
    notFound();
  }

  return <ReportsWorkspace canAccessReports />;
}
