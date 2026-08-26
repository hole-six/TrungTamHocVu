import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { getCurrentBranchId } from "@/lib/branch-filter";
import CalendarFilters from "@/components/calendar/CalendarFilters";
import SessionCard from "@/components/calendar/SessionCard";
import CalendarListView from "@/components/calendar/CalendarListView";
import PageGuide from "@/components/ui/PageGuide";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";

const CALENDAR_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="calendar-filters"]',
    title: "Chọn tuần trước, lọc sau",
    description: "Bộ lọc lớp/phòng/giáo viên chỉ áp dụng trong tuần đang chọn — đổi tuần sẽ giữ nguyên bộ lọc đang dùng.",
    placement: "bottom",
  },
  {
    target: '[data-tour="calendar-week"]',
    title: "Mỗi thẻ buổi học mở thẳng vào trang buổi đó",
    description: "Nhãn \"Thiếu phân công\" ở đầu mỗi ngày cảnh báo buổi chưa gán giáo viên/trợ giảng — bấm vào thẻ buổi để phân công ngay.",
    placement: "top",
  },
];

const ICON_CALENDAR = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18" />
    <path d="M8 14h.01" />
    <path d="M12 14h.01" />
    <path d="M16 14h.01" />
    <path d="M8 18h.01" />
    <path d="M12 18h.01" />
  </svg>
);

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const TODAY_YMD = new Date().toISOString().slice(0, 10);

function startOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function formatCompactDate(d: Date) {
  return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function timePresetWhere(timePreset: string) {
  if (timePreset === "morning") return { startTime: { gte: "00:00", lt: "12:00" } };
  if (timePreset === "afternoon") return { startTime: { gte: "12:00", lt: "17:30" } };
  if (timePreset === "evening") return { startTime: { gte: "17:30", lte: "23:59" } };
  return {};
}

const CALENDAR_PAGE_GUIDE_SECTIONS = [
  {
    title: "Trang này để làm gì",
    items: [
      "Xem toàn bộ lịch học trong tuần theo từng ngày.",
      "Kiểm tra nhanh giờ học, phòng, giáo viên, trợ giảng và trạng thái buổi.",
      "Mở thẳng vào buổi học khi cần điểm danh, đổi lịch hoặc viết nhật ký.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách dùng nhanh",
    items: [
      "Chọn đúng tuần trước, rồi mới tìm theo lớp, phòng hoặc giáo viên.",
      "Dùng lọc sáng, chiều, tối khi một ngày có quá nhiều buổi.",
      "Bấm trực tiếp vào thẻ buổi học để mở đúng buổi cần xử lý.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý",
    items: [
      "Lịch tuần chỉ hiện các buổi đã được tạo.",
      "Buổi đổi lịch hoặc hủy sẽ có badge riêng, cần nhìn đúng trước khi thao tác.",
      "Nếu lọc theo giáo viên mà thiếu buổi, kiểm tra lại phân công trong session đó.",
    ],
    tone: "warning" as const,
  },
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { week?: string; q?: string; timePreset?: string; view?: string };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  const activeBranchId = await getCurrentBranchId();

  const q = searchParams.q?.trim() ?? "";
  const timePreset = searchParams.timePreset?.trim() ?? "all";
  const view = searchParams.view === "list" ? "list" : "grid";
  const anchor = searchParams.week ? new Date(searchParams.week) : new Date();
  const weekStart = startOfWeek(anchor);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const teacherScoped = role === "TEACHER" || role === "TEACHING_ASSISTANT";

  const sessions = await prisma.classSession.findMany({
    where: {
      sessionDate: { gte: weekStart, lte: weekEnd },
      ...timePresetWhere(timePreset),
      class: {
        ...(activeBranchId ? { branchId: activeBranchId } : {}),
        ...(q
          ? {
              OR: [{ className: { contains: q } }, { classCode: { contains: q } }, { course: { name: { contains: q } } }],
            }
          : {}),
      },
      ...(teacherScoped && user
        ? {
            assignments: {
              some: {
                employee: {
                  user: { id: user.id },
                },
              },
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { room: { contains: q } },
              {
                assignments: {
                  some: {
                    employee: {
                      OR: [{ fullName: { contains: q } }, { shortName: { contains: q } }],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      class: {
        include: {
          course: true,
          _count: {
            select: {
              enrollments: {
                where: { status: "ACTIVE" },
              },
            },
          },
        },
      },
      assignments: {
        include: { employee: true },
        orderBy: [{ role: "asc" }, { employee: { fullName: "asc" } }],
      },
    },
    orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });

  const sessionsByDay = days.map((date) => {
    const iso = date.toISOString().slice(0, 10);
    const daySessions = sessions.filter((session) => session.sessionDate.toISOString().slice(0, 10) === iso);
    const completed = daySessions.filter((session) => session.status === "COMPLETED").length;
    const missingAssignments = daySessions.filter((session) => session.assignments.length === 0).length;
    return {
      date,
      sessions: daySessions,
      completed,
      missingAssignments,
      totalStudents: daySessions.reduce((sum, session) => sum + (session.class._count?.enrollments ?? 0), 0),
    };
  });

  const focusDayKey = anchor.toISOString().slice(0, 10);
  const totalSessions = sessions.length;
  const totalCompleted = sessions.filter((session) => session.status === "COMPLETED").length;
  const totalMissingAssignments = sessions.filter((session) => session.assignments.length === 0).length;
  const totalStudentTouches = sessionsByDay.reduce((sum, day) => sum + day.totalStudents, 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageGuide
        title="Hướng dẫn lịch tổng"
        summary="Cách đọc lịch tuần, lọc đúng buổi học và mở vào chi tiết session."
        sections={CALENDAR_PAGE_GUIDE_SECTIONS}
        buttonLabel="Guide"
      />
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-xl sm:rounded-2xl bg-sky-50 text-sky-600">
            {ICON_CALENDAR}
          </div>
          <div>
            <h1 className="page-title text-xl sm:text-2xl md:text-3xl">Lịch tổng lớp học</h1>
            <p className="page-subtitle text-xs sm:text-sm">
              <span className="hidden sm:inline">Xem nhanh lịch dạy trong tuần, trạng thái buổi học và phân công nhân sự.</span>
              <span className="sm:hidden">Lịch dạy trong tuần</span>
            </p>
          </div>
        </div>
        <SpotlightTour steps={CALENDAR_TOUR_STEPS} />
      </div>

      <div data-tour="calendar-filters">
        <CalendarFilters
          key={`${anchor.toISOString().slice(0, 10)}|${q}|${timePreset}|${view}`}
          initialWeek={anchor.toISOString().slice(0, 10)}
          initialQuery={q}
          initialTimePreset={timePreset}
          initialView={view}
        />
      </div>

      <div data-tour="calendar-week">
      {view === "list" ? (
        <CalendarListView rows={sessions} />
      ) : (
      <>
      <div className="hidden overflow-x-auto pb-2 md:block [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="grid min-w-[1460px] grid-cols-7 gap-3">
          {sessionsByDay.map((day) => {
            const iso = day.date.toISOString().slice(0, 10);
            const isToday = iso === TODAY_YMD;
            const isFocus = iso === focusDayKey;

            return (
              <article
                key={iso}
                className={`min-h-[735px] rounded-[17px] border p-3 shadow-[0_6px_18px_rgba(45,73,112,0.035)] ${
                  isToday
                    ? "border-[#6dc0ff] bg-white shadow-[0_8px_24px_rgba(19,137,232,0.08)]"
                    : isFocus
                      ? "border-[#dce7f3] bg-[#fafdff]"
                      : "border-[#dce7f3] bg-[rgba(255,255,255,0.86)]"
                }`}
              >
                <div className="relative mb-3">
                  <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700/80">{WEEKDAY_SHORT[day.date.getUTCDay()]}</p>
                  <p className="mt-1 font-display text-2xl font-black tracking-tight text-ink">{formatCompactDate(day.date)}</p>
                  <p className="mt-1 text-xs font-semibold text-ink-muted48">
                    {day.sessions.length} buổi · {day.totalStudents} lượt học viên
                  </p>
                </div>
                  {isToday ? <span className="absolute right-0 top-0 rounded-full bg-sky-600 px-2 py-0.5 text-[11px] font-bold text-white">Hôm nay</span> : null}
                  {isFocus && !isToday ? <span className="absolute right-0 top-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">Đang xem</span> : null}
                </div>

                <div className="mb-3 grid grid-cols-2 gap-[9px]">
                  <div className="rounded-[11px] bg-emerald-50 px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700/70">Đã xong</p>
                    <p className="mt-2 text-2xl font-black text-emerald-700">{day.completed}</p>
                  </div>
                  <div className="rounded-[11px] bg-amber-50 px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700/70">Thiếu phân công</p>
                    <p className="mt-2 text-2xl font-black text-amber-700">{day.missingAssignments}</p>
                  </div>
                </div>

                <div className="space-y-[10px]">
                  {day.sessions.map((session) => (
                    <SessionCard key={session.id} session={session} variant="grid" />
                  ))}

                  {day.sessions.length === 0 ? (
                    <div className="grid min-h-[126px] place-items-center rounded-[14px] border border-dashed border-[#cbdcef] bg-[#fcfdff] px-4 py-6 text-center text-sm leading-[1.55] text-[#68788f]">
                      <div>
                        <div className="mb-2 text-lg text-[#71839b]">○</div>
                        Không có buổi học
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Mobile: Single-day vertical view with day selector */}
      <div className="md:hidden space-y-4">
        {/* Day selector */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {sessionsByDay.map((day) => {
            const iso = day.date.toISOString().slice(0, 10);
            const isToday = iso === TODAY_YMD;
            const isFocus = iso === focusDayKey;
            
            return (
              <a
                key={iso}
                href={`/calendar?week=${iso}&q=${encodeURIComponent(q)}&timePreset=${timePreset}`}
                className={`shrink-0 rounded-2xl border px-4 py-3 min-w-[80px] text-center transition ${
                  isFocus
                    ? "border-primary bg-primary text-white shadow-md"
                    : isToday
                      ? "border-sky-300 bg-sky-50 text-sky-700"
                      : "border-hairline bg-white text-ink hover:border-primary/30"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider">{WEEKDAY_SHORT[day.date.getUTCDay()]}</p>
                <p className="mt-1 text-lg font-bold">{day.date.getUTCDate()}</p>
                <p className="mt-1 text-[10px] opacity-75">{day.sessions.length} buổi</p>
              </a>
            );
          })}
        </div>

        {/* Focused day content */}
        {sessionsByDay.filter(day => day.date.toISOString().slice(0, 10) === focusDayKey).map((day) => {
          const iso = day.date.toISOString().slice(0, 10);
          const isToday = iso === TODAY_YMD;

          return (
            <div key={iso} className="space-y-4">
              {/* Day header */}
              <div className={`rounded-2xl border p-4 ${isToday ? "border-sky-200 bg-sky-50" : "border-hairline bg-white"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted48">
                      {WEEKDAY_SHORT[day.date.getUTCDay()]} · {formatCompactDate(day.date)}
                    </p>
                    <p className="mt-1 text-lg font-bold text-ink">{day.sessions.length} buổi học</p>
                  </div>
                  {isToday && <span className="rounded-full bg-sky-600 px-3 py-1 text-xs font-bold text-white">Hôm nay</span>}
                </div>
                
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted48">Đã xong</p>
                    <p className="mt-1 text-base font-bold text-emerald-600">{day.completed}</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted48">Thiếu phân công</p>
                    <p className="mt-1 text-base font-bold text-amber-600">{day.missingAssignments}</p>
                  </div>
                </div>
              </div>

              {/* Sessions list */}
              <div className="space-y-3">
                {day.sessions.map((session) => (
                  <SessionCard key={session.id} session={session} variant="list" />
                ))}

                {day.sessions.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-hairline bg-canvas-parchment px-6 py-12 text-center">
                    <div className="text-3xl text-ink-muted48 mb-2">○</div>
                    <p className="text-sm font-medium text-ink-muted80">Không có buổi học</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}

      </div>
    </div>
  );
}
