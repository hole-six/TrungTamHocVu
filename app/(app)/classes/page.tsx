import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import CourseManager from "@/components/classes/CourseManager";
import ClassesTable from "@/components/classes/ClassesTable";
import ClassLink from "@/components/classes/ClassLink";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";
import { canCreate } from "@/lib/server/role-matrix";
import { getVietnamToday } from "@/lib/server/class-rules";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { getEnrollmentLearningSnapshot } from "@/lib/server/enrollment-learning";

const CLASSES_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="classes-new"]',
    title: "Tạo lớp mới — chỉ khi đã rõ lịch chuẩn",
    description:
      "Bấm vào đây khi đã chốt được khóa học, lịch cố định (thứ mấy, giờ nào, phòng nào) và tổng số buổi của lớp. Sau khi tạo, hệ thống dùng đúng lịch chuẩn này để tự sinh buổi học hàng ngày (sweep tự động chạy 2h sáng mỗi ngày) — nếu lịch chuẩn nhập sai hoặc để trống, lớp sẽ không tự sinh được buổi nào và học phí cuối tháng cũng sẽ tính thiếu vì không có buổi COMPLETED nào để đếm.",
    placement: "bottom",
  },
  {
    target: '[data-tour="classes-summary"]',
    title: "4 số cần nhìn mỗi ngày, nhất là số đỏ cuối",
    description:
      "\"Sĩ số đang học\" đếm theo enrollment còn ACTIVE trên toàn hệ thống, không chỉ trang đang xem. \"Buổi trong 7 ngày tới\" giúp ước lượng khối lượng công việc tuần này. \"Sắp kết thúc (30 ngày)\" là các lớp ACTIVE có ngày kết thúc dự kiến rơi trong 30 ngày tới — cần chủ động lên kế hoạch gia hạn hoặc chuyển lớp cho học viên trước khi lớp đóng. Badge đỏ \"Chưa có lịch chuẩn\" là điểm CẦN XỬ LÝ NGAY: đây là những lớp đang ở trạng thái Đang chạy nhưng không có scheduleRule nào đang bật — nghĩa là hệ thống sẽ KHÔNG tự sinh buổi học nào cho lớp đó mỗi ngày, và học phí cuối kỳ của các học viên trong lớp này sẽ tính ra 0 đồng nếu không phát hiện sớm.",
    placement: "bottom",
  },
  {
    target: '[data-dt="search"]',
    title: "Tìm theo tên hoặc mã lớp",
    description: "Gõ tên lớp hoặc mã lớp rồi Enter — lọc chạy ở backend theo đúng nguyên tắc chung của hệ thống, không tải hết danh sách về máy rồi mới lọc.",
    placement: "bottom",
  },
  {
    target: '[data-dt="chips"]',
    title: "Lọc theo trạng thái lớp",
    description:
      "Tất cả / Đang chạy / Đã kết thúc / Đã hủy — con số trên mỗi nút là tổng thật của TOÀN BỘ danh sách đã lọc theo cơ sở, không chỉ trang đang xem. Nên lọc \"Đang chạy\" làm mặc định khi rà soát vận hành hàng ngày, tránh nhìn nhầm số liệu của các lớp đã đóng từ lâu.",
    placement: "bottom",
  },
  {
    target: '[data-dt="table-shell"]',
    title: "Thanh tiến độ và số tiền tạm tính — đọc đúng ý nghĩa",
    description:
      "Cột \"Lịch & tiến độ\" đếm buổi theo trạng thái COMPLETED thật (đã điểm danh xong), không phải buổi đã lên lịch — một lớp có thể có 20 buổi trong lịch nhưng thanh tiến độ chỉ nhích khi giáo viên thực sự điểm danh xong từng buổi. Cột \"Vận hành & học phí\" hiện \"Tạm tính toàn khóa\" = đơn giá × tổng số buổi — đây CHỈ là số ước lượng ban đầu, không phải học phí thật phải thu, vì số thật còn trừ buổi nghỉ, học bổng, điều chỉnh và chỉ được tính chính xác khi sinh học phí ở trang Học phí. Bấm vào tên lớp để mở chi tiết, xử lý buổi học, học viên và nhật ký lớp.",
    placement: "top",
  },
  {
    target: '[data-tour="classes-course-manager"]',
    title: "Khóa học chuẩn — mẫu dùng chung, không phải lớp cụ thể",
    description:
      "Đây là danh mục KHÓA HỌC (mẫu), khác với LỚP HỌC (thực thể đang dạy thật ở bảng phía trên) — một khóa học chuẩn (vd \"Tiếng Anh giao tiếp cơ bản\") có thể được dùng làm gốc cho nhiều lớp khác nhau, mỗi lớp tự có lịch dạy và sĩ số riêng. Đơn giá và số buổi/tuần khai báo ở đây chỉ là GIÁ TRỊ MẶC ĐỊNH gợi ý khi tạo lớp mới từ khóa này — sau khi lớp đã tạo, sửa khóa học ở đây KHÔNG tự động cập nhật ngược lại các lớp đã tồn tại. Phần \"giáo trình bắt buộc\" gắn trực tiếp với Kho giáo trình (tồn kho hiển thị màu đỏ/vàng nếu sắp hết) — dùng để nhắc chuẩn bị đủ sách trước khi khai giảng lớp mới theo khóa này.",
    placement: "top",
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
  searchParams: {
    q?: string;
    status?: string;
    classGroup?: string;
    page?: string;
    pageSize?: string;
    classCode?: string;
    className?: string;
    courseId?: string;
    tuitionFrom?: string;
    tuitionTo?: string;
    endFrom?: string;
    endTo?: string;
  };
}) {
  const user = await getCurrentUser();
  const userRole = user ? await getUserRole(user.id) : null;
  const activeBranchId = await getCurrentBranchId();

  const q = searchParams.q?.trim() ?? "";
  const status = searchParams.status?.trim() ?? "";
  const classGroup = searchParams.classGroup?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = Number(searchParams.pageSize ?? PAGE_SIZE);
  // Lọc theo từng cột (hàng cố định dưới header bảng) — độc lập với ô tìm chung `q`.
  const classCodeFilter = searchParams.classCode?.trim() ?? "";
  const classNameFilter = searchParams.className?.trim() ?? "";
  const courseIdFilter = searchParams.courseId?.trim() ?? "";
  const tuitionFrom = searchParams.tuitionFrom?.trim() ?? "";
  const tuitionTo = searchParams.tuitionTo?.trim() ?? "";
  const endFrom = searchParams.endFrom?.trim() ?? "";
  const endTo = searchParams.endTo?.trim() ?? "";

  const branchWhere = activeBranchId ? { branchId: activeBranchId } : {};
  const where = {
    ...branchWhere,
    ...(status ? { status } : {}),
    ...(classGroup ? { classGroup } : {}),
    ...(classCodeFilter ? { classCode: { contains: classCodeFilter } } : {}),
    ...(classNameFilter ? { className: { contains: classNameFilter } } : {}),
    ...(courseIdFilter ? { courseId: courseIdFilter } : {}),
    ...(tuitionFrom || tuitionTo
      ? { tuitionPerSession: { ...(tuitionFrom ? { gte: Number(tuitionFrom) } : {}), ...(tuitionTo ? { lte: Number(tuitionTo) } : {}) } }
      : {}),
    ...(endFrom || endTo
      ? { expectedEndDate: { ...(endFrom ? { gte: new Date(endFrom) } : {}), ...(endTo ? { lte: new Date(endTo) } : {}) } }
      : {}),
    ...(q ? { OR: [{ className: { contains: q } }, { classCode: { contains: q } }] } : {}),
  };

  const today = getVietnamToday();
  const nextWeekEnd = endOfUpcomingWeek(today);
  const nextMonth = addDays(today, 30);

  const [classes, courses, books, total, grouped, activeEnrollments, upcomingSessions, endingSoon, unscheduledClasses, classGroups] = await Promise.all([
    prisma.class.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        course: { select: { code: true, name: true } },
        nextClass: { select: { id: true, className: true, classCode: true } },
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
    // Get distinct classGroups for filter
    prisma.class.findMany({
      where: {
        ...branchWhere,
        classGroup: { not: null },
      },
      select: { classGroup: true },
      distinct: ["classGroup"],
      orderBy: { classGroup: "asc" },
    }),
  ]);

  const classStats = Object.fromEntries(grouped.map((row) => [row.status, row._count._all])) as Record<string, number>;
  const pageClassIds = classes.map((item) => item.id);
  const pageEnrollments = pageClassIds.length
    ? await prisma.enrollment.findMany({
        where: { classId: { in: pageClassIds }, status: "ACTIVE" },
        include: { class: { include: { course: true, nextClass: true } } },
      })
    : [];
  const learningSnapshots = await Promise.all(
    pageEnrollments.map(async (enrollment) => ({
      classId: enrollment.classId,
      nextClassName: enrollment.class.nextClass?.className ?? null,
      snapshot: await getEnrollmentLearningSnapshot(prisma, enrollment),
    })),
  );
  const transferNeedByClass = new Map<string, { count: number; missingNextCount: number }>();
  for (const item of learningSnapshots) {
    if (item.snapshot.continuationStatus !== "NEED_TRANSFER") continue;
    const current = transferNeedByClass.get(item.classId) ?? { count: 0, missingNextCount: 0 };
    current.count++;
    if (!item.nextClassName) current.missingNextCount++;
    transferNeedByClass.set(item.classId, current);
  }
  const pipelineRows = classes
    .filter((item) => item.status === "ACTIVE")
    .map((item) => ({
      id: item.id,
      classCode: item.classCode,
      className: item.className,
      classGroup: item.classGroup,
      nextClassName: item.nextClass?.className ?? null,
      activeCount: item._count.enrollments,
      transferNeed: transferNeedByClass.get(item.id)?.count ?? 0,
      missingNextCount: transferNeedByClass.get(item.id)?.missingNextCount ?? 0,
    }))
    .filter((item) => item.nextClassName || item.transferNeed > 0 || item.activeCount > 0)
    .slice(0, 8);
  const statusPills = [
    { key: "", label: "Tất cả", count: grouped.reduce((sum, row) => sum + row._count._all, 0) },
    { key: "ACTIVE", label: "Đang chạy", count: classStats.ACTIVE ?? 0 },
    { key: "COMPLETED", label: "Đã kết thúc", count: classStats.COMPLETED ?? 0 },
    { key: "CANCELLED", label: "Đã hủy", count: classStats.CANCELLED ?? 0 },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-[#0f1729]">Quản lý lớp học</h1>
          <p className="mt-1 text-xs sm:text-sm text-[#64748b]">Theo dõi lịch, sĩ số, tiến độ và học phí từng lớp</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <SpotlightTour steps={CLASSES_TOUR_STEPS} />
          {canCreate("schedule", userRole) ? (
            <Link href="/classes/new" className="btn-primary text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5" data-tour="classes-new">
              <span className="hidden sm:inline">+ Thêm lớp học</span>
              <span className="sm:hidden">+ Lớp</span>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-3" data-tour="classes-summary">
        <span className="rounded-full border border-[#dbe7ff] bg-white px-3 py-2 text-xs font-semibold text-ink">Sĩ số đang học {activeEnrollments}</span>
        <span className="rounded-full border border-[#dbe7ff] bg-white px-3 py-2 text-xs font-semibold text-sky-700">Buổi trong 7 ngày tới {upcomingSessions}</span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Sắp kết thúc (30 ngày) {endingSoon}</span>
        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Chưa có lịch chuẩn {unscheduledClasses}</span>
      </div>

      <section className="rounded-2xl border border-[#dbe7ff] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2563eb]">Pipeline lớp học</p>
              <h2 className="mt-1 text-lg font-black text-[#0f1729]">Ngăn xếp chuyển tiếp</h2>
            </div>
            <p className="text-sm text-[#64748b]">Mỗi lớp nên có lớp tiếp theo để học viên vào giữa/cuối khóa không bị rơi hành trình.</p>
          </div>
          
          {/* Class Group Pills */}
          {classGroups.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <a
                href={`/classes?${new URLSearchParams({ ...(q && { q }), ...(status && { status }) }).toString()}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  !classGroup
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : "border-[#dbe7ff] bg-white text-[#64748b] hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                }`}
              >
                Tất cả ngăn sếp
              </a>
              {classGroups.map((group) => (
                <a
                  key={group.classGroup}
                  href={`/classes?${new URLSearchParams({ ...(q && { q }), ...(status && { status }), classGroup: group.classGroup! }).toString()}`}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    classGroup === group.classGroup
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-[#dbe7ff] bg-white text-[#64748b] hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  }`}
                >
                  Ngăn {group.classGroup}
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {pipelineRows.map((row) => (
            <div key={row.id} className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ClassLink classId={row.id} className="font-bold text-[#0f1729] hover:text-[#2563eb]">
                    {row.className}
                  </ClassLink>
                  {row.classGroup && (
                    <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
                      {row.classGroup}
                    </span>
                  )}
                </div>
                {row.transferNeed > 0 ? (
                  <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                    {row.transferNeed} cần chuyển
                  </span>
                ) : (
                  <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">Ổn</span>
                )}
              </div>
              <p className="mt-2 text-sm font-semibold text-[#64748b]">
                {row.classCode} → {row.nextClassName ?? "Chưa cấu hình lớp tiếp theo"}
              </p>
              <p className="mt-1 text-xs text-[#64748b]">
                Sĩ số {row.activeCount}
                {row.missingNextCount > 0 ? ` · ${row.missingNextCount} học viên cần chuyển nhưng lớp chưa có nextClass` : ""}
              </p>
            </div>
          ))}
          {pipelineRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#dbe7ff] bg-[#f8faff] p-5 text-sm text-[#64748b]">
              Chưa có lớp ACTIVE nào trong trang hiện tại để hiển thị pipeline.
            </div>
          ) : null}
        </div>
      </section>

      <ClassesTable
        initialData={classes}
        total={total}
        page={page}
        pageSize={pageSize}
        userRole={userRole || "TEACHER"}
        searchQuery={q}
        statusFilter={status}
        statusOptions={statusPills}
        courseOptions={courses.map((course) => ({ label: course.name, value: course.id }))}
      />

      {canCreate("schedule", userRole) ? <CourseManager courses={courses} books={books} /> : null}
    </div>
  );
}
