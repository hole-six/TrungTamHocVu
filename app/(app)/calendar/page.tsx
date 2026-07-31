import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { SESSION_STATUS_LABEL } from "@/lib/server/class-rules";
import { getUserRole } from "@/lib/permissions";
import CalendarFilters from "@/components/calendar/CalendarFilters";

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const TODAY_YMD = new Date().toISOString().slice(0, 10);

function startOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function formatFullDate(d: Date) {
  return d.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" });
}

function timePresetWhere(timePreset: string) {
  if (timePreset === "morning") return { startTime: { gte: "00:00", lt: "12:00" } };
  if (timePreset === "afternoon") return { startTime: { gte: "12:00", lt: "17:30" } };
  if (timePreset === "evening") return { startTime: { gte: "17:30", lte: "23:59" } };
  return {};
}

function statusBadge(status: string) {
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "CONFIRMED") return "bg-sky-100 text-sky-700 border-sky-200";
  if (status === "CANCELLED") return "bg-rose-100 text-rose-700 border-rose-200";
  if (status === "RESCHEDULED") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function timePresetLabel(timePreset: string) {
  if (timePreset === "morning") return "Ca sáng";
  if (timePreset === "afternoon") return "Ca chiều";
  if (timePreset === "evening") return "Ca tối";
  return "Toàn bộ thời gian";
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { week?: string; q?: string; status?: string; timePreset?: string };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;

  const q = searchParams.q?.trim() ?? "";
  const status = searchParams.status?.trim() ?? "";
  const timePreset = searchParams.timePreset?.trim() ?? "all";
  const anchor = searchParams.week ? new Date(searchParams.week) : new Date();
  const weekStart = startOfWeek(anchor);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const prevWeek = new Date(weekStart);
  prevWeek.setUTCDate(prevWeek.getUTCDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

  const teacherScoped = role === "TEACHER" || role === "TEACHING_ASSISTANT";

  const sessions = await prisma.classSession.findMany({
    where: {
      sessionDate: { gte: weekStart, lte: weekEnd },
      ...(status ? { status } : {}),
      ...timePresetWhere(timePreset),
      class: {
        ...(user?.branchId ? { branchId: user.branchId } : {}),
        ...(q
          ? {
              OR: [
                { className: { contains: q } },
                { classCode: { contains: q } },
                { course: { name: { contains: q } } },
              ],
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

  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((session) => session.status === "COMPLETED").length;
  const confirmedSessions = sessions.filter((session) => session.status === "CONFIRMED").length;
  const unassignedSessions = sessions.filter((session) => session.assignments.length === 0).length;
  const roomAlerts = sessions.filter((session) => !session.room).length;
  const scheduledSeats = sessions.reduce((sum, session) => sum + (session.class._count?.enrollments ?? 0), 0);
  const focusDayKey = anchor.toISOString().slice(0, 10);
  const focusDay = sessionsByDay.find((day) => day.date.toISOString().slice(0, 10) === focusDayKey) ?? sessionsByDay[0];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f7fbff_0%,#edf6ff_42%,#ffffff_100%)] p-6 shadow-[0_28px_80px_-48px_rgba(14,116,144,0.4)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <span className="inline-flex w-fit rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              Lịch vận hành lớp học
            </span>
            <div>
              <h1 className="page-title">Lịch tuần rõ ca, rõ lớp, rõ người dạy</h1>
              <p className="page-subtitle max-w-3xl">
                Theo dõi tuần từ {formatDate(weekStart)} đến {formatDate(weekEnd)} theo đúng ngữ cảnh vận hành:
                nhìn nhanh buổi nào đã chốt, buổi nào thiếu người, buổi nào còn thiếu phòng và ca nào đang dồn lịch.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Ngữ cảnh đang xem</p>
              <p className="mt-2 text-lg font-semibold text-ink">
                {teacherScoped ? "Lịch của tôi" : "Toàn chi nhánh"}
              </p>
              <p className="mt-1 text-xs text-ink-muted48">{timePresetLabel(timePreset)}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Ngày được nhấn mạnh</p>
              <p className="mt-2 text-lg font-semibold text-ink">{formatFullDate(focusDay.date)}</p>
              <p className="mt-1 text-xs text-ink-muted48">{focusDay.sessions.length} buổi trong ngày</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Từ khóa đang lọc</p>
              <p className="mt-2 text-lg font-semibold text-ink">{q || "Không lọc từ khóa"}</p>
              <p className="mt-1 text-xs text-ink-muted48">{status ? `Trạng thái: ${SESSION_STATUS_LABEL[status] ?? status}` : "Mọi trạng thái"}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={`/calendar?week=${prevWeek.toISOString().slice(0, 10)}&q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&timePreset=${encodeURIComponent(timePreset)}`} className="btn-ghost">
            ← Tuần trước
          </Link>
          <Link href={`/calendar?week=${TODAY_YMD}`} className="btn-ghost">
            Về tuần hiện tại
          </Link>
          <Link href={`/calendar?week=${nextWeek.toISOString().slice(0, 10)}&q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&timePreset=${encodeURIComponent(timePreset)}`} className="btn-ghost">
            Tuần sau →
          </Link>
        </div>
      </div>

      <CalendarFilters initialWeek={anchor.toISOString().slice(0, 10)} initialQuery={q} initialStatus={status} initialTimePreset={timePreset} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "Tổng số buổi", value: totalSessions, tone: "text-slate-900", bg: "from-slate-50 to-white" },
          { label: "Đã hoàn thành", value: completedSessions, tone: "text-emerald-700", bg: "from-emerald-50 to-white" },
          { label: "Đã xác nhận", value: confirmedSessions, tone: "text-sky-700", bg: "from-sky-50 to-white" },
          { label: "Thiếu phân công", value: unassignedSessions, tone: "text-amber-700", bg: "from-amber-50 to-white" },
          { label: "Thiếu phòng", value: roomAlerts, tone: "text-rose-700", bg: "from-rose-50 to-white" },
          { label: "Lượt học viên", value: scheduledSeats, tone: "text-indigo-700", bg: "from-indigo-50 to-white" },
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-7">
        {sessionsByDay.map((day) => {
          const iso = day.date.toISOString().slice(0, 10);
          const isToday = iso === TODAY_YMD;
          const isFocus = iso === focusDayKey;

          return (
            <div
              key={iso}
              className={`overflow-hidden rounded-[28px] border p-4 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.45)] ${
                isFocus
                  ? "border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#f4faff_100%)]"
                  : "border-[#e4ebf8] bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">
                    {WEEKDAY_SHORT[day.date.getUTCDay()]}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-ink">{formatDate(day.date)}</p>
                  <p className="mt-1 text-xs text-ink-muted48">{day.sessions.length} buổi · {day.totalStudents} lượt học viên</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {isToday ? <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold text-sky-700">Hôm nay</span> : null}
                  {isFocus && !isToday ? <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold text-indigo-700">Đang xem</span> : null}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-[#f8fbff] px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted48">Đã xong</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-600">{day.completed}</p>
                </div>
                <div className="rounded-2xl bg-[#fffaf2] px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted48">Thiếu người</p>
                  <p className="mt-1 text-sm font-semibold text-amber-600">{day.missingAssignments}</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
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
                      className="block rounded-[22px] border border-[#dbe7ff] bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_40px_-30px_rgba(14,116,144,0.45)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-ink">{session.class.className}</p>
                          <p className="mt-1 text-xs text-ink-muted48">
                            {session.class.classCode}
                            {session.class.course?.name ? ` · ${session.class.course.name}` : ""}
                          </p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusBadge(session.status)}`}>
                          {SESSION_STATUS_LABEL[session.status] ?? session.status}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-2xl bg-[#f8fbff] px-3 py-2">
                          <p className="font-semibold uppercase tracking-[0.16em] text-ink-muted48">Giờ học</p>
                          <p className="mt-1 font-semibold text-ink">{session.startTime ?? "Chưa rõ"} - {session.endTime ?? "Chưa rõ"}</p>
                        </div>
                        <div className="rounded-2xl bg-[#f8fbff] px-3 py-2">
                          <p className="font-semibold uppercase tracking-[0.16em] text-ink-muted48">Phòng</p>
                          <p className={`mt-1 font-semibold ${session.room ? "text-ink" : "text-rose-600"}`}>{session.room || "Chưa gán phòng"}</p>
                        </div>
                        <div className="rounded-2xl bg-[#f8fbff] px-3 py-2">
                          <p className="font-semibold uppercase tracking-[0.16em] text-ink-muted48">Sĩ số active</p>
                          <p className="mt-1 font-semibold text-ink">{session.class._count?.enrollments ?? 0} học viên</p>
                        </div>
                        <div className="rounded-2xl bg-[#f8fbff] px-3 py-2">
                          <p className="font-semibold uppercase tracking-[0.16em] text-ink-muted48">Nhân sự</p>
                          <p className={`mt-1 font-semibold ${session.assignments.length > 0 ? "text-ink" : "text-amber-600"}`}>
                            {session.assignments.length > 0 ? `${session.assignments.length} người` : "Chưa phân công"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2 text-xs text-ink-muted80">
                        <p>
                          <span className="font-semibold text-ink">GV:</span>{" "}
                          {teacherNames.length > 0 ? teacherNames.join(", ") : "Chưa có giáo viên"}
                        </p>
                        <p>
                          <span className="font-semibold text-ink">TG:</span>{" "}
                          {assistantNames.length > 0 ? assistantNames.join(", ") : "Chưa có trợ giảng"}
                        </p>
                      </div>

                      {session.notes ? (
                        <div className="mt-3 rounded-2xl bg-[#fffaf2] px-3 py-2 text-xs text-amber-800">
                          {session.notes}
                        </div>
                      ) : null}
                    </Link>
                  );
                })}

                {day.sessions.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-[#d8e4f5] bg-[#fbfdff] px-4 py-6 text-center text-sm text-ink-muted48">
                    Không có buổi học trong ngày này.
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
