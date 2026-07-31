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
    <div className="space-y-1 leading-6 text-[13px]">
      {lines.map((line, index) => {
        const lower = line.toLowerCase();
        const isAbsent = lower.includes("vắng");
        const isAcademic =
          lower.startsWith("vấn đáp") ||
          lower.startsWith("minitest") ||
          lower.startsWith("minitest np") ||
          lower.startsWith("viết tập") ||
          lower.startsWith("btvn");

        return (
          <p
            key={`${line}-${index}`}
            className={
              isAbsent
                ? "font-semibold text-red-600"
                : isAcademic
                  ? "font-medium text-sky-800"
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
    openGraph: {
      title,
      description,
      type: "article",
    },
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
          scheduleRules: {
            orderBy: { weekday: "asc" },
          },
        },
      },
      journal: {
        include: {
          entries: {
            include: {
              student: true,
              scores: true,
            },
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
        student: {
          enrollments: {
            some: {
              classId: classSession.classId,
            },
          },
        },
      },
    });

    if (!hasChildInClass) notFound();
  }

  const journal = classSession.journal;
  const enrollments = await prisma.enrollment.count({
    where: {
      classId: classSession.classId,
      status: "ACTIVE",
    },
  });

  const entries = [...journal.entries].sort((a, b) => a.student.fullName.localeCompare(b.student.fullName, "vi"));
  const allLabels = Array.from(new Set(entries.flatMap((entry) => entry.scores.map((score) => score.label))));
  const scoreColumns = allLabels.length ? allLabels : ["Điểm"];
  const homeworkLines = buildHomeworkLines(journal.homeworkNote);
  const weekday = WEEKDAY_LABEL[new Date(classSession.sessionDate).getDay()];
  const scheduleSummary = classSession.class.scheduleRules.length
    ? classSession.class.scheduleRules
        .map((rule) => {
          const weekdayLabel = WEEKDAY_LABEL[rule.weekday] ?? `Thứ ${rule.weekday}`;
          const roomPart = rule.room ? ` · ${rule.room}` : "";
          return `${weekdayLabel}: ${rule.startTime}-${rule.endTime}${roomPart}`;
        })
        .join(" | ")
    : "Chưa có lịch học chuẩn";

  return (
    <div className="mx-auto w-full max-w-[1180px] bg-slate-50 px-3 py-6 print:max-w-none print:bg-white print:px-0 print:py-0 sm:px-5">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Nhật ký lớp học</h1>
          <p className="text-sm text-slate-500">Bản in gửi phụ huynh và giáo viên theo đúng nội dung buổi học.</p>
        </div>
        <PrintButton label="In nhật ký" />
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-300 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)] print:rounded-none print:border-0 print:shadow-none">
        <div className="border-b border-slate-300 px-6 py-5 text-center sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            {classSession.class.branch.name}
          </p>
          <h2 className="mt-2 text-[30px] font-black uppercase tracking-[0.08em] text-slate-900">Nhật ký lớp học</h2>
          <p className="mt-1 text-sm text-slate-500">
            Ngày {formatDate(classSession.sessionDate)} · {weekday}
          </p>
        </div>

        <div className="grid gap-0 border-b border-slate-300 sm:grid-cols-4">
          <div className="border-b border-slate-200 px-5 py-4 sm:border-b-0 sm:border-r">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Cơ sở</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{classSession.class.branch.name}</p>
          </div>
          <div className="border-b border-slate-200 px-5 py-4 sm:border-b-0 sm:border-r">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Lớp</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{classSession.class.className}</p>
          </div>
          <div className="border-b border-slate-200 px-5 py-4 sm:border-b-0 sm:border-r">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Số học viên</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{enrollments}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Lịch học</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">{scheduleSummary}</p>
          </div>
        </div>

        <div className="border-b border-slate-300 bg-[#fef7d4] px-6 py-4 text-center sm:px-10">
          <p className="text-[15px] font-extrabold uppercase tracking-[0.22em] text-sky-900">
            {journal.unitLesson || "Chưa ghi unit / lesson cho buổi học này"}
          </p>
          {classSession.class.course?.name ? (
            <p className="mt-1 text-sm font-medium text-slate-600">{classSession.class.course.name}</p>
          ) : null}
        </div>

        <div className="px-4 py-5 sm:px-8">
          <div className="mb-4 border-b-2 border-slate-900 pb-2">
            <h3 className="text-lg font-black uppercase tracking-[0.08em] text-slate-900">II. Nhận xét của giáo viên</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#cfe8b4] text-slate-900">
                  <th rowSpan={2} className="border border-slate-500 px-3 py-3 text-center text-xs font-bold uppercase">
                    Mã HV
                  </th>
                  <th rowSpan={2} className="border border-slate-500 px-3 py-3 text-center text-xs font-bold uppercase">
                    Họ tên
                  </th>
                  <th
                    colSpan={scoreColumns.length}
                    className="border border-slate-500 px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.18em]"
                  >
                    Điểm
                  </th>
                  <th rowSpan={2} className="border border-slate-500 px-3 py-3 text-center text-xs font-bold uppercase">
                    BTVN
                  </th>
                  <th rowSpan={2} className="border border-slate-500 px-3 py-3 text-center text-xs font-bold uppercase">
                    Nhận xét
                  </th>
                  <th rowSpan={2} className="border border-slate-500 px-3 py-3 text-center text-xs font-bold uppercase">
                    Ghi chú
                  </th>
                </tr>
                <tr className="bg-[#eaf5dc] text-slate-700">
                  {scoreColumns.map((label) => (
                    <th key={label} className="border border-slate-500 px-2 py-2 text-center text-xs font-bold">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.length ? (
                  entries.map((entry) => {
                    const scoreMap = Object.fromEntries(entry.scores.map((score) => [score.label, score.score]));
                    const homeworkLate = entry.homeworkStatus === "Chưa nộp";

                    return (
                      <tr key={entry.id} className="align-top">
                        <td className="border border-slate-400 px-3 py-4 text-center text-[13px] font-medium text-slate-700">
                          {entry.student.studentCode || "-"}
                        </td>
                        <td className="border border-slate-400 bg-[#fff3c6] px-3 py-4 text-[14px] font-semibold text-slate-900">
                          <div>{entry.student.fullName}</div>
                          {entry.student.studentCode ? (
                            <div className="mt-1 text-xs font-medium text-slate-500">{entry.student.studentCode}</div>
                          ) : null}
                        </td>
                        {scoreColumns.map((label) => (
                          <td
                            key={`${entry.id}-${label}`}
                            className="border border-slate-400 px-3 py-4 text-center text-[18px] font-bold text-sky-800"
                          >
                            {scoreMap[label] ?? ""}
                          </td>
                        ))}
                        <td
                          className={`border border-slate-400 px-3 py-4 text-center text-[13px] font-bold ${
                            homeworkLate ? "text-red-600" : "text-slate-800"
                          }`}
                        >
                          {entry.homeworkStatus || ""}
                        </td>
                        <td className="border border-slate-400 px-3 py-4 align-top">
                          {formatTeacherComment(entry.comment) || (
                            <p className="text-[13px] italic text-slate-400">Chưa có nhận xét.</p>
                          )}
                        </td>
                        <td className="border border-slate-400 px-3 py-4 text-[13px] leading-6 text-slate-700">
                          {entry.notes || ""}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={scoreColumns.length + 5}
                      className="border border-slate-400 px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Chưa có dữ liệu nhật ký cho buổi học này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 border border-slate-300 bg-[#f7fbff]">
            <div className="border-b border-slate-300 bg-[#eef6ff] px-4 py-3">
              <p className="text-base font-black text-sky-900">
                Trung tâm xin nhờ bố mẹ nhắc các con làm bài tập về nhà như sau:
              </p>
            </div>
            <div className="px-4 py-4">
              {homeworkLines.length ? (
                <div className="space-y-1 text-[15px] font-medium leading-7 text-sky-900">
                  {homeworkLines.map((line, index) => (
                    <p key={`${line}-${index}`}>{line}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm italic text-slate-400">Chưa có dặn dò cuối buổi.</p>
              )}
              <p className="mt-4 text-[15px] font-bold text-sky-900">Trung tâm xin cảm ơn ạ!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
