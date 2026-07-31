import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import CourseManager from "@/components/classes/CourseManager";
import ClassesTable from "@/components/classes/ClassesTable";
import { canCreate } from "@/lib/server/role-matrix";
import { getVietnamToday } from "@/lib/server/class-rules";

const PAGE_SIZE = 20;

function endOfUpcomingWeek(start: Date) {
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string; pageSize?: string };
}) {
  const user = await getCurrentUser();
  const userRole = user ? await getUserRole(user.id) : null;

  const q = searchParams.q?.trim() ?? "";
  const status = searchParams.status?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = Number(searchParams.pageSize ?? PAGE_SIZE);

  const branchWhere = user?.branchId ? { branchId: user.branchId } : {};
  const where = {
    ...branchWhere,
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ className: { contains: q } }, { classCode: { contains: q } }] } : {}),
  };

  const today = getVietnamToday();
  const nextWeekEnd = endOfUpcomingWeek(today);
  const nextMonth = addDays(today, 30);

  const [classes, courses, total, grouped, activeEnrollments, upcomingSessions, endingSoon, unscheduledClasses] = await Promise.all([
    prisma.class.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        course: { select: { code: true, name: true } },
        scheduleRules: {
          where: { isActive: true },
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        },
        sessions: {
          where: {
            sessionDate: { gte: today },
            status: { not: "CANCELLED" },
          },
          orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
          take: 1,
        },
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
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
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
    prisma.classSession.count({
      where: {
        sessionDate: { gte: today, lte: nextWeekEnd },
        status: { not: "CANCELLED" },
        class: branchWhere,
      },
    }),
    prisma.class.count({
      where: {
        ...branchWhere,
        status: "ACTIVE",
        expectedEndDate: { gte: today, lte: nextMonth },
      },
    }),
    prisma.class.count({
      where: {
        ...branchWhere,
        status: "ACTIVE",
        scheduleRules: { none: { isActive: true } },
      },
    }),
  ]);

  const classStats = Object.fromEntries(grouped.map((row) => [row.status, row._count._all])) as Record<string, number>;
  const activeCourses = courses.filter((course) => course.isActive).length;
  const statusPills = [
    { key: "", label: "Tất cả lớp", count: grouped.reduce((sum, row) => sum + row._count._all, 0) },
    { key: "ACTIVE", label: "Đang chạy", count: classStats.ACTIVE ?? 0 },
    { key: "COMPLETED", label: "Đã kết thúc", count: classStats.COMPLETED ?? 0 },
    { key: "CANCELLED", label: "Đã hủy", count: classStats.CANCELLED ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f8fcff_0%,#eef7ff_42%,#ffffff_100%)] p-6 shadow-[0_28px_80px_-48px_rgba(14,116,144,0.45)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <span className="inline-flex w-fit rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              Vận hành lớp học
            </span>
            <div>
              <h1 className="page-title">Lớp học nhìn theo ngữ cảnh vận hành thực tế</h1>
              <p className="page-subtitle max-w-3xl">
                Một nơi để biết ngay lớp nào đang chạy, lịch cố định ra sao, buổi kế tiếp là khi nào, học phí mỗi buổi bao nhiêu và lớp nào đang cần chú ý.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Đang lọc</p>
              <p className="mt-2 text-lg font-semibold text-ink">{status ? statusPills.find((item) => item.key === status)?.label ?? status : "Toàn bộ lớp"}</p>
              <p className="mt-1 text-xs text-ink-muted48">{q ? `Từ khóa: ${q}` : "Không lọc theo từ khóa"}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">7 ngày tới</p>
              <p className="mt-2 text-lg font-semibold text-ink">{upcomingSessions} buổi học</p>
              <p className="mt-1 text-xs text-ink-muted48">Để giáo vụ rà lịch và phân công nhanh</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Khóa chuẩn</p>
              <p className="mt-2 text-lg font-semibold text-ink">{activeCourses}/{courses.length} đang áp dụng</p>
              <p className="mt-1 text-xs text-ink-muted48">Dùng làm mẫu khi tạo lớp mới</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {statusPills.map((pill) => {
            const href = `/classes${pill.key || q ? `?${new URLSearchParams({
              ...(pill.key ? { status: pill.key } : {}),
              ...(q ? { q } : {}),
            }).toString()}` : ""}`;
            const active = status === pill.key;
            return (
              <Link
                key={pill.key || "all"}
                href={href}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active ? "bg-primary text-white shadow-sm" : "bg-white text-ink-muted80 hover:bg-[#eef5ff]"
                }`}
              >
                {pill.label} · {pill.count}
              </Link>
            );
          })}

          {canCreate("schedule", userRole) ? (
            <Link href="/classes/new" className="btn-primary ml-auto">
              + Thêm lớp học
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Tổng số lớp", value: total, tone: "text-slate-900", bg: "from-slate-50 to-white" },
          { label: "Lớp đang hoạt động", value: classStats.ACTIVE ?? 0, tone: "text-emerald-700", bg: "from-emerald-50 to-white" },
          { label: "Học viên đang học", value: activeEnrollments, tone: "text-sky-700", bg: "from-sky-50 to-white" },
          { label: "Sắp kết thúc 30 ngày", value: endingSoon, tone: "text-amber-700", bg: "from-amber-50 to-white" },
          { label: "Chưa có lịch chuẩn", value: unscheduledClasses, tone: "text-rose-700", bg: "from-rose-50 to-white" },
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

      <div className="rounded-[28px] border border-[#e4ebf8] bg-white p-4 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)]">
        <ClassesTable
          initialData={classes}
          total={total}
          page={page}
          pageSize={pageSize}
          userRole={userRole || "TEACHER"}
          searchQuery={q}
          statusFilter={status}
        />
      </div>

      {canCreate("schedule", userRole) ? <CourseManager courses={courses} /> : null}
    </div>
  );
}
