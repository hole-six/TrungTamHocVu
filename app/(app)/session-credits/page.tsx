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
import CreditFilterChips, { type CreditStats } from "./CreditFilterChips";

type SearchParams = {
  status?: string;
  type?: string;
  student?: string;
  availableFrom?: string;
  availableTo?: string;
};

const CREDIT_ORIGINS = ["ABSENCE", "PAID_CATCHUP", "WEAK_STUDENT", "WITHDRAWAL_REMAINING"];

// Số cho hàng chip lọc — CỐ TÌNH đếm KHÔNG theo bộ lọc status/type đang chọn (chỉ theo
// chi nhánh). Nếu đếm trên `rows` đã lọc thì bấm vào 1 chip loại sẽ làm mọi chip còn lại
// tụt về 0, không còn biết các nhóm khác đang có bao nhiêu để mà bấm sang.
async function getCreditStats(activeBranchId: string | null): Promise<CreditStats> {
  const grouped = await prisma.sessionCredit.groupBy({
    by: ["origin", "status"],
    where: {
      origin: { in: CREDIT_ORIGINS },
      student: activeBranchId ? { branchId: activeBranchId } : {},
    },
    _count: { _all: true },
  });

  const countOf = (origin: string, status: string) =>
    grouped.find((item) => item.origin === origin && item.status === status)?._count._all ?? 0;
  const sumWhere = (predicate: (item: (typeof grouped)[number]) => boolean) =>
    grouped.filter(predicate).reduce((sum, item) => sum + item._count._all, 0);

  return {
    total: sumWhere(() => true),
    available: sumWhere((item) => item.status === "AVAILABLE"),
    consumed: sumWhere((item) => item.status === "CONSUMED"),
    // Chip theo loại đếm buổi CÒN PHẢI XẾP — con số thực sự cần hành động, giống ý
    // nghĩa của 4 ô thống kê cũ ("... còn lại"), không phải tổng mọi trạng thái.
    absence: countOf("ABSENCE", "AVAILABLE"),
    paidCatchup: countOf("PAID_CATCHUP", "AVAILABLE"),
    weakStudent: countOf("WEAK_STUDENT", "AVAILABLE"),
    withdrawalRemaining: countOf("WITHDRAWAL_REMAINING", "AVAILABLE"),
  };
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
  const statusParam = searchParams.status ?? "AVAILABLE";
  const status = statusParam === "ALL" ? "" : statusParam;
  const type = searchParams.type ?? "";
  const student = searchParams.student?.trim() ?? "";
  const availableFrom = searchParams.availableFrom?.trim() ?? "";
  const availableTo = searchParams.availableTo?.trim() ?? "";
  const [stats, initialRows] = await Promise.all([
    getCreditStats(activeBranchId),
    getCreditRows(activeBranchId, status, type, student),
  ]);
  let rows = initialRows;
  // availableCount là số tính SAU khi gộp nhóm (không phải cột thô) — lọc bằng JS ở
  // server sau khi đã có đủ rows, cùng cách "computed-filter" đang dùng ở /students.
  if (availableFrom) rows = rows.filter((row) => row.availableCount >= Number(availableFrom));
  if (availableTo) rows = rows.filter((row) => row.availableCount <= Number(availableTo));
  // Bộ lọc "Còn phải xếp" (mặc định) chỉ truy vấn credit AVAILABLE — với bộ lọc đó,
  // consumedSession không bao giờ tồn tại nên cột "Các ngày đã bổ trợ" chắc chắn luôn
  // rỗng ở mọi dòng. Ẩn hẳn cột này khi nó không thể có dữ liệu, thay vì hiện 1 cột
  // trống vô nghĩa xuyên suốt bảng — chỉ hiện khi bộ lọc có thể trả về credit đã dùng.
  const showConsumedColumn = status !== "AVAILABLE";

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
    <div className="space-y-4">
      <h1 className="text-xl font-black tracking-tight text-[#0f1729] sm:text-2xl">Bảng xử lý bổ trợ</h1>

      <CreditsTable
        initialData={rows}
        statusParam={statusParam}
        typeParam={type}
        studentParam={student}
        showConsumedColumn={showConsumedColumn}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            {canUpdate("students", role) ? <AddPaidCatchupForm /> : null}
            {canUpdate("schedule", role) ? <SessionCreditsBulkAssign candidates={bulkAssignCandidates} /> : null}
            <CreditFilterChips stats={stats} statusParam={statusParam} typeParam={type} />
          </div>
        }
      />
    </div>
  );
}
