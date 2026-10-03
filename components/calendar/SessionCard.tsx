"use client";

import Link from "next/link";
import { SESSION_STATUS_LABEL } from "@/lib/server/class-rules";

export type SessionCardData = {
  id: string;
  classId: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
  notes: string | null;
  class: {
    className: string;
    classCode: string;
    course?: { name: string } | null;
    _count?: { enrollments: number } | null;
  };
  assignments: { role: string; employee: { fullName: string; shortName: string | null } }[];
};

function statusBadgeClass(status: string) {
  if (status === "COMPLETED") return "border-transparent bg-[#e9f9f1] text-[#18a96b]";
  if (status === "CONFIRMED") return "border-transparent bg-[#eaf4ff] text-[#1389e8]";
  if (status === "CANCELLED") return "border-transparent bg-rose-100 text-rose-700";
  if (status === "RESCHEDULED") return "border-transparent bg-[#fff5e5] text-[#ef8200]";
  return "border-[#dce7f3] bg-slate-100 text-slate-700";
}

function statusAccentClass(status: string) {
  if (status === "COMPLETED") return "border-l-[#18a96b]";
  if (status === "CONFIRMED") return "border-l-[#1389e8]";
  if (status === "CANCELLED") return "border-l-slate-300";
  if (status === "RESCHEDULED") return "border-l-[#ef8200]";
  return "border-l-slate-300";
}

const ICON_CLOCK = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);
const ICON_PIN = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const ICON_USERS = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

/**
 * Thẻ 1 buổi học — dùng chung cho cả lưới tuần (desktop, variant="grid") lẫn danh
 * sách 1 ngày (mobile, variant="list"). Trước đây 2 chỗ này viết tay 2 bản markup
 * độc lập (khác cả icon: chữ nhãn ở bản desktop, emoji ở bản mobile) — gộp về đây để
 * sửa 1 nơi là đồng bộ cả hai, không còn lệch nội dung giữa 2 layout.
 */
// rosterCount = sĩ số THẬT của đúng buổi này, do trang lịch tính theo quy tắc chung ở
// lib/server/class-roster.ts. Trước đây card tự lấy class._count.enrollments — tức tổng
// học viên đang học của lớp — nên mọi buổi của cùng một lớp đều hiện chung một con số.
export default function SessionCard({
  session,
  variant,
  rosterCount,
  isToday = false,
  alert = null,
}: {
  session: SessionCardData;
  variant: "grid" | "list";
  rosterCount?: number;
  /** Buổi của NGÀY HÔM NAY — viền đỏ đậm + tên lớp đỏ đậm để nhìn lịch tuần là thấy ngay
   *  hôm nay đang có lớp nào. Buổi đã hủy thì không tô (lớp không diễn ra). */
  isToday?: boolean;
  /** CẢNH BÁO CHUYÊN MÔN của buổi — xem lib/server/class-roadmap.ts. */
  alert?: { level: "YELLOW" | "RED"; note: string | null } | null;
}) {
  // Buổi trung tâm cho nghỉ: tối màu toàn bộ thẻ + gạch ngang tên lớp, để nhìn lịch
  // tuần là biết ngay hôm đó lớp không diễn ra mà không phải đọc chữ trạng thái.
  const isOff = session.status === "CANCELLED";
  const dimClass = isOff ? "opacity-60 grayscale" : "";
  const highlightToday = isToday && !isOff;
  const classNameTextClass = highlightToday ? "font-black text-red-950" : "text-ink";
  const teacherNames = session.assignments
    .filter((assignment) => assignment.role === "TEACHER")
    .map((assignment) => assignment.employee.shortName || assignment.employee.fullName);
  const assistantNames = session.assignments
    .filter((assignment) => assignment.role !== "TEACHER")
    .map((assignment) => assignment.employee.shortName || assignment.employee.fullName);
  const enrollmentCount = rosterCount ?? session.class._count?.enrollments ?? 0;
  // Buổi đã hủy thì không cảnh báo nữa — buổi không diễn ra thì không ai phải làm gì.
  const activeAlert = isOff ? null : alert;

  if (variant === "list") {
    return (
      <Link
        href={`/classes/${session.classId}/sessions/${session.id}`}
        className={`block rounded-2xl p-4 transition active:scale-[0.98] active:bg-canvas-parchment ${
          highlightToday
            ? "border-[3px] border-red-700 bg-red-100 shadow-[0_0_0_3px_rgba(239,68,68,0.22),0_18px_36px_-18px_rgba(185,28,28,0.75)]"
            : `border border-hairline ${isOff ? "bg-slate-50" : "bg-white"}`
        } ${dimClass}`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex-1">
            {highlightToday ? (
              <span className="mb-1 inline-flex rounded-full bg-red-700 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                HÔM NAY
              </span>
            ) : null}
            <p className={`text-base font-semibold leading-tight ${classNameTextClass}`}>{session.class.className}</p>
            <p className="mt-1 text-xs text-ink-muted48">
              {session.class.course?.name ?? session.class.classCode}
            </p>
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold ${statusBadgeClass(session.status)}`}>
            {SESSION_STATUS_LABEL[session.status] ?? session.status}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-sky-500">{ICON_CLOCK}</span>
            <span className="font-semibold text-ink">{session.startTime ?? "Chưa rõ"} - {session.endTime ?? "Chưa rõ"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={session.room ? "text-violet-500" : "text-amber-500"}>{ICON_PIN}</span>
            <span className={`font-semibold ${session.room ? "text-ink" : "text-amber-600"}`}>{session.room || "Chưa gán phòng"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-emerald-500">{ICON_USERS}</span>
            <span className="font-semibold text-ink">{enrollmentCount} học viên</span>
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

        {session.notes ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{session.notes}</div>
        ) : null}
      </Link>
    );
  }

  return (
    <Link
      href={`/classes/${session.classId}/sessions/${session.id}`}
      className={`block rounded-[14px] p-3 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-30px_rgba(14,116,144,0.45)] ${
        highlightToday
          ? "border-[3px] border-red-700 bg-red-100 shadow-[0_0_0_3px_rgba(239,68,68,0.22),0_18px_36px_-18px_rgba(185,28,28,0.75)]"
          : activeAlert?.level === "RED"
            ? "border border-l-4 border-rose-300 border-l-rose-500 bg-rose-50"
            : activeAlert?.level === "YELLOW"
              ? "border border-l-4 border-amber-300 border-l-amber-500 bg-amber-50"
              : `border border-l-4 border-[#d5e4f3] hover:border-primary/35 ${isOff ? "bg-slate-50" : "bg-white"} ${statusAccentClass(session.status)}`
      } ${dimClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {highlightToday ? (
            <span className="mb-1 inline-flex rounded-full bg-red-700 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
              HÔM NAY
            </span>
          ) : null}
          <p className={`text-base font-bold leading-[1.3] ${classNameTextClass}`}>{session.class.className}</p>
          <p className="mt-1 text-xs text-ink-muted48">
            {session.class.classCode}
            {session.class.course?.name ? ` · ${session.class.course.name}` : ""}
          </p>
        </div>
        <span className={`whitespace-nowrap rounded-full border px-2.5 py-1.5 text-xs font-bold ${statusBadgeClass(session.status)}`}>
          {SESSION_STATUS_LABEL[session.status] ?? session.status}
        </span>
      </div>

      {/* CẢNH BÁO CHUYÊN MÔN — buổi này ép giáo viên phải làm việc đã ghi. */}
      {activeAlert ? (
        <p
          className={`mt-2 flex items-start gap-1 rounded-[10px] px-2 py-1.5 text-[11px] font-bold leading-snug ${
            activeAlert.level === "RED" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-900"
          }`}
        >
          <span>{activeAlert.level === "RED" ? "⛔" : "⚠"}</span>
          <span>{activeAlert.note?.trim() || "Cảnh báo chuyên môn"}</span>
        </p>
      ) : null}

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <div className="rounded-[10px] bg-sky-50 p-2">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-700/70">{ICON_CLOCK} Giờ</p>
          <p className="mt-1 text-sm font-bold leading-tight text-sky-900">
            {session.startTime ?? "Chưa rõ"} - {session.endTime ?? "Chưa rõ"}
          </p>
        </div>
        <div className={`rounded-[10px] p-2 ${session.room ? "bg-violet-50" : "bg-amber-50"}`}>
          <p className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] ${session.room ? "text-violet-700/70" : "text-amber-700/70"}`}>{ICON_PIN} Phòng</p>
          <p className={`mt-1 text-sm font-bold leading-tight ${session.room ? "text-violet-900" : "text-amber-800"}`}>
            {session.room || "Chưa gán"}
          </p>
        </div>
        <div className="rounded-[10px] bg-emerald-50 p-2">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700/70">{ICON_USERS} Sĩ số</p>
          <p className="mt-1 text-sm font-bold leading-tight text-emerald-900">{enrollmentCount} bạn</p>
        </div>
        <div className={`rounded-[10px] p-2 ${session.assignments.length > 0 ? "bg-indigo-50" : "bg-amber-50"}`}>
          <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${session.assignments.length > 0 ? "text-indigo-700/70" : "text-amber-700/70"}`}>Nhân sự</p>
          <p className={`mt-1 text-sm font-bold leading-tight ${session.assignments.length > 0 ? "text-indigo-900" : "text-amber-800"}`}>
            {session.assignments.length > 0 ? `${session.assignments.length} người` : "Chưa phân"}
          </p>
        </div>
      </div>

      <div className="mt-2 space-y-1 text-xs leading-[1.5] text-ink-muted80">
        <p>
          <span className="font-bold text-ink">GV:</span> {teacherNames.length > 0 ? teacherNames.join(", ") : "Chưa có"}
        </p>
        <p>
          <span className="font-bold text-ink">TG:</span> {assistantNames.length > 0 ? assistantNames.join(", ") : "Chưa có"}
        </p>
      </div>

      {session.notes ? <div className="mt-2 rounded-[10px] bg-[#fff8ed] px-2.5 py-1.5 text-xs font-medium leading-tight text-amber-800">{session.notes}</div> : null}
    </Link>
  );
}
