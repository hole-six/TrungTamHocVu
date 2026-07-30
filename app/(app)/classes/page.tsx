import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import CourseManager from "@/components/classes/CourseManager";
import ClassesTable from "@/components/classes/ClassesTable";
import { canCreate } from "@/lib/server/role-matrix";

const PAGE_SIZE = 20;

export default async function ClassesPage({
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

  const branchWhere = user?.branchId ? { branchId: user.branchId } : {};
  const where = {
    ...branchWhere,
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ className: { contains: q } }, { classCode: { contains: q } }] } : {}),
  };

  const [classes, courses, total, grouped, activeEnrollments] = await Promise.all([
    prisma.class.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        course: true,
        _count: {
          select: {
            enrollments: { where: { status: "ACTIVE" } },
            sessions: { where: { status: "COMPLETED" } },
          },
        },
      },
    }),
    prisma.course.findMany({
      where: branchWhere,
      orderBy: { name: "asc" },
    }),
    prisma.class.count({ where }),
    prisma.class.groupBy({
      by: ["status"],
      where: branchWhere,
      _count: { _all: true },
    }),
    prisma.enrollment.count({
      where: {
        status: "ACTIVE",
        ...(user?.branchId ? { class: { branchId: user.branchId } } : {}),
      },
    }),
  ]);

  const classStats = Object.fromEntries(
    grouped.map((row) => [row.status, row._count._all])
  ) as Record<string, number>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Quản lý lớp học</h1>
          <p className="page-subtitle">Danh sách và thông tin chi tiết của {total} lớp học</p>
        </div>
        {canCreate("schedule", userRole) ? (
          <Link href="/classes/new" className="btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Thêm lớp học
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Tổng lớp", value: total, tone: "text-slate-900", bg: "from-slate-50 to-white" },
          { label: "Đang hoạt động", value: classStats.ACTIVE ?? 0, tone: "text-emerald-700", bg: "from-emerald-50 to-white" },
          { label: "Đã kết thúc", value: classStats.COMPLETED ?? 0, tone: "text-blue-700", bg: "from-blue-50 to-white" },
          { label: "HV đang học", value: activeEnrollments, tone: "text-violet-700", bg: "from-violet-50 to-white" },
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

      {canCreate("schedule", userRole) ? <CourseManager courses={courses} /> : null}

      <ClassesTable
        initialData={classes}
        total={total}
        page={page}
        pageSize={pageSize}
        userRole={userRole || "TEACHER"}
        searchQuery={q}
      />
    </div>
  );
}
