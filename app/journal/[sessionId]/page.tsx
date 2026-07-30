import { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/components/PrintButton";

const WEEKDAY_LABEL = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("vi-VN");
}

// Open Graph tags — để khi dán link này vào Zalo/nhóm Zalo OA, tin nhắn tự hiện thẻ
// preview (tên lớp + ngày học) thay vì chỉ 1 link trần trụi, dễ nhận ra và dễ bấm vào hơn.
export async function generateMetadata({ params }: { params: { sessionId: string } }): Promise<Metadata> {
  const classSession = await prisma.classSession.findUnique({
    where: { id: params.sessionId },
    include: { class: { include: { branch: true } }, journal: true },
  });
  if (!classSession) return { title: "Nhật ký lớp học" };

  const dateLabel = formatDate(classSession.sessionDate);
  const title = `Nhật ký lớp học — ${classSession.class.className} — ${dateLabel}`;
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
      class: { include: { branch: true } },
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

  // Link này được gửi chung vào nhóm Zalo cả lớp (cả lớp cùng xem chung 1 bảng — theo
  // quyết định của Giám đốc), nhưng KHÔNG được để phụ huynh của LỚP KHÁC xem được nếu
  // vô tình có link — chỉ chặn người không liên quan, không chặn nhân sự.
  if (session.guardianId) {
    const hasChildInClass = await prisma.studentGuardian.findFirst({
      where: { guardianId: session.guardianId, student: { enrollments: { some: { classId: classSession.classId } } } },
    });
    if (!hasChildInClass) notFound();
  }

  const journal = classSession.journal;
  const enrollments = await prisma.enrollment.count({ where: { classId: classSession.classId, status: "ACTIVE" } });
  const entries = [...journal.entries].sort((a, b) => a.student.fullName.localeCompare(b.student.fullName, "vi"));
  const allLabels = Array.from(new Set(entries.flatMap((e) => e.scores.map((s) => s.label))));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">Nhật ký lớp học</h1>
        <PrintButton label="In nhật ký" />
      </div>

      <div className="rounded-xl border border-hairline bg-white p-8 print:border-0 print:p-0">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{classSession.class.branch.name}</p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">NHẬT KÝ LỚP HỌC</h2>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 border-y border-hairline py-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-ink-muted48">Cơ sở</p>
            <p className="font-medium">{classSession.class.branch.name}</p>
          </div>
          <div>
            <p className="text-ink-muted48">Lớp</p>
            <p className="font-medium">{classSession.class.className}</p>
          </div>
          <div>
            <p className="text-ink-muted48">Ngày</p>
            <p className="font-medium">
              {formatDate(classSession.sessionDate)} ({WEEKDAY_LABEL[new Date(classSession.sessionDate).getDay()]})
            </p>
          </div>
          <div>
            <p className="text-ink-muted48">Số HV</p>
            <p className="font-medium">{enrollments}</p>
          </div>
        </div>

        {journal.unitLesson && (
          <div className="mt-4 rounded-lg bg-primary/5 py-3 text-center">
            <p className="font-display text-lg font-bold tracking-tight text-primary">{journal.unitLesson}</p>
          </div>
        )}

        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-emerald-50 text-xs uppercase tracking-wide text-emerald-800">
                <th className="border border-emerald-100 px-3 py-2 font-semibold">Mã HV</th>
                <th className="border border-emerald-100 px-3 py-2 font-semibold">Họ tên</th>
                {allLabels.map((label) => (
                  <th key={label} className="border border-emerald-100 px-3 py-2 text-center font-semibold">
                    {label}
                  </th>
                ))}
                <th className="border border-emerald-100 px-3 py-2 text-center font-semibold">BTVN</th>
                <th className="border border-emerald-100 px-3 py-2 font-semibold">Nhận xét của giáo viên</th>
                <th className="border border-emerald-100 px-3 py-2 font-semibold">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const scoreByLabel = Object.fromEntries(e.scores.map((s) => [s.label, s]));
                return (
                  <tr key={e.id} className="align-top even:bg-[#fafbff]">
                    <td className="border border-hairline px-3 py-3 font-mono text-xs">{e.student.studentCode}</td>
                    <td className="border border-hairline px-3 py-3 font-semibold">{e.student.fullName}</td>
                    {allLabels.map((label) => (
                      <td key={label} className="border border-hairline px-3 py-3 text-center font-semibold">
                        {scoreByLabel[label]?.score ?? "—"}
                      </td>
                    ))}
                    <td className="border border-hairline px-3 py-3 text-center">
                      {e.homeworkStatus === "Chưa nộp" ? (
                        <span className="font-semibold text-red-600">{e.homeworkStatus}</span>
                      ) : (
                        e.homeworkStatus || "—"
                      )}
                    </td>
                    <td className="border border-hairline px-3 py-3 whitespace-pre-line text-ink-muted80">
                      {e.comment || "—"}
                    </td>
                    <td className="border border-hairline px-3 py-3 text-ink-muted48">{e.notes || ""}</td>
                  </tr>
                );
              })}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={allLabels.length + 5} className="border border-hairline px-3 py-6 text-center text-ink-muted48">
                    Chưa có nhận xét học viên nào cho buổi học này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {journal.homeworkNote && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 whitespace-pre-line">
            {journal.homeworkNote}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-ink-muted48">Trung tâm xin cảm ơn quý phụ huynh đã đồng hành cùng con!</p>
      </div>
    </div>
  );
}
