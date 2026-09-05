import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { getCurrentUser } from "@/lib/server/current-user";
import { canView, canUpdate } from "@/lib/server/role-matrix";
import { getUserRole } from "@/lib/permissions";
import AddPaidCatchupForm from "@/components/session-credits/AddPaidCatchupForm";
import { resolveSourceLessonDetails } from "@/lib/server/session-credit-lessons";
import SessionCreditsBulkAssign from "@/components/session-credits/SessionCreditsBulkAssign";
import CreditsTable from "./CreditsTable";

type SearchParams = {
  view?: string;
  status?: string;
  type?: string;
  student?: string;
  availableFrom?: string;
  availableTo?: string;
};

// "Bổ trợ theo ngày" — feedback khách: "đây chỉ là bảng thống kê, chưa phải danh
// sách theo ngày, điểm danh đã đi học bổ trợ theo ngày ở đâu?". Trước đây không có
// view nào liệt kê theo NGÀY cụ thể học viên nào đã bổ trợ — chỉ có tổng hợp theo
// học viên. Dùng đúng dữ liệu đã có (SessionCredit.status=CONSUMED, tự set khi điểm
// danh buổi bù — xem app/api/sessions/[id]/attendance/route.ts), nhóm theo ngày của
// buổi học bù (consumedSession.sessionDate).
async function getDailyRemedialLog(activeBranchId: string | null) {
  const credits = await prisma.sessionCredit.findMany({
    where: {
      status: "CONSUMED",
      consumedSessionId: { not: null },
      student: activeBranchId ? { branchId: activeBranchId } : {},
    },
    include: {
      student: { select: { id: true, fullName: true, studentCode: true } },
      consumedSession: { include: { class: { select: { className: true } }, journal: true } },
    },
    orderBy: { consumedAt: "desc" },
    take: 300,
  });

  const rows = credits
    .filter((credit) => credit.consumedSession && credit.student)
    .map((credit) => ({
      id: credit.id,
      date: credit.consumedSession!.sessionDate,
      studentName: credit.student!.fullName,
      studentCode: credit.student!.studentCode,
      className: credit.consumedSession!.class.className,
      lesson: credit.consumedSession!.journal?.unitLesson ?? credit.notes ?? "—",
    }));

  const byDay = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = new Date(row.date).toLocaleDateString("vi-VN");
    byDay.set(key, [...(byDay.get(key) ?? []), row]);
  }
  return [...byDay.entries()];
}

async function getCreditRows(activeBranchId: string | null, statusFilter: string, typeFilter: string, studentFilter: string) {
  const credits = await prisma.sessionCredit.findMany({
    where: {
      // WITHDRAWAL_REMAINING (số dư chuyển từ lớp cũ khi rút/lớp tự kết thúc) PHẢI có
      // trong mặc định — trước đây bị loại khỏi đây nên nhân viên không cách nào tự
      // tìm ra khoản này qua trang danh sách, chỉ thấy nếu mở đúng hồ sơ học viên đó.
      origin: typeFilter ? typeFilter : { in: ["ABSENCE", "PAID_CATCHUP", "WEAK_STUDENT", "WITHDRAWAL_REMAINING"] },
      ...(statusFilter ? { status: statusFilter } : {}),
      student: {
        ...(activeBranchId ? { branchId: activeBranchId } : {}),
        ...(studentFilter ? { OR: [{ fullName: { contains: studentFilter } }, { studentCode: { contains: studentFilter } }] } : {}),
      },
    },
    include: {
      student: true,
      enrollment: {
        include: {
          class: { include: { course: true } },
        },
      },
      sourceSession: {
        include: {
          class: true,
          journal: true,
        },
      },
      consumedSession: {
        include: {
          class: true,
          journal: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 500,
  });

  // enrollment/student là quan hệ bắt buộc trong schema, nhưng Prisma include không
  // tự kiểm tra khóa ngoại còn hợp lệ hay không ở tầng ứng dụng — dữ liệu cũ có thể có
  // session_credits trỏ tới 1 enrollment_id/student_id đã không còn tồn tại (sửa dữ
  // liệu tay ngoài Prisma trước đây, xem ghi chú migrations ở CLAUDE.md). Lọc bỏ và
  // cảnh báo thay vì để 1 dòng hỏng làm sập toàn bộ trang cho các dòng còn lại.
  const validCredits = credits.filter((credit) => credit.enrollment !== null && credit.student !== null);
  if (validCredits.length !== credits.length) {
    console.warn(
      "[session-credits] Bỏ qua session credit có enrollment/student không hợp lệ:",
      credits.filter((credit) => credit.enrollment === null || credit.student === null).map((credit) => credit.id),
    );
  }

  const lessonDetailByCreditId = await resolveSourceLessonDetails(validCredits);
  const grouped = new Map<string, typeof validCredits>();

  for (const credit of validCredits) {
    const key = `${credit.studentId}:${credit.enrollmentId}:${credit.origin}`;
    grouped.set(key, [...(grouped.get(key) ?? []), credit]);
  }

  return [...grouped.values()].map((items) => {
    const first = items[0];
    const sourceItems = items
      .filter((credit) => credit.sourceSession && lessonDetailByCreditId.has(credit.id))
      .map((credit) => ({
        ...lessonDetailByCreditId.get(credit.id)!,
        status: credit.status,
      }));

    const consumedItems = items
      .filter((credit) => credit.consumedSession)
      .map((credit) => ({
        id: credit.consumedSession!.id,
        classId: credit.consumedSession!.classId,
        className: credit.consumedSession!.class.className,
        date: credit.consumedSession!.sessionDate,
        note: credit.consumedSession!.journal?.unitLesson ?? credit.notes ?? null,
      }));

    return {
      key: `${first.studentId}:${first.enrollmentId}:${first.origin}`,
      origin: first.origin,
      student: first.student,
      enrollment: first.enrollment,
      totalCount: items.length,
      availableCount: items.filter((credit) => credit.status === "AVAILABLE").length,
      consumedCount: items.filter((credit) => credit.status === "CONSUMED").length,
      voidedCount: items.filter((credit) => credit.status === "VOIDED").length,
      paidAmount: items.reduce((sum, credit) => sum + credit.paidAmount, 0),
      sourceItems,
      consumedItems,
      latestCreatedAt: items.reduce((latest, credit) => (credit.createdAt > latest ? credit.createdAt : latest), items[0].createdAt),
      notes: items.map((credit) => credit.notes).filter(Boolean).join(" | "),
    };
  });
}

export default async function SessionCreditsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!user || (!canView("students", role) && !canView("schedule", role) && !canView("leads", role))) notFound();

  const activeBranchId = await getCurrentBranchId();
  const view = searchParams.view === "daily" ? "daily" : "stats";
  const statusParam = searchParams.status ?? "AVAILABLE";
  const status = statusParam === "ALL" ? "" : statusParam;
  const type = searchParams.type ?? "";
  const student = searchParams.student?.trim() ?? "";
  const availableFrom = searchParams.availableFrom?.trim() ?? "";
  const availableTo = searchParams.availableTo?.trim() ?? "";
  const dailyLog = view === "daily" ? await getDailyRemedialLog(activeBranchId) : [];
  let rows = view === "stats" ? await getCreditRows(activeBranchId, status, type, student) : [];
  // availableCount là số tính SAU khi gộp nhóm (không phải cột thô) — lọc bằng JS ở
  // server sau khi đã có đủ rows, cùng cách "computed-filter" đang dùng ở /students.
  if (availableFrom) rows = rows.filter((row) => row.availableCount >= Number(availableFrom));
  if (availableTo) rows = rows.filter((row) => row.availableCount <= Number(availableTo));
  // Bộ lọc "Còn phải xếp" (mặc định) chỉ truy vấn credit AVAILABLE — với bộ lọc đó,
  // consumedSession không bao giờ tồn tại nên cột "Các ngày đã bổ trợ" chắc chắn luôn
  // rỗng ở mọi dòng. Ẩn hẳn cột này khi nó không thể có dữ liệu, thay vì hiện 1 cột
  // trống vô nghĩa xuyên suốt bảng — chỉ hiện khi bộ lọc có thể trả về credit đã dùng.
  const showConsumedColumn = status !== "AVAILABLE";

  const totalCredits = rows.reduce((sum, row) => sum + row.totalCount, 0);
  const availableCredits = rows.reduce((sum, row) => sum + row.availableCount, 0);
  const absenceNeedLesson = rows.filter((row) => row.origin === "ABSENCE").reduce((sum, row) => sum + row.availableCount, 0);
  const paidCatchupRemaining = rows.filter((row) => row.origin === "PAID_CATCHUP").reduce((sum, row) => sum + row.availableCount, 0);
  const weakStudentRemaining = rows.filter((row) => row.origin === "WEAK_STUDENT").reduce((sum, row) => sum + row.availableCount, 0);
  const withdrawalRemaining = rows.filter((row) => row.origin === "WITHDRAWAL_REMAINING").reduce((sum, row) => sum + row.availableCount, 0);

  // Gộp theo học viên (1 học viên có thể xuất hiện ở nhiều dòng khác nhau — vd vừa có
  // credit ABSENCE vừa có PAID_CATCHUP) để form xếp hàng loạt không hiện trùng 1 người
  // 2 lần với 2 số buổi khả dụng lệch nhau.
  const bulkAssignCandidates = Object.values(
    rows
      .filter((row) => row.availableCount > 0)
      .reduce<Record<string, { id: string; fullName: string; studentCode: string; availableCredits: number }>>((acc, row) => {
        const existing = acc[row.student.id];
        acc[row.student.id] = {
          id: row.student.id,
          fullName: row.student.fullName,
          studentCode: row.student.studentCode,
          availableCredits: (existing?.availableCredits ?? 0) + row.availableCount,
        };
        return acc;
      }, {}),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#0f1729]">Bảng xử lý bổ trợ</h1>
          <p className="mt-1 max-w-3xl text-sm text-[#64748b]">
            Gom học viên bổ trợ vắng cần bài và bổ trợ đầu khóa vào một nơi để CSO biết còn bao nhiêu buổi, đã bù ngày nào và phải mở đúng hồ sơ/lớp nào.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canUpdate("students", role) ? <AddPaidCatchupForm /> : null}
          <Link href="/students" className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-bold text-[#0f1729] hover:bg-[#fafafa]">
            Danh sách học viên
          </Link>
        </div>
      </div>

      {/* 2 sheet tách bạch đúng feedback: "Thống kê" (tổng hợp theo học viên) khác
          "Theo ngày" (điểm danh bổ trợ theo NGÀY cụ thể) — trước đây chỉ có 1 view
          tổng hợp, không có cách nào xem "hôm nay ai đã bổ trợ". */}
      <div className="flex gap-2 border-b border-[#e5e7eb]">
        <Link
          href="/session-credits"
          className={`border-b-2 px-3 py-2 text-sm font-bold ${view === "stats" ? "border-[#0f1729] text-[#0f1729]" : "border-transparent text-[#94a3b8] hover:text-[#475569]"}`}
        >
          Thống kê bổ trợ
        </Link>
        <Link
          href="/session-credits?view=daily"
          className={`border-b-2 px-3 py-2 text-sm font-bold ${view === "daily" ? "border-[#0f1729] text-[#0f1729]" : "border-transparent text-[#94a3b8] hover:text-[#475569]"}`}
        >
          Bổ trợ theo ngày
        </Link>
      </div>

      {view === "stats" ? (
        <>
          <div className="grid gap-3 md:grid-cols-6">
            <div className="rounded-lg border border-[#e5eaf7] bg-white p-4">
              <p className="text-xs font-bold uppercase text-[#64748b]">Tổng credit</p>
              <p className="mt-2 text-2xl font-black text-[#0f1729]">{totalCredits}</p>
            </div>
            <div className="rounded-lg border border-[#e5eaf7] bg-white p-4">
              <p className="text-xs font-bold uppercase text-[#64748b]">Còn phải xếp</p>
              <p className="mt-2 text-2xl font-black text-[#ef4444]">{availableCredits}</p>
            </div>
            <div className="rounded-lg border border-[#e5eaf7] bg-white p-4">
              <p className="text-xs font-bold uppercase text-[#64748b]">Vắng cần bài</p>
              <p className="mt-2 text-2xl font-black text-[#0f1729]">{absenceNeedLesson}</p>
            </div>
            <div className="rounded-lg border border-[#e5eaf7] bg-white p-4">
              <p className="text-xs font-bold uppercase text-[#64748b]">Đầu khóa còn lại</p>
              <p className="mt-2 text-2xl font-black text-[#0f1729]">{paidCatchupRemaining}</p>
            </div>
            <div className="rounded-lg border border-[#e5eaf7] bg-white p-4">
              <p className="text-xs font-bold uppercase text-[#64748b]">HS yếu còn lại</p>
              <p className="mt-2 text-2xl font-black text-[#0f1729]">{weakStudentRemaining}</p>
            </div>
            <div className="rounded-lg border border-[#e5eaf7] bg-white p-4">
              <p className="text-xs font-bold uppercase text-[#64748b]">Số dư từ lớp cũ</p>
              <p className="mt-2 text-2xl font-black text-[#0f1729]">{withdrawalRemaining}</p>
            </div>
          </div>

          {canUpdate("schedule", role) ? <SessionCreditsBulkAssign candidates={bulkAssignCandidates} /> : null}

          <CreditsTable initialData={rows} statusParam={statusParam} typeParam={type} studentParam={student} showConsumedColumn={showConsumedColumn} />
        </>
      ) : (
        <div className="space-y-4">
          {dailyLog.length === 0 && (
            <p className="rounded-lg border border-[#e5eaf7] bg-white p-6 text-center text-sm text-[#94a3b8]">
              Chưa có buổi bổ trợ nào được điểm danh.
            </p>
          )}
          {dailyLog.map(([day, entries]) => (
            <div key={day} className="rounded-lg border border-[#e5eaf7] bg-white p-4">
              <p className="mb-3 text-sm font-black text-[#0f1729]">{day}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs font-bold uppercase text-[#64748b]">
                      <th className="py-1.5 pr-4">Học viên</th>
                      <th className="py-1.5 pr-4">Lớp</th>
                      <th className="py-1.5 pr-4">Bài bổ trợ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-t border-[#f1f5f9]">
                        <td className="py-1.5 pr-4 font-semibold text-[#0f1729]">
                          {entry.studentName} <span className="font-mono text-xs text-[#94a3b8]">{entry.studentCode}</span>
                        </td>
                        <td className="py-1.5 pr-4 text-[#475569]">{entry.className}</td>
                        <td className="py-1.5 pr-4 text-[#475569]">{entry.lesson}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
