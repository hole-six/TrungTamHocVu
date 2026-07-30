import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import RemediationWorkbench from "@/components/admin/RemediationWorkbench";
import { getRemediationWorkspace } from "@/lib/workbook-remediation";

export default async function AdminImportRemediationPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const workspace = await getRemediationWorkspace();

  return (
    <RemediationWorkbench
      tables={workspace.tables}
      initialSelectedTable={workspace.selectedTable}
    />
  );
}
