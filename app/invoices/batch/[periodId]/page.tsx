import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import BatchInvoiceView from "@/components/tuition/BatchInvoiceView";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { getBatchInvoiceViewData } from "@/lib/server/batch-invoice-view";

export default async function BatchInvoicePage({ params }: { params: { periodId: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const currentUser = await getCurrentUser();
  const role = currentUser ? await getUserRole(currentUser.id) : null;
  const canManageTuition = canUpdate("tuition", role);

  const batchView = await getBatchInvoiceViewData(params.periodId);
  if (!batchView) notFound();

  return (
    <BatchInvoiceView
      periodName={batchView.periodName}
      periodId={batchView.periodId}
      branchId={batchView.branchId}
      paymentProfile={batchView.paymentProfile}
      charges={batchView.charges}
      canManageTuition={canManageTuition}
    />
  );
}
