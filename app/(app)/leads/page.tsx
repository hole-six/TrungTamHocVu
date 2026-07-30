import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/server/lead-rules";
import { canCreate } from "@/lib/server/role-matrix";
import LeadsTable from "@/components/leads/LeadsTable";

const PAGE_SIZE = 20;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string; pageSize?: string };
}) {
  const user = await getCurrentUser();
  const userRole = user ? await getUserRole(user.id) : null;
  
  const q = searchParams.q?.trim() ?? "";
  const status = searchParams.status ?? "";
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = Number(searchParams.pageSize ?? PAGE_SIZE);

  const where = {
    ...(user?.branchId ? { branchId: user.branchId } : {}),
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ fullName: { contains: q } }, { leadCode: { contains: q } }, { phone: { contains: q } }] } : {}),
  };

  const [items, total, byStatus] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
    prisma.lead.groupBy({
      by: ["status"],
      where: user?.branchId ? { branchId: user.branchId } : {},
      _count: { _all: true },
    }),
  ]);

  const pipeline = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<string, number>;
  for (const row of byStatus) pipeline[row.status] = row._count._all;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Quản lý CRM tuyển sinh</h1>
          <p className="page-subtitle">
            Theo dõi và chuyển đổi {total} lead thành học viên
          </p>
        </div>
        {canCreate("leads", userRole) && (
          <Link href="/leads/new" className="btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Thêm lead
          </Link>
        )}
      </div>

      {/* Pipeline stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {LEAD_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/leads?status=${s}`}
            className={`card-sm text-center transition hover:shadow-md hover:border-primary ${
              status === s ? "border-primary ring-2 ring-primary/20 bg-primary/5" : ""
            }`}
          >
            <p className="font-display text-2xl font-semibold tracking-tight text-primary">{pipeline[s]}</p>
            <p className="mt-0.5 text-[11px] text-ink-muted48 leading-tight">{LEAD_STATUS_LABEL[s]}</p>
          </Link>
        ))}
      </div>

      {/* DataTable */}
      <LeadsTable
        initialData={items}
        total={total}
        page={page}
        pageSize={pageSize}
        userRole={userRole || "RECEPTIONIST"}
      />
    </div>
  );
}
