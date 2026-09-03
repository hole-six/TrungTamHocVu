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
  status?: string;
  type?: string;
  student?: string;
  availableFrom?: string;
  availableTo?: string;
};

async function getCreditRows(activeBranchId: string | null, statusFilter: string, typeFilter: string, studentFilter: string) {
  const credits = await prisma.sessionCredit.findMany({
    where: {
      origin: typeFilter ? typeFilter : { in: ["ABSENCE", "PAID_CATCHUP"] },
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
  const statusParam = searchParams.status ?? "AVAILABLE";
  const status = statusParam === "ALL" ? "" : statusParam;
  const type = searchParams.type ?? "";
  const student = searchParams.student?.trim() ?? "";
  const availableFrom = searchParams.availableFrom?.trim() ?? "";
  const availableTo = searchParams.availableTo?.trim() ?? "";
  let rows = await getCreditRows(activeBranchId, status, type, student);
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

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] p-4">
          <p className="text-xs font-bold uppercase text-[#1d4ed8]">Tổng credit</p>
          <p className="mt-2 text-2xl font-black text-[#0f1729]">{totalCredits}</p>
        </div>
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-4">
          <p className="text-xs font-bold uppercase text-[#b91c1c]">Còn phải xếp</p>
          <p className="mt-2 text-2xl font-black text-[#0f1729]">{availableCredits}</p>
        </div>
        <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-4">
          <p className="text-xs font-bold uppercase text-[#b45309]">Vắng cần bài</p>
          <p className="mt-2 text-2xl font-black text-[#0f1729]">{absenceNeedLesson}</p>
        </div>
        <div className="rounded-lg border border-[#bae6fd] bg-[#f0f9ff] p-4">
          <p className="text-xs font-bold uppercase text-[#0369a1]">Đầu khóa còn lại</p>
          <p className="mt-2 text-2xl font-black text-[#0f1729]">{paidCatchupRemaining}</p>
        </div>
      </div>

      {canUpdate("schedule", role) ? <SessionCreditsBulkAssign candidates={bulkAssignCandidates} /> : null}

      <CreditsTable initialData={rows} statusParam={statusParam} typeParam={type} studentParam={student} showConsumedColumn={showConsumedColumn} />
    </div>
  );
}
