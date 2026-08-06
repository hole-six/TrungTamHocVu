import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { SESSION_STATUS_LABEL } from "@/lib/server/class-rules";
import { getUserRole } from "@/lib/permissions";
import { getCurrentBranchId } from "@/lib/branch-filter";
import CalendarFilters from "@/components/calendar/CalendarFilters";
import PageGuide from "@/components/ui/PageGuide";

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

function statusBadge(status: string) {
  if (status === "COMPLETED") return "border-transparent bg-[#e9f9f1] text-[#18a96b]";
  if (status === "CONFIRMED") return "border-transparent bg-[#eaf4ff] text-[#1389e8]";
  if (status === "CANCELLED") return "border-transparent bg-rose-100 text-rose-700";
  if (status === "RESCHEDULED") return "border-transparent bg-[#fff5e5] text-[#ef8200]";
  return "border-[#dce7f3] bg-slate-100 text-slate-700";
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
  searchParams: { week?: string; q?: string; timePreset?: string };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  const activeBranchId = await getCurrentBranchId();

  const q = searchParams.q?.trim() ?? "";
  const timePreset = searchParams.timePreset?.trim() ?? "all";
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

      <CalendarFilters
        key={`${anchor.toISOString().slice(0, 10)}|${q}|${timePreset}`}
        initialWeek={anchor.toISOString().slice(0, 10)}
        initialQuery={q}
        initialTimePreset={timePreset}
      />

      <div className="overflow-x-auto pb-2">
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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted48">{WEEKDAY_SHORT[day.date.getUTCDay()]}</p>
                  <p className="mt-1 font-display text-xl font-semibold tracking-tight text-ink">{formatCompactDate(day.date)}</p>
                  <p className="mt-1 text-xs text-ink-muted48">
                    {day.sessions.length} buổi · {day.totalStudents} lượt học viên
                  </p>
                </div>
                  {isToday ? <span className="absolute right-0 top-0 text-[11px] font-semibold text-sky-700">Hôm nay</span> : null}
                  {isFocus && !isToday ? <span className="absolute right-0 top-0 text-[11px] font-semibold text-indigo-600">Đang xem</span> : null}
                </div>

                <div className="mb-3 grid grid-cols-2 gap-[9px]">
                  <div className="rounded-[11px] bg-[#f5f9fd] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted48">Đã xong</p>
                    <p className="mt-2 text-lg font-semibold text-emerald-700">{day.completed}</p>
                  </div>
                  <div className="rounded-[11px] bg-[#fff8ed] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted48">Thiếu phân công</p>
                    <p className="mt-2 text-lg font-semibold text-amber-700">{day.missingAssignments}</p>
                  </div>
                </div>

                <div className="space-y-[10px]">
                  {day.sessions.map((session) => {
                    const teacherNames = session.assignments
                      .filter((assignment) => assignment.role === "TEACHER")
                      .map((assignment) => assignment.employee.shortName || assignment.employee.fullName);
                    const assistantNames = session.assignments
                      .filter((assignment) => assignment.role !== "TEACHER")
                      .map((assignment) => assignment.employee.shortName || assignment.employee.fullName);

                    return (
                      <Link
                        key={session.id}
                        href={`/classes/${session.classId}/sessions/${session.id}`}
                        className="block rounded-[14px] border border-[#d5e4f3] bg-white p-[11px] transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_40px_-30px_rgba(14,116,144,0.45)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold leading-[1.35] text-ink">{session.class.className}</p>
                            <p className="mt-1 text-[10px] text-ink-muted48">
                              {session.class.classCode}
                              {session.class.course?.name ? ` · ${session.class.course.name}` : ""}
                            </p>
                          </div>
                          <span className={`rounded-full border px-[9px] py-[6px] text-[10px] font-semibold whitespace-nowrap ${statusBadge(session.status)}`}>
                            {SESSION_STATUS_LABEL[session.status] ?? session.status}
                          </span>
                        </div>

                        <div className="mt-[10px] grid grid-cols-2 gap-[7px]">
                          <div className="min-h-[48px] rounded-[9px] bg-[#f7f9fc] p-2">
                            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-muted48">Giờ</p>
                            <p className="mt-1 text-[11px] font-semibold leading-[1.35] text-ink">
                              {session.startTime ?? "Chưa rõ"} - {session.endTime ?? "Chưa rõ"}
                            </p>
                          </div>
                          <div className="min-h-[48px] rounded-[9px] bg-[#f7f9fc] p-2">
                            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-muted48">Phòng</p>
                            <p className={`mt-1 text-[11px] font-semibold leading-[1.35] ${session.room ? "text-ink" : "text-amber-700"}`}>
                              {session.room || "Chưa gán phòng"}
                            </p>
                          </div>
                          <div className="min-h-[48px] rounded-[9px] bg-[#f7f9fc] p-2">
                            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-muted48">Sĩ số</p>
                            <p className="mt-1 text-[11px] font-semibold leading-[1.35] text-ink">{session.class._count?.enrollments ?? 0} bạn</p>
                          </div>
                          <div className="min-h-[48px] rounded-[9px] bg-[#f7f9fc] p-2">
                            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-muted48">Nhân sự</p>
                            <p className={`mt-1 text-[11px] font-semibold leading-[1.35] ${session.assignments.length > 0 ? "text-ink" : "text-amber-700"}`}>
                              {session.assignments.length > 0 ? `${session.assignments.length} người` : "Chưa phân công"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-[9px] space-y-1 text-[10px] leading-[1.65] text-ink-muted80">
                          <p>
                            <span className="font-semibold text-ink">GV:</span> {teacherNames.length > 0 ? teacherNames.join(", ") : "Chưa có giáo viên"}
                          </p>
                          <p>
                            <span className="font-semibold text-ink">TG:</span> {assistantNames.length > 0 ? assistantNames.join(", ") : "Chưa có"}
                          </p>
                        </div>

                        {session.notes ? <div className="mt-2 rounded-[9px] bg-[#fff8ed] px-2 py-2 text-[10px] font-medium text-amber-800">{session.notes}</div> : null}
                      </Link>
                    );
                  })}

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
                {day.sessions.map((session) => {
                  const teacherNames = session.assignments
                    .filter((assignment) => assignment.role === "TEACHER")
                    .map((assignment) => assignment.employee.shortName || assignment.employee.fullName);
                  const assistantNames = session.assignments
                    .filter((assignment) => assignment.role !== "TEACHER")
                    .map((assignment) => assignment.employee.shortName || assignment.employee.fullName);

                  return (
                    <Link
                      key={session.id}
                      href={`/classes/${session.classId}/sessions/${session.id}`}
                      className="block rounded-2xl border border-hairline bg-white p-4 transition active:scale-[0.98] active:bg-canvas-parchment"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <p className="text-base font-semibold leading-tight text-ink">{session.class.className}</p>
                          <p className="mt-1 text-xs text-ink-muted48">
                            {session.class.classCode}
                            {session.class.course?.name ? ` · ${session.class.course.name}` : ""}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold ${statusBadge(session.status)}`}>
                          {SESSION_STATUS_LABEL[session.status] ?? session.status}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-ink-muted48">🕐</span>
                          <span className="font-semibold text-ink">{session.startTime ?? "Chưa rõ"} - {session.endTime ?? "Chưa rõ"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-ink-muted48">📍</span>
                          <span className={`font-semibold ${session.room ? "text-ink" : "text-amber-600"}`}>
                            {session.room || "Chưa gán phòng"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-ink-muted48">👥</span>
                          <span className="font-semibold text-ink">{session.class._count?.enrollments ?? 0} học viên</span>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1 rounded-xl bg-canvas-parchment p-3 text-xs">
                        <p className="text-ink-muted80">
                          <span className="font-semibold text-ink">GV:</span> {teacherNames.length > 0 ? teacherNames.join(", ") : "Chưa có"}
                        </p>
                        <p className="text-ink-muted80">
                          <span className="font-semibold text-ink">TG:</span> {assistantNames.length > 0 ? assistantNames.join(", ") : "Chưa có"}
                        </p>
                      </div>

                      {session.notes && (
                        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-medium text-amber-800">
                          {session.notes}
                        </div>
                      )}
                    </Link>
                  );
                })}

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

    </div>
  );
}
