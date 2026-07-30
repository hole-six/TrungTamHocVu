import { notFound } from "next/navigation";
import CashbookWorkspace from "@/components/cashbook/CashbookWorkspace";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate, canUpdate, canView } from "@/lib/server/role-matrix";

export default async function CashbookPage() {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;

  if (!canView("cashbook", role)) {
    notFound();
  }

  return (
    <CashbookWorkspace
      canManageCashbook={canUpdate("cashbook", role)}
      canCreateCashbook={canCreate("cashbook", role)}
    />
  );
}
