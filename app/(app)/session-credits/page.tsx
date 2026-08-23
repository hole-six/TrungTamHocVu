import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { getCurrentUser } from "@/lib/server/current-user";
import { canView, canUpdate } from "@/lib/server/role-matrix";
import { getUserRole } from "@/lib/permissions";
import { formatVnd } from "@/lib/export-utils";
import AddPaidCatchupForm from "@/components/session-credits/AddPaidCatchupForm";
import { resolveSourceLessonDetails } from "@/lib/server/session-credit-lessons";
import StudentLink from "@/components/students/StudentLink";
import SessionCreditsBulkAssign from "@/components/session-credits/SessionCreditsBulkAssign";

type SearchParams = {
  status?: string;
  type?: string;
};

type CreditRow = Awaited<ReturnType<typeof getCreditRows>>[number];

const TYPE_FILTERS = [
  { key: "", label: "Tất cả" },
  { key: "ABSENCE", label: "Bổ trợ vắng cần bài" },
  { key: "PAID_CATCHUP", label: "Bổ trợ đầu khóa" },
];

const STATUS_FILTERS = [
  { key: "AVAILABLE", label: "Còn phải xếp" },
  { key: "CONSUMED", label: "Đã bổ trợ" },
  { key: "ALL", label: "Tất cả trạng thái" },
];

function formatDate(date: Date | string | null | undefined) {
  return date ? new Date(date).toLocaleDateString("vi-VN") : "—";
}

function buildQuery(current: SearchParams, overrides: SearchParams) {
  const params = new URLSearchParams();
  const merged = { status: current.status ?? "AVAILABLE", type: current.type ?? "", ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (!value) continue;
    params.set(key, value);
  }
  return params.toString();
}

async function getCreditRows(activeBranchId: string | null, statusFilter: string, typeFilter: string) {
  const credits = await prisma.sessionCredit.findMany({
    where: {
      origin: typeFilter ? typeFilter : { in: ["ABSENCE", "PAID_CATCHUP"] },
      ...(statusFilter ? { status: statusFilter } : {}),
      student: activeBranchId ? { branchId: activeBranchId } : {},
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

  const lessonDetailByCreditId = await resolveSourceLessonDetails(credits);
  const grouped = new Map<string, typeof credits>();

  for (const credit of credits) {
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

function TypeBadge({ origin }: { origin: string }) {
  if (origin === "ABSENCE") {
    return <span className="inline-flex rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">Bổ trợ vắng cần bài</span>;
  }
  if (origin === "PAID_CATCHUP") {
    return <span className="inline-flex rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-bold text-sky-700">Bổ trợ đầu khóa</span>;
  }
  return <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600">{origin}</span>;
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
        active ? "border-primary bg-primary text-white" : "border-[#e5e7eb] bg-white text-[#475569] hover:border-primary/40 hover:bg-[#fafafa]"
      }`}
    >
      {children}
    </Link>
  );
}

function LessonList({ row }: { row: CreditRow }) {
  if (row.origin === "PAID_CATCHUP") {
    return <span className="text-xs text-[#64748b]">Không cần bài riêng. Xếp vào lớp bổ trợ đầu khóa theo nhu cầu nhập học.</span>;
  }

  if (row.sourceItems.length === 0) {
    return <span className="text-xs text-amber-700">Credit vắng chưa có buổi gốc. Cần kiểm tra lại enrollment.</span>;
  }

  return (
    <div className="space-y-1.5">
      {row.sourceItems.slice(0, 4).map((item) => (
        <div key={item.id} className="rounded-lg bg-[#fff7ed] px-2.5 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 font-bold text-[#9a3412]">
            <Link href={`/classes/${item.classId}/sessions/${item.id}`} className="underline underline-offset-2">
              {formatDate(item.date)}
            </Link>
            {item.sessionNumber ? <span>Buổi {item.sessionNumber}</span> : null}
          </div>
          <p className="mt-0.5 text-[#0f1729]">{item.lesson ?? "Chưa có bài trong nhật ký/roadmap"}</p>
          {item.objective ? <p className="mt-0.5 line-clamp-1 text-[#64748b]">{item.objective}</p> : null}
        </div>
      ))}
      {row.sourceItems.length > 4 ? <p className="text-[11px] font-semibold text-[#64748b]">+{row.sourceItems.length - 4} buổi cần bù khác</p> : null}
    </div>
  );
}

function ConsumedList({ row }: { row: CreditRow }) {
  if (row.consumedItems.length === 0) {
    return <span className="text-xs text-[#94a3b8]">Chưa bổ trợ buổi nào</span>;
  }

  return (
    <div className="space-y-1.5">
      {row.consumedItems.slice(0, 5).map((item) => (
        <div key={item.id} className="text-xs">
          <Link href={`/classes/${item.classId}/sessions/${item.id}`} className="font-bold text-[#1d4ed8] underline underline-offset-2">
            {formatDate(item.date)}
          </Link>
          <span className="text-[#64748b]"> · {item.className}</span>
        </div>
      ))}
      {row.consumedItems.length > 5 ? <p className="text-[11px] font-semibold text-[#64748b]">+{row.consumedItems.length - 5} ngày khác</p> : null}
    </div>
  );
}

function CreditTable({ rows, statusFilter }: { rows: CreditRow[]; statusFilter: string }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#e5e7eb] bg-white p-8 text-center">
        <p className="text-sm font-bold text-[#0f1729]">Không có học viên trong bộ lọc này</p>
        <p className="mt-1 text-xs text-[#64748b]">Khi điểm danh vắng hoặc bán bổ trợ đầu khóa, dữ liệu sẽ xuất hiện ở đây.</p>
      </div>
    );
  }

  // Bộ lọc "Còn phải xếp" (mặc định) chỉ truy vấn credit AVAILABLE — với bộ lọc đó,
  // consumedSession không bao giờ tồn tại nên cột "Các ngày đã bổ trợ" chắc chắn luôn
  // rỗng ở mọi dòng. Ẩn hẳn cột này khi nó không thể có dữ liệu, thay vì hiện 1 cột
  // trống vô nghĩa xuyên suốt bảng — chỉ hiện khi bộ lọc có thể trả về credit đã dùng.
  const showConsumedColumn = statusFilter !== "AVAILABLE";

  return (
    <div className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-white shadow-sm">
      <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <table className={`${showConsumedColumn ? "min-w-[1100px]" : "min-w-[900px]"} w-full bg-white`}>
          <thead className="border-b border-[#e5e7eb] bg-white">
            <tr>
              <th className="w-[200px] px-6 py-3 text-left text-xs font-bold uppercase text-[#111827]">Học viên</th>
              <th className="w-[180px] px-6 py-3 text-left text-xs font-bold uppercase text-[#111827]">Loại bổ trợ</th>
              <th className="w-[100px] px-6 py-3 text-center text-xs font-bold uppercase text-[#111827]">Số buổi</th>
              <th className="w-[100px] px-6 py-3 text-center text-xs font-bold uppercase text-[#111827]">Còn lại</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase text-[#111827]">Bài/ngày cần bù</th>
              {showConsumedColumn ? <th className="px-6 py-3 text-left text-xs font-bold uppercase text-[#111827]">Các ngày đã bổ trợ</th> : null}
              <th className="w-[140px] px-6 py-3 text-right text-xs font-bold uppercase text-[#111827]">Tác vụ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f3f4f6] bg-white">
            {rows.map((row) => (
              <tr key={row.key} className="align-top transition-colors hover:bg-[#fafafa]">
                <td className="w-[200px] px-6 py-4">
                  <StudentLink studentId={row.student.id} className="font-black text-[#0f1729] hover:text-[#1d4ed8]">
                    {row.student.fullName}
                  </StudentLink>
                  <p className="mt-0.5 text-xs font-semibold text-[#64748b]">{row.student.studentCode}</p>
                  <Link href={`/classes/${row.enrollment.classId}`} className="mt-2 inline-flex text-xs font-bold text-[#1d4ed8] underline underline-offset-2">
                    {row.enrollment.class.className}
                  </Link>
                </td>
                <td className="w-[180px] px-6 py-4">
                  <TypeBadge origin={row.origin} />
                  {row.paidAmount > 0 ? <p className="mt-2 text-xs font-bold text-[#0f766e]">Đã tính phí {formatVnd(row.paidAmount)}</p> : null}
                  {row.notes ? <p className="mt-2 line-clamp-2 text-xs text-[#64748b]">{row.notes}</p> : null}
                </td>
                <td className="w-[100px] px-6 py-4 text-center">
                  <p className="text-lg font-black text-[#0f1729]">{row.totalCount}</p>
                  <p className="text-[11px] text-[#64748b]">Đã dùng {row.consumedCount}</p>
                </td>
                <td className="w-[100px] px-6 py-4 text-center">
                  <p className={`text-lg font-black ${row.availableCount > 0 ? "text-[#dc2626]" : "text-[#059669]"}`}>{row.availableCount}</p>
                  {row.voidedCount > 0 ? <p className="text-[11px] text-[#94a3b8]">Hủy {row.voidedCount}</p> : null}
                </td>
                <td className="px-6 py-4">
                  <LessonList row={row} />
                </td>
                {showConsumedColumn ? (
                  <td className="px-6 py-4">
                    <ConsumedList row={row} />
                  </td>
                ) : null}
                <td className="w-[140px] px-6 py-4 text-right">
                  <div className="flex flex-col items-end gap-2">
                    <StudentLink studentId={row.student.id} className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-3 py-1.5 text-xs font-bold text-[#1d4ed8] hover:bg-[#dbeafe]">
                      Mở học viên
                    </StudentLink>
                    <Link href={`/classes/${row.enrollment.classId}`} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-bold text-[#475569] hover:bg-[#fafafa]">
                      Mở lớp gốc
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function SessionCreditsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!user || (!canView("students", role) && !canView("schedule", role) && !canView("leads", role))) notFound();

  const activeBranchId = await getCurrentBranchId();
  const status = searchParams.status === "ALL" ? "" : searchParams.status ?? "AVAILABLE";
  const type = searchParams.type ?? "";
  const rows = await getCreditRows(activeBranchId, status, type);

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

      <div className="flex flex-col gap-3 rounded-lg border border-[#e5e7eb] bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase text-[#64748b]">Trạng thái</span>
          {STATUS_FILTERS.map((item) => (
            <FilterLink key={item.key} href={`/session-credits?${buildQuery({ status, type }, { status: item.key })}`} active={item.key === "ALL" ? !status : status === item.key}>
              {item.label}
            </FilterLink>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase text-[#64748b]">Loại bổ trợ</span>
          {TYPE_FILTERS.map((item) => (
            <FilterLink key={item.key || "ALL"} href={`/session-credits?${buildQuery({ status, type }, { type: item.key })}`} active={type === item.key}>
              {item.label}
            </FilterLink>
          ))}
        </div>
      </div>

      {canUpdate("schedule", role) ? <SessionCreditsBulkAssign candidates={bulkAssignCandidates} /> : null}

      <CreditTable rows={rows} statusFilter={status} />
    </div>
  );
}
