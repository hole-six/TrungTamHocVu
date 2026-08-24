"use client";

import { SESSION_STATUS_LABEL } from "@/lib/server/class-rules";
import SessionLinkWithDrawer from "@/components/classes/SessionLinkWithDrawer";

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

/**
 * Thẻ 1 buổi học — dùng chung cho cả lưới tuần (desktop, variant="grid") lẫn danh
 * sách 1 ngày (mobile, variant="list"). Trước đây 2 chỗ này viết tay 2 bản markup
 * độc lập (khác cả icon: chữ nhãn ở bản desktop, emoji ở bản mobile) — gộp về đây để
 * sửa 1 nơi là đồng bộ cả hai, không còn lệch nội dung giữa 2 layout.
 */
export default function SessionCard({ session, variant }: { session: SessionCardData; variant: "grid" | "list" }) {
  const teacherNames = session.assignments
    .filter((assignment) => assignment.role === "TEACHER")
    .map((assignment) => assignment.employee.shortName || assignment.employee.fullName);
  const assistantNames = session.assignments
    .filter((assignment) => assignment.role !== "TEACHER")
    .map((assignment) => assignment.employee.shortName || assignment.employee.fullName);
  const enrollmentCount = session.class._count?.enrollments ?? 0;

  if (variant === "list") {
    return (
      <SessionLinkWithDrawer
        sessionId={session.id}
        classId={session.classId}
        returnPath="/calendar"
        className="block rounded-2xl border border-hairline bg-white p-4 transition active:scale-[0.98] active:bg-canvas-parchment"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-base font-semibold leading-tight text-ink">{session.class.className}</p>
            <p className="mt-1 text-xs text-ink-muted48">
              {session.class.classCode}
              {session.class.course?.name ? ` · ${session.class.course.name}` : ""}
            </p>
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold ${statusBadgeClass(session.status)}`}>
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
            <span className={`font-semibold ${session.room ? "text-ink" : "text-amber-600"}`}>{session.room || "Chưa gán phòng"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-ink-muted48">👥</span>
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
      </SessionLinkWithDrawer>
    );
  }

  return (
    <SessionLinkWithDrawer
      sessionId={session.id}
      classId={session.classId}
      returnPath="/calendar"
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
        <span className={`whitespace-nowrap rounded-full border px-[9px] py-[6px] text-[10px] font-semibold ${statusBadgeClass(session.status)}`}>
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
          <p className="mt-1 text-[11px] font-semibold leading-[1.35] text-ink">{enrollmentCount} bạn</p>
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
    </SessionLinkWithDrawer>
  );
}
