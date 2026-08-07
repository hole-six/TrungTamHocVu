import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const WEEKDAY_LABEL = [
  "Chủ nhật",
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
];

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("vi-VN");
}

function formatTeacherComment(comment: string | null | undefined) {
  if (!comment) return null;

  const lines = comment
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  return (
    <div className="space-y-1 leading-6 text-[12.5px]">
      {lines.map((line, index) => {
        const lower = line.toLowerCase();
        const isAbsent = lower.includes("vắng");
        const isAcademic =
          lower.startsWith("vấn đáp") ||
          lower.startsWith("minitest") ||
          lower.startsWith("viết tập") ||
          lower.startsWith("btvn");

        return (
          <p
            key={`${line}-${index}`}
            className={
              isAbsent
                ? "font-semibold text-red-600"
                : isAcademic
                  ? "font-medium text-blue-700"
                  : "text-slate-700"
            }
          >
            {line.startsWith("-") ? line : `- ${line}`}
          </p>
        );
      })}
    </div>
  );
}

function buildHomeworkLines(homeworkNote: string | null | undefined) {
  if (!homeworkNote) return [];
  return homeworkNote
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getScorePrintCellClass(score: number | null | undefined) {
  if (score === null || score === undefined) return "text-[#64748b] bg-white";
  if (score < 7) return "bg-[#fee2e2] text-[#b91c1c]";
  if (score === 7) return "bg-[#fef3c7] text-[#b45309]";
  return "bg-[#dcfce7] text-[#15803d]";
}

export async function generateMetadata({ params }: { params: { sessionId: string } }): Promise<Metadata> {
  const classSession = await prisma.classSession.findUnique({
    where: { id: params.sessionId },
    include: { class: { include: { branch: true } }, journal: true },
  });

  if (!classSession) {
    return { title: "Nhật ký lớp học" };
  }

  const dateLabel = formatDate(classSession.sessionDate);
  const title = `Nhật ký lớp học - ${classSession.class.className} - ${dateLabel}`;
  const description = classSession.journal?.unitLesson
    ? `${classSession.journal.unitLesson} · ${classSession.class.branch.name}`
    : `${classSession.class.branch.name} · Điểm, nhận xét và bài tập về nhà của buổi học ${dateLabel}`;

  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
  };
}

export default async function JournalPrintPage({ params }: { params: { sessionId: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const classSession = await prisma.classSession.findUnique({
    where: { id: params.sessionId },
    include: {
      class: {
        include: {
          branch: true,
          course: true,
          scheduleRules: { orderBy: { weekday: "asc" } },
        },
      },
      journal: {
        include: {
          entries: {
            include: { student: true, scores: true },
          },
        },
      },
    },
  });

  if (!classSession || !classSession.journal) notFound();

  if (session.guardianId) {
    const hasChildInClass = await prisma.studentGuardian.findFirst({
      where: {
        guardianId: session.guardianId,
        student: { enrollments: { some: { classId: classSession.classId } } },
      },
    });
    if (!hasChildInClass) notFound();
  }

  const journal = classSession.journal;
  const enrollments = await prisma.enrollment.count({
    where: { classId: classSession.classId, status: "ACTIVE" },
  });

  const entries = [...journal.entries].sort((a, b) =>
    a.student.fullName.localeCompare(b.student.fullName, "vi")
  );
  const allLabels = Array.from(new Set(entries.flatMap((e) => e.scores.map((s) => s.label))));
  const scoreColumns = allLabels.length ? allLabels : ["Điểm"];
  const homeworkLines = buildHomeworkLines(journal.homeworkNote);
  const weekday = WEEKDAY_LABEL[new Date(classSession.sessionDate).getDay()];
  const scheduleSummary = classSession.class.scheduleRules.length
    ? classSession.class.scheduleRules
        .map((rule) => {
          const wd = WEEKDAY_LABEL[rule.weekday] ?? `Thứ ${rule.weekday}`;
          const room = rule.room ? ` · ${rule.room}` : "";
          return `${wd}: ${rule.startTime}–${rule.endTime}${room}`;
        })
        .join("  |  ")
    : "Chưa có lịch học chuẩn";

  return (
    <div className="mx-auto w-full max-w-[1100px] bg-[#f0f4f8] px-4 py-8 print:max-w-none print:bg-white print:p-0">

      {/* ── Top bar (no-print) ── */}
      <div className="no-print mb-6 flex items-center justify-between rounded-2xl border border-[#e5eaf7] bg-white px-6 py-4 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-[#0f1729]">Nhật ký lớp học</h1>
          <p className="mt-1 text-sm text-[#64748b]">Bản in gửi phụ huynh và giáo viên theo đúng nội dung buổi học.</p>
        </div>
        <PrintButton label="Lưu PDF phụ huynh" pageSize="A4 landscape" margin="8mm" />
      </div>

      {/* ── Document ── */}
      <div className="overflow-hidden rounded-[24px] border border-[#d1d9e6] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.10)] print:rounded-none print:border-0 print:shadow-none">

        {/* ── Header ── */}
        <div className="relative overflow-hidden border-b border-[#d1d9e6] bg-gradient-to-br from-[#1e3a5f] to-[#1e40af] px-8 py-7 text-center print:py-5">
          {/* decorative circles */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -left-8 -bottom-8 h-28 w-28 rounded-full bg-white/5" />
          <p className="relative text-[11px] font-bold uppercase tracking-[0.4em] text-blue-200">
            {classSession.class.branch.name}
          </p>
          <h2 className="relative mt-2 text-[28px] font-black uppercase tracking-[0.10em] text-white print:text-[24px]">
            Nhật ký lớp học
          </h2>
          <p className="relative mt-1.5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-sm font-semibold text-blue-100">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Ngày {formatDate(classSession.sessionDate)} &middot; {weekday}
          </p>
        </div>

        {/* ── Meta grid ── */}
        <div className="grid grid-cols-2 border-b border-[#d1d9e6] sm:grid-cols-4 print:grid-cols-4">
          {[
            { label: "Cơ sở", value: classSession.class.branch.name },
            { label: "Lớp", value: classSession.class.className },
            { label: "Số học viên", value: String(enrollments) },
            { label: "Lịch học", value: scheduleSummary },
          ].map((item, i, arr) => (
            <div
              key={item.label}
              className={`px-5 py-4 ${i < arr.length - 1 ? "border-b border-[#e5eaf7] sm:border-b-0 sm:border-r print:border-b-0 print:border-r" : ""}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#64748b]">{item.label}</p>
              <p className="mt-1.5 text-[14px] font-bold leading-5 text-[#0f1729]">{item.value}</p>
            </div>
          ))}
        </div>

        {/* ── Unit / Lesson banner ── */}
        <div className="border-b border-[#d1d9e6] bg-gradient-to-r from-[#fef9c3] to-[#fef3c7] px-8 py-4 text-center">
          <p className="text-[13px] font-black uppercase tracking-[0.25em] text-[#92400e]">
            {journal.unitLesson || "Chưa ghi unit / lesson cho buổi học này"}
          </p>
          {classSession.class.course?.name && (
            <p className="mt-1 text-xs font-semibold text-[#b45309]">{classSession.class.course.name}</p>
          )}
        </div>

        {/* ── Table section ── */}
        <div className="px-5 py-6 sm:px-8 print:px-5 print:py-4">
          <div className="mb-5 flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-[#1e40af]" />
            <h3 className="text-[15px] font-black uppercase tracking-[0.08em] text-[#0f1729]">
              II. Nhận xét của giáo viên
            </h3>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#d1d9e6] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="border-b border-r border-[#d1d9e6] bg-[#1e3a5f] px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white"
                  >
                    Mã HV
                  </th>
                  <th
                    rowSpan={2}
                    className="border-b border-r border-[#d1d9e6] bg-[#1e3a5f] px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white"
                  >
                    Họ tên
                  </th>
                  <th
                    colSpan={scoreColumns.length}
                    className="border-b border-r border-[#d1d9e6] bg-[#1e3a5f] px-3 py-2 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white"
                  >
                    Điểm
                  </th>
                  <th
                    rowSpan={2}
                    className="border-b border-r border-[#d1d9e6] bg-[#1e3a5f] px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white"
                  >
                    BTVN
                  </th>
                  <th
                    rowSpan={2}
                    className="border-b border-r border-[#d1d9e6] bg-[#1e3a5f] px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white"
                  >
                    Nhận xét
                  </th>
                  <th
                    rowSpan={2}
                    className="border-b border-[#d1d9e6] bg-[#1e3a5f] px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white"
                  >
                    Ghi chú
                  </th>
                </tr>
                <tr>
                  {scoreColumns.map((label) => (
                    <th
                      key={label}
                      className="border-b border-r border-[#d1d9e6] bg-[#dbeafe] px-3 py-2 text-center text-[10px] font-bold text-[#1e40af]"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.length ? (
                  entries.map((entry, rowIdx) => {
                    const scoreMap = Object.fromEntries(entry.scores.map((s) => [s.label, s.score]));
                    const homeworkLate = entry.homeworkStatus === "Chưa nộp";
                    const rowBg = rowIdx % 2 === 0 ? "bg-white" : "bg-[#f8faff]";

                    return (
                      <tr key={entry.id} className={`align-top ${rowBg} hover:bg-[#eff6ff] transition-colors`}>
                        <td className="border-b border-r border-[#e5eaf7] px-3 py-3.5 text-center text-[12px] font-semibold text-[#64748b]">
                          {entry.student.studentCode || "—"}
                        </td>
                        <td className="border-b border-r border-[#e5eaf7] px-3 py-3.5">
                          <div className="text-[13.5px] font-bold text-[#0f1729]">{entry.student.fullName}</div>
                          {entry.student.studentCode && (
                            <div className="mt-0.5 text-[10.5px] font-medium text-[#94a3b8]">
                              {entry.student.studentCode}
                            </div>
                          )}
                        </td>
                        {scoreColumns.map((label) => {
                          const v = scoreMap[label];
                          const colorClass =
                            v == null
                              ? "text-[#64748b]"
                              : v < 5
                              ? "text-red-600"
                              : v < 7
                              ? "text-amber-600"
                              : "text-emerald-600";
                          return (
                            <td
                              key={`${entry.id}-${label}`}
                              className={`border-b border-r border-[#e5eaf7] px-3 py-3.5 text-center text-[20px] font-black ${colorClass} ${getScorePrintCellClass(v)}`}
                            >
                              {v ?? ""}
                            </td>
                          );
                        })}
                        <td
                          className={`border-b border-r border-[#e5eaf7] px-3 py-3.5 text-center text-[12.5px] font-bold ${
                            homeworkLate ? "text-red-600" : "text-[#0f1729]"
                          }`}
                        >
                          {entry.homeworkStatus || "—"}
                        </td>
                        <td className="border-b border-r border-[#e5eaf7] px-3 py-3.5 align-top">
                          {formatTeacherComment(entry.comment) ?? (
                            <p className="text-[12px] italic text-[#94a3b8]">Chưa có nhận xét.</p>
                          )}
                        </td>
                        <td className="border-b border-[#e5eaf7] px-3 py-3.5 text-[12px] leading-6 text-[#64748b]">
                          {entry.notes || ""}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={scoreColumns.length + 5}
                      className="px-4 py-10 text-center text-sm text-[#94a3b8]"
                    >
                      Chưa có dữ liệu nhật ký cho buổi học này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Homework note ── */}
          <div className="mt-6 overflow-hidden rounded-xl border border-[#bfdbfe]">
            <div className="flex items-center gap-3 border-b border-[#bfdbfe] bg-gradient-to-r from-[#eff6ff] to-[#dbeafe] px-5 py-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              <p className="text-[14px] font-black text-[#1e40af]">
                Trung tâm xin nhờ bố mẹ nhắc các con làm bài tập về nhà như sau:
              </p>
            </div>
            <div className="bg-white px-5 py-4">
              {homeworkLines.length ? (
                <div className="space-y-1.5">
                  {homeworkLines.map((line, i) => (
                    <div key={`${line}-${i}`} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3b82f6]" />
                      <p className="text-[14px] font-semibold leading-7 text-[#1e3a5f]">{line}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm italic text-[#94a3b8]">Chưa có dặn dò cuối buổi.</p>
              )}
              <div className="mt-4 flex items-center gap-2">
                <div className="h-px flex-1 bg-[#e5eaf7]" />
                <p className="text-[13.5px] font-black text-[#1e40af]">Trung tâm xin cảm ơn ạ!</p>
                <div className="h-px flex-1 bg-[#e5eaf7]" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-[#d1d9e6] bg-[#f8faff] px-8 py-3 print:py-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-[#94a3b8]">{classSession.class.branch.name}</p>
            <p className="text-[11px] text-[#94a3b8]">
              {classSession.class.className} · {formatDate(classSession.sessionDate)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
