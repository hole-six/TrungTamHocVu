"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { QuickRoomCell, QuickStaffGroup, type QuickEmployee } from "@/components/calendar/CalendarQuickEdit";
import { SESSION_STATUS_LABEL } from "@/lib/server/class-rules";

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
  assignments: { id: string; role: string; employeeId: string; employee: { fullName: string; shortName: string | null } }[];
};

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function statusBadgeClass(status: string) {
  if (status === "COMPLETED") return "border-transparent bg-[#e9f9f1] text-[#18a96b]";
  if (status === "CONFIRMED") return "border-transparent bg-[#eaf4ff] text-[#1389e8]";
  if (status === "CANCELLED") return "border-transparent bg-rose-100 text-rose-700";
  if (status === "RESCHEDULED") return "border-transparent bg-[#fff5e5] text-[#ef8200]";
  return "border-[#dce7f3] bg-slate-100 text-slate-700";
}

// Nền chìm xen kẽ theo THỨ để mắt tách được các ngày trong danh sách dài:
// thứ 2/4/6 nền nhạt, thứ 3/5/7 nền trắng; hôm nay được tô đỏ riêng.
function weekdayRowClass(value: string | Date) {
  const weekday = new Date(value).getUTCDay();
  const tinted = weekday === 1 || weekday === 3 || weekday === 5;
  return tinted ? "bg-[#f6f9fd] hover:bg-[#eef4fb]" : "bg-white hover:bg-[#fafdff]";
}

function formatRowDate(value: string | Date) {
  const d = new Date(value);
  return `${WEEKDAY_SHORT[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Dạng danh sách phẳng — mỗi buổi học 1 dòng, gộp tất cả các ngày trong tuần vào
// một bảng dài duy nhất, thay vì phải dò 7 cột lưới để tìm 1 buổi cụ thể.
// rosterCountBySession: sĩ số THẬT của từng buổi, do trang lịch tính theo quy tắc chung
// ở lib/server/class-roster.ts (xem ghi chú trong SessionCard).
export default function CalendarListView({
  rows,
  rosterCountBySession,
  todayYmd,
  employees = [],
  roomOptions = [],
  canEdit = false,
}: {
  rows: CalendarListRow[];
  rosterCountBySession?: Record<string, number>;
  /** "YYYY-MM-DD" hôm nay theo giờ VN, do trang lịch tính mỗi request — không tự lấy
   *  new Date() ở trình duyệt/lúc nạp module (lệch múi giờ, đứng yên qua nửa đêm). */
  todayYmd: string;
  /** Nhân sự có thể xếp vào buổi (đã lọc theo cơ sở đang xem). */
  employees?: QuickEmployee[];
  /** Các phòng đã dùng ở cơ sở này — gợi ý sẵn khi gõ, khỏi nhớ tên phòng. */
  roomOptions?: string[];
  /** Được sửa lịch hay không (GV/TG chỉ xem). */
  canEdit?: boolean;
}) {
  // Bấm vào dòng là VÀO THẲNG trang chi tiết buổi học, đúng như bấm một thẻ ở dạng
  // lưới — không mở ngăn kéo. Trước đây chỉ mỗi tên lớp bấm được, phần còn lại của
  // dòng bấm vào không có gì xảy ra nên nhìn như hỏng.
  const router = useRouter();
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
        <table className="w-full min-w-[1040px] text-left text-[15px]">
          {/* Tiêu đề dính lại khi cuộn — danh sách cả tuần dài, cuộn xuống giữa bảng mà
              mất tiêu đề thì không biết cột nào là cột nào. */}
          <thead className="sticky top-0 z-10 bg-[#f7f9fc] text-[11px] uppercase tracking-[0.12em] text-ink-muted48 shadow-[0_1px_0_0_#e3ecf6]">
            <tr>
              <th className="px-5 py-3.5">Ngày</th>
              <th className="px-5 py-3.5">Giờ</th>
              <th className="px-5 py-3.5">Lớp</th>
              <th className="px-5 py-3.5">Phòng</th>
              <th className="px-5 py-3.5">GV / TG</th>
              <th className="px-5 py-3.5 text-center">Sĩ số</th>
              <th className="px-5 py-3.5 text-right">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef3f9]">
            {rows.map((row) => {
              const toQuick = (item: CalendarListRow["assignments"][number]) => ({
                id: item.id,
                role: item.role,
                employeeId: item.employeeId,
                name: item.employee.shortName || item.employee.fullName,
              });
              // SỐ GV/TG KHÔNG CỐ ĐỊNH: có buổi 2 giáo viên, có buổi 3 trợ giảng — lấy
              // nguyên danh sách chứ không cắt lấy người đầu tiên.
              const teachers = row.assignments.filter((a) => a.role === "TEACHER").map(toQuick);
              const assistants = row.assignments.filter((a) => a.role !== "TEACHER").map(toQuick);
              // Buổi đã hủy/đã dời thì API không cho phân công nữa — không mở ô chọn.
              const locked = row.status === "CANCELLED" || row.status === "RESCHEDULED";
              const enrollmentCount = rosterCountBySession?.[row.id] ?? row.class._count?.enrollments ?? 0;
              // Buổi hôm nay (trừ buổi đã hủy): nền đỏ nhạt, vạch đỏ đậm bên trái, ngày và
              // tên lớp đỏ đậm — nhìn danh sách cả tuần là thấy ngay hôm nay có lớp nào.
              const isToday = new Date(row.sessionDate).toISOString().slice(0, 10) === todayYmd && row.status !== "CANCELLED";

              return (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/classes/${row.classId}/sessions/${row.id}`)}
                  title="Bấm vào dòng để mở chi tiết buổi học"
                  className={`cursor-pointer align-top transition ${isToday ? "bg-red-50 shadow-[inset_4px_0_0_0_#dc2626] hover:bg-red-100/70" : weekdayRowClass(row.sessionDate)}`}
                >
                  <td className={`whitespace-nowrap px-5 py-4 ${isToday ? "font-black text-red-700" : "font-semibold text-ink"}`}>
                    <div className="flex items-center gap-2 text-base">
                      <span>{formatRowDate(row.sessionDate)}</span>
                      {isToday ? (
                        <span className="inline-flex rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">Hôm nay</span>
                      ) : null}
                    </div>
                  </td>
                  <td className={`whitespace-nowrap px-5 py-4 text-base font-bold tabular-nums ${isToday ? "text-red-700" : "text-ink"}`}>
                    {row.startTime ?? "?"}<span className="mx-0.5 font-normal text-ink-muted48">–</span>{row.endTime ?? "?"}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/classes/${row.classId}/sessions/${row.id}`}
                      title="Mở chi tiết buổi học"
                      className={`cursor-pointer text-base hover:underline ${isToday ? "font-black text-red-700" : "font-bold text-[#0f1729] hover:text-[#1d4ed8]"}`}
                    >
                      {row.class.className}
                    </Link>
                    {/* Dòng phụ là TÊN KHÓA, không phải mã lớp — trung tâm gọi lớp theo
                        "Everybody Up 1 · UP1A", mã lớp chỉ chạy ngầm cho phiếu thu/sổ sách. */}
                    {row.class.course?.name ? (
                      <p className="mt-1 text-[13px] text-ink-muted48">{row.class.course.name}</p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    <QuickRoomCell sessionId={row.id} room={row.room} roomOptions={roomOptions} canEdit={canEdit && !locked} />
                  </td>
                  {/* Thiếu người thì bôi CAM y như "Chưa gán phòng" — 3 thứ thiếu của một
                      buổi (phòng, GV, TG) phải nhìn ra ngay trên cùng một dòng.
                      Lớp có 2 trợ giảng thì mỗi người một dòng, không dồn 1 dòng dài. */}
                  <td className="px-5 py-4 text-[13px] leading-6 text-ink-muted80">
                    <QuickStaffGroup
                      sessionId={row.id}
                      roleType="TEACHER"
                      label="GV"
                      assignments={teachers}
                      employees={employees}
                      canEdit={canEdit}
                      locked={locked}
                    />
                    <QuickStaffGroup
                      sessionId={row.id}
                      roleType="ASSISTANT"
                      label="TG"
                      assignments={assistants}
                      employees={employees}
                      canEdit={canEdit}
                      locked={locked}
                    />
                  </td>
                  <td className="px-5 py-4 text-center text-base font-bold tabular-nums text-ink">{enrollmentCount}</td>
                  <td className="px-5 py-4 text-right">
                    <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${statusBadgeClass(row.status)}`}>
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
