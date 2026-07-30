import { notFound } from "next/navigation";
import TuitionWorkspace from "@/components/tuition/TuitionWorkspace";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView, canUpdate } from "@/lib/server/role-matrix";

export default async function TuitionPage() {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;

  if (!canView("tuition", role)) {
    notFound();
  }

  return <TuitionWorkspace canManageTuition={canUpdate("tuition", role)} />;
}
