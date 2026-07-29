import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import GuardiansTable from "@/components/guardians/GuardiansTable";

const PAGE_SIZE = 20;

export default async function GuardiansPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; pageSize?: string };
}) {
  const user = await getCurrentUser();
  const userRole = user ? await getUserRole(user.id) : null;
  
  const q = searchParams.q?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = Number(searchParams.pageSize ?? PAGE_SIZE);

  const where = q
    ? {
        OR: [
          { fullName: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
        ],
      }
    : {};

  const [guardians, total] = await Promise.all([
    prisma.guardian.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: {
          select: { leads: true, students: true },
        },
      },
    }),
    prisma.guardian.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Quản lý phụ huynh</h1>
          <p className="page-subtitle">
            Danh sách và thông tin chi tiết của {total} phụ huynh
          </p>
        </div>
        {userRole !== "TEACHER" && (
          <Link href="/guardians/new" className="btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Thêm phụ huynh
          </Link>
        )}
      </div>

      {/* DataTable */}
      <GuardiansTable
        initialData={guardians}
        total={total}
        page={page}
        pageSize={pageSize}
        userRole={userRole || "TEACHER"}
      />
    </div>
  );
}
