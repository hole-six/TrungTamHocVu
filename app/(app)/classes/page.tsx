import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import CourseManager from "@/components/classes/CourseManager";
import ClassesTable from "@/components/classes/ClassesTable";
import PageGuide from "@/components/ui/PageGuide";
import { canCreate } from "@/lib/server/role-matrix";
import { getVietnamToday } from "@/lib/server/class-rules";
import { getCurrentBranchId } from "@/lib/branch-filter";

const CLASSES_PAGE_GUIDE_SECTIONS = [
  {
    title: "Màn này để làm gì?",
    items: [
      "Đây là màn tổng vận hành lớp học: xem danh sách lớp, mở lớp mới và quản lý khóa chuẩn.",
      "Từ đây bạn đi vào từng lớp để xử lý buổi học, học viên, lịch chuẩn và nhật ký lớp.",
      "Nếu người mới chưa quen, hãy bắt đầu bằng xem trạng thái lớp rồi mới đi sâu vào chi tiết từng lớp.",
    ],
    tone: "info" as const,
  },
  {
    title: "Thứ tự thao tác nên đi",
    items: [
      "Bước 1: lọc đúng lớp đang chạy hoặc lớp cần xử lý.",
      "Bước 2: mở chi tiết lớp để xử lý học viên, buổi học hoặc lịch chuẩn.",
      "Bước 3: chỉ tạo lớp mới khi đã rõ khóa học, lịch chuẩn, học phí và số buổi.",
      "Bước 4: quản lý khóa chuẩn ở cuối màn để giữ dữ liệu đầu vào của lớp luôn gọn.",
    ],
    tone: "success" as const,
  },
  {
    title: "Điểm cần tránh",
    items: [
      "Không mở lớp mới khi lịch chuẩn còn mơ hồ.",
      "Không nhầm giữa chỉnh lớp và xử lý từng buổi học riêng lẻ.",
      "Không bỏ qua trạng thái lớp vì nó quyết định ngữ cảnh vận hành phía sau.",
    ],
    tone: "warning" as const,
  },
];

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
  const activeBranchId = await getCurrentBranchId();

  const q = searchParams.q?.trim() ?? "";
  const status = searchParams.status?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = Number(searchParams.pageSize ?? PAGE_SIZE);

  const branchWhere = activeBranchId ? { branchId: activeBranchId } : {};
  const where = {
    ...branchWhere,
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ className: { contains: q } }, { classCode: { contains: q } }] } : {}),
  };

  const today = getVietnamToday();
  const nextWeekEnd = endOfUpcomingWeek(today);
  const nextMonth = addDays(today, 30);

  const [classes, courses, books, total, grouped, activeEnrollments, upcomingSessions, endingSoon, unscheduledClasses] = await Promise.all([
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
      include: {
        bookRequirements: {
          include: { book: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    }),
    prisma.book.findMany({
      where: branchWhere,
      orderBy: [{ category: "asc" }, { name: "asc" }],
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
        ...(activeBranchId ? { class: { branchId: activeBranchId } } : {}),
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
  const statusPills = [
    { key: "", label: "Tất cả", count: grouped.reduce((sum, row) => sum + row._count._all, 0) },
    { key: "ACTIVE", label: "Đang chạy", count: classStats.ACTIVE ?? 0 },
    { key: "COMPLETED", label: "Đã kết thúc", count: classStats.COMPLETED ?? 0 },
    { key: "CANCELLED", label: "Đã hủy", count: classStats.CANCELLED ?? 0 },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageGuide
        title="Guide vận hành lớp học"
        summary="Đây là màn trung tâm của khu lớp học. Người mới chỉ cần hiểu rõ: lớp nào đang chạy, khi nào tạo lớp mới, và khi nào phải đi vào chi tiết lớp để xử lý sâu hơn."
        sections={CLASSES_PAGE_GUIDE_SECTIONS}
        buttonLabel="Guide lớp học"
      />
      <div className="flex flex-col gap-3 sm:gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-[#0f1729]">Quản lý lớp học</h1>
          <p className="mt-1 text-xs sm:text-sm text-[#64748b]">Theo dõi lịch, sĩ số, tiến độ và học phí từng lớp</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {canCreate("schedule", userRole) ? (
            <Link href="/classes/new" className="btn-primary text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5">
              <span className="hidden sm:inline">+ Thêm lớp học</span>
              <span className="sm:hidden">+ Lớp</span>
            </Link>
          ) : null}
        </div>
      </div>

      <ClassesTable
        initialData={classes}
        total={total}
        page={page}
        pageSize={pageSize}
        userRole={userRole || "TEACHER"}
        searchQuery={q}
        statusFilter={status}
        statusOptions={statusPills}
      />

      {canCreate("schedule", userRole) ? <CourseManager courses={courses} books={books} /> : null}
    </div>
  );
}
