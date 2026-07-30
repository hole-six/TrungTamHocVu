import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PortalHeader from "@/components/portal/PortalHeader";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.guardianId) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-canvas-parchment/30">
      <PortalHeader fullName={session.fullName} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
