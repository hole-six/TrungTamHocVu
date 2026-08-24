"use client";

import { SESSION_STATUS_LABEL } from "@/lib/server/class-rules";
import SessionLinkWithDrawer from "@/components/classes/SessionLinkWithDrawer";

export type CalendarListRow = {
  id: string;
  classId: string;
  sessionDate: string | Date;
  status: string;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
  class: {
    className: string;
    classCode: string;
    course?: { name: string } | null;
    _count?: { enrollments: number } | null;
  };
  assignments: { role: string; employee: { fullName: string; shortName: string | null } }[];
};

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function statusBadgeClass(status: string) {
  if (status === "COMPLETED") return "border-transparent bg-[#e9f9f1] text-[#18a96b]";
  if (status === "CONFIRMED") return "border-transparent bg-[#eaf4ff] text-[#1389e8]";
  if (status === "CANCELLED") return "border-transparent bg-rose-100 text-rose-700";
  if (status === "RESCHEDULED") return "border-transparent bg-[#fff5e5] text-[#ef8200]";
  return "border-[#dce7f3] bg-slate-100 text-slate-700";
}

function formatRowDate(value: string | Date) {
  const d = new Date(value);
  return `${WEEKDAY_SHORT[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Dạng danh sách phẳng — mỗi buổi học 1 dòng, gộp tất cả các ngày trong tuần vào
// một bảng dài duy nhất, thay vì phải dò 7 cột lưới để tìm 1 buổi cụ thể.
export default function CalendarListView({ rows }: { rows: CalendarListRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#cbdcef] bg-[#fcfdff] px-6 py-16 text-center">
        <div className="mb-2 text-lg text-[#71839b]">○</div>
        <p className="text-sm text-[#68788f]">Không có buổi học nào trong tuần này khớp bộ lọc.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[17px] border border-[#dce7f3] bg-white shadow-[0_6px_18px_rgba(45,73,112,0.035)]">
      <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-[#f7f9fc] text-[11px] uppercase tracking-[0.12em] text-ink-muted48">
            <tr>
              <th className="px-4 py-3">Ngày</th>
              <th className="px-4 py-3">Giờ</th>
              <th className="px-4 py-3">Lớp</th>
              <th className="px-4 py-3">Phòng</th>
              <th className="px-4 py-3">GV / TG</th>
              <th className="px-4 py-3 text-center">Sĩ số</th>
              <th className="px-4 py-3 text-right">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef3f9]">
            {rows.map((row) => {
              const teacherNames = row.assignments
                .filter((a) => a.role === "TEACHER")
                .map((a) => a.employee.shortName || a.employee.fullName);
              const assistantNames = row.assignments
                .filter((a) => a.role !== "TEACHER")
                .map((a) => a.employee.shortName || a.employee.fullName);
              const enrollmentCount = row.class._count?.enrollments ?? 0;

              return (
                <tr key={row.id} className="align-top transition hover:bg-[#fafdff]">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">{formatRowDate(row.sessionDate)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted80">
                    {row.startTime ?? "?"}-{row.endTime ?? "?"}
                  </td>
                  <td className="px-4 py-3">
                    <SessionLinkWithDrawer
                      sessionId={row.id}
                      classId={row.classId}
                      returnPath="/calendar"
                      className="font-bold text-[#0f1729] hover:text-[#1d4ed8] hover:underline cursor-pointer"
                    >
                      {row.class.className}
                    </SessionLinkWithDrawer>
                    <p className="mt-0.5 text-xs text-ink-muted48">
                      {row.class.classCode}
                      {row.class.course?.name ? ` · ${row.class.course.name}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={row.room ? "text-ink" : "font-semibold text-amber-600"}>{row.room || "Chưa gán phòng"}</span>
                  </td>
                  <td className="px-4 py-3 text-xs leading-5 text-ink-muted80">
                    <p>
                      <span className="font-semibold text-ink">GV:</span> {teacherNames.length > 0 ? teacherNames.join(", ") : "Chưa có"}
                    </p>
                    <p>
                      <span className="font-semibold text-ink">TG:</span> {assistantNames.length > 0 ? assistantNames.join(", ") : "Chưa có"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-ink">{enrollmentCount}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${statusBadgeClass(row.status)}`}>
                      {SESSION_STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
