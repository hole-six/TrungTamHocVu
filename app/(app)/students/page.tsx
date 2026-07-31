import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";
import StudentsTable from "./StudentsTable";
import ModuleActionHub from "@/components/navigation/ModuleActionHub";

const PAGE_SIZE = 20;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string; pageSize?: string };
}) {
  const user = await getCurrentUser();
  const userRole = user ? await getUserRole(user.id) : null;

  const q = searchParams.q?.trim() ?? "";
  const status = searchParams.status ?? "";
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = Number(searchParams.pageSize ?? PAGE_SIZE);

  const where = {
    ...(user?.branchId ? { branchId: user.branchId } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q } },
            { studentCode: { contains: q } },
            { studentDisplayId: { contains: q } },
            { phone: { contains: q } },
            { lead: { leadCode: { contains: q } } },
            { guardians: { some: { guardian: { fullName: { contains: q } } } } },
          ],
        }
      : {}),
  };

  const [items, total, grouped] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        lead: true,
        guardians: {
          include: { guardian: { include: { user: true } } },
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        },
        enrollments: {
          include: { class: true },
          orderBy: [{ status: "asc" }, { enrollDate: "desc" }],
        },
      },
    }),
    prisma.student.count({ where }),
    prisma.student.groupBy({
      by: ["status"],
      where: user?.branchId ? { branchId: user.branchId } : {},
      _count: { _all: true },
    }),
  ]);

  const studentIds = items.map((item) => item.id);
  const [chargeTotals, allocationTotals] = await Promise.all([
    prisma.charge.groupBy({
      by: ["studentId"],
      where: { studentId: { in: studentIds } },
      _sum: { totalAmount: true },
    }),
    prisma.paymentAllocation.groupBy({
      by: ["chargeId"],
      where: { charge: { studentId: { in: studentIds } } },
      _sum: { amount: true },
    }),
  ]);

  const chargeByStudent = new Map<string, number>();
  for (const row of chargeTotals) {
    chargeByStudent.set(row.studentId, row._sum.totalAmount ?? 0);
  }

  const chargeOwner = new Map<string, string>();
  const chargeRows = await prisma.charge.findMany({
    where: { studentId: { in: studentIds } },
    select: { id: true, studentId: true },
  });
  for (const row of chargeRows) {
    chargeOwner.set(row.id, row.studentId);
  }

  const paidByStudent = new Map<string, number>();
  for (const row of allocationTotals) {
    const studentId = chargeOwner.get(row.chargeId);
    if (!studentId) continue;
    paidByStudent.set(studentId, (paidByStudent.get(studentId) ?? 0) + (row._sum.amount ?? 0));
  }

  const normalizedItems = items.map((item) => {
    const primaryGuardian = item.guardians.find((guardianLink) => guardianLink.isPrimary)?.guardian ?? item.guardians[0]?.guardian ?? null;
    const currentEnrollment = item.enrollments.find((enrollment) => enrollment.status === "ACTIVE") ?? item.enrollments[0] ?? null;
    return {
      ...item,
      primaryGuardian,
      currentClassName: currentEnrollment?.class.className ?? null,
      currentClassCode: currentEnrollment?.class.classCode ?? null,
      leadCode: item.lead?.leadCode ?? null,
      outstanding: (chargeByStudent.get(item.id) ?? 0) - (paidByStudent.get(item.id) ?? 0),
      enrollmentsCount: item.enrollments.length,
    };
  });

  const stats = Object.fromEntries(grouped.map((row) => [row.status, row._count._all])) as Record<string, number>;
  const portalCount = normalizedItems.filter((item) => item.primaryGuardian?.user?.isActive).length;
  const debtCount = normalizedItems.filter((item) => (item.outstanding ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Quản lý học viên</h1>
          <p className="page-subtitle">Danh sách và thông tin chi tiết của {total} học viên</p>
        </div>
        {canCreate("students", userRole) ? (
          <Link href="/students/new" className="btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Thêm học viên
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Tổng học viên", value: total, tone: "text-slate-900", bg: "from-slate-50 to-white", filterStatus: null },
          { label: "Đang học", value: stats.ACTIVE ?? 0, tone: "text-emerald-700", bg: "from-emerald-50 to-white", filterStatus: "ACTIVE" },
          { label: "Đã nghỉ", value: stats.LEFT ?? 0, tone: "text-rose-700", bg: "from-rose-50 to-white", filterStatus: "LEFT" },
          { label: "Có portal phụ huynh", value: portalCount, tone: "text-sky-700", bg: "from-sky-50 to-white", filterStatus: undefined },
          { label: "Đang có công nợ", value: debtCount, tone: "text-amber-700", bg: "from-amber-50 to-white", filterStatus: undefined },
        ].map((card) => {
          const isFilterable = card.filterStatus !== undefined;
          const isActive = isFilterable && status === (card.filterStatus ?? "");
          const body = (
            <div
              className={`rounded-[26px] border bg-gradient-to-br ${card.bg} p-5 shadow-[0_20px_55px_-40px_rgba(15,23,42,0.45)] transition ${
                isActive ? "border-primary ring-2 ring-primary/20" : "border-[#e4ebf8]"
              } ${isFilterable ? "hover:-translate-y-0.5 hover:shadow-md" : ""}`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">{card.label}</p>
              <p className={`mt-3 text-3xl font-semibold tracking-tight ${card.tone}`}>{card.value}</p>
            </div>
          );
          return isFilterable ? (
            <Link key={card.label} href={card.filterStatus ? `/students?status=${card.filterStatus}` : "/students"} className="block">
              {body}
            </Link>
          ) : (
            <div key={card.label}>{body}</div>
          );
        })}
      </div>

      <ModuleActionHub
        title="Học viên là hồ sơ vận hành thật của trung tâm"
        subtitle="Từ đây người dùng cần tra thật nhanh học viên nào đang học lớp nào, nợ bao nhiêu và phụ huynh nào đang nhận hóa đơn."
        actions={[
          { label: "Thêm học viên", description: "Tạo mới hồ sơ học viên khi đi ngoài luồng intake hoặc cần nhập thủ công.", href: "/students/new", tone: "primary" },
          { label: "Mở lớp học", description: "Đi sang lớp để ghi danh, xem điểm danh và nhật ký buổi học.", href: "/classes", tone: "success" },
          { label: "Theo dõi học phí", description: "Mở công nợ và kỳ thu để xử lý học viên đang còn nợ.", href: "/tuition", tone: "warning" },
        ]}
      />

      <StudentsTable
        initialData={normalizedItems}
        total={total}
        page={page}
        pageSize={pageSize}
        userRole={userRole || "TEACHER"}
        searchQuery={q}
      />
    </div>
  );
}
