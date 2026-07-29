import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { SESSION_STATUS_LABEL } from "@/lib/server/class-rules";

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function startOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // tuần bắt đầu Thứ 2
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export default async function CalendarPage({ searchParams }: { searchParams: { week?: string } }) {
  const user = await getCurrentUser();
  const anchor = searchParams.week ? new Date(searchParams.week) : new Date();
  const weekStart = startOfWeek(anchor);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const prevWeek = new Date(weekStart);
  prevWeek.setUTCDate(prevWeek.getUTCDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

  const sessions = await prisma.classSession.findMany({
    where: {
      sessionDate: { gte: weekStart, lte: weekEnd },
      class: user?.branchId ? { branchId: user.branchId } : {},
    },
    include: { class: true, assignments: { include: { employee: true } } },
    orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });

  const sessionsByDay = days.map((d) => ({
    date: d,
    sessions: sessions.filter((s) => s.sessionDate.toISOString().slice(0, 10) === d.toISOString().slice(0, 10)),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lịch tổng</h1>
          <p className="mt-1 text-sm text-ink-muted48">
            Tuần {formatDate(weekStart)} – {formatDate(weekEnd)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/calendar?week=${prevWeek.toISOString().slice(0, 10)}`} className="btn-ghost">
            ← Tuần trước
          </Link>
          <Link href={`/calendar?week=${nextWeek.toISOString().slice(0, 10)}`} className="btn-ghost">
            Tuần sau →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        {sessionsByDay.map(({ date, sessions: daySessions }) => (
          <div key={date.toISOString()} className="card !p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">
              {WEEKDAY_SHORT[date.getUTCDay()]} · {formatDate(date)}
            </p>
            <div className="mt-2 space-y-2">
              {daySessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/classes/${s.classId}/sessions/${s.id}`}
                  className="block rounded-lg border border-hairline px-2 py-2 text-xs hover:border-primary"
                >
                  <p className="font-medium text-ink">{s.class.className}</p>
                  <p className="text-ink-muted48">
                    {s.startTime}–{s.endTime} {s.room && `· ${s.room}`}
                  </p>
                  <p className="mt-1 text-ink-muted48">
                    {s.assignments.map((a) => a.employee.shortName).join(", ") || "Chưa phân công"}
                  </p>
                  <span className="badge bg-ink/5 text-ink-muted80 mt-1">{SESSION_STATUS_LABEL[s.status] ?? s.status}</span>
                </Link>
              ))}
              {daySessions.length === 0 && <p className="text-xs text-ink-muted48">Không có buổi học.</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
