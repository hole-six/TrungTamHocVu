import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LeadForm from "@/components/leads/LeadForm";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

export default async function EditLeadPage({ params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser();
  const [lead, classes] = await Promise.all([
    prisma.lead.findUnique({ where: { id: params.id }, include: { guardian: true } }),
    prisma.class.findMany({
      where: { ...(currentUser?.branchId ? { branchId: currentUser.branchId } : {}), status: "ACTIVE" },
      orderBy: [{ className: "asc" }],
      select: { id: true, classCode: true, className: true },
    }),
  ]);
  if (!lead) notFound();

  const role = currentUser ? await getUserRole(currentUser.id) : null;
  if (!canUpdate("leads", role)) notFound();

  return (
    <div className="page-shell page-shell-form">
      <div className="flex items-center gap-4">
        <Link
          href={`/leads/${lead.id}`}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-[#e8edf5] hover:bg-[#f8fafc] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Sửa thông tin lead</h1>
          <p className="page-subtitle">{lead.fullName} · {lead.leadCode}</p>
        </div>
      </div>

      <div className="card">
        <LeadForm
          leadId={lead.id}
          classes={classes}
          initialData={{
            ...lead,
            guardianName: lead.guardian?.fullName ?? "",
          }}
        />
      </div>
    </div>
  );
}
