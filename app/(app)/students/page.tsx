import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";
import StudentsTable from "./StudentsTable";

const PAGE_SIZE = 20;

export default async function StudentsPage({
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
    ...(q
      ? {
          OR: [
            { fullName: { contains: q } },
            { studentCode: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [items, total, grouped] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: {
          select: { enrollments: true },
        },
      },
    }),
    prisma.student.count({ where }),
    prisma.student.groupBy({
      by: ["status"],
      where: user?.branchId ? { branchId: user.branchId } : {},
      _count: { _all: true },
    }),
  ]);

  const stats = Object.fromEntries(
    grouped.map((row) => [row.status, row._count._all])
  ) as Record<string, number>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Quản lý học viên</h1>
          <p className="page-subtitle">Danh sách và thông tin chi tiết của {total} học viên</p>
        </div>
        {canCreate("students", userRole) ? (
          <Link href="/students/new" className="btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Thêm học viên
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Tổng học viên", value: total, tone: "text-slate-900", bg: "from-slate-50 to-white" },
          { label: "Đang học", value: stats.ACTIVE ?? 0, tone: "text-emerald-700", bg: "from-emerald-50 to-white" },
          { label: "Tạm nghỉ", value: stats.PAUSED ?? 0, tone: "text-amber-700", bg: "from-amber-50 to-white" },
          { label: "Đã nghỉ", value: stats.LEFT ?? 0, tone: "text-rose-700", bg: "from-rose-50 to-white" },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-[26px] border border-[#e4ebf8] bg-gradient-to-br ${card.bg} p-5 shadow-[0_20px_55px_-40px_rgba(15,23,42,0.45)]`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">{card.label}</p>
            <p className={`mt-3 text-3xl font-semibold tracking-tight ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <StudentsTable
        initialData={items}
        total={total}
        page={page}
        pageSize={pageSize}
        userRole={userRole || "TEACHER"}
        searchQuery={q}
      />
    </div>
  );
}
