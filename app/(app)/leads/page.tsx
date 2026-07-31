import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/server/lead-rules";
import { canCreate } from "@/lib/server/role-matrix";
import LeadsTable from "@/components/leads/LeadsTable";
import ModuleActionHub from "@/components/navigation/ModuleActionHub";

const PAGE_SIZE = 20;

export default async function LeadsPage({
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
            { leadCode: { contains: q } },
            { phone: { contains: q } },
            { guardian: { fullName: { contains: q } } },
            { student: { studentCode: { contains: q } } },
          ],
        }
      : {}),
  };

  const [items, total, byStatus] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        guardian: { include: { user: true } },
        interestedClass: true,
        placementTests: { orderBy: { createdAt: "desc" }, take: 1 },
        student: {
          include: {
            enrollments: { include: { class: true }, orderBy: { enrollDate: "desc" }, take: 1 },
          },
        },
      },
    }),
    prisma.lead.count({ where }),
    prisma.lead.groupBy({
      by: ["status"],
      where: user?.branchId ? { branchId: user.branchId } : {},
      _count: { _all: true },
    }),
  ]);

  const studentIds = items.flatMap((item) => (item.student ? [item.student.id] : []));
  const charges = studentIds.length
    ? await prisma.charge.findMany({
        where: { studentId: { in: studentIds } },
        select: { id: true, studentId: true, totalAmount: true },
      })
    : [];
  const allocations = charges.length
    ? await prisma.paymentAllocation.findMany({
        where: { chargeId: { in: charges.map((charge) => charge.id) } },
        select: { chargeId: true, amount: true },
      })
    : [];

  const chargeOwner = new Map(charges.map((charge) => [charge.id, charge.studentId]));
  const chargeByStudent = new Map<string, number>();
  for (const charge of charges) {
    chargeByStudent.set(charge.studentId, (chargeByStudent.get(charge.studentId) ?? 0) + charge.totalAmount);
  }
  const paidByStudent = new Map<string, number>();
  for (const allocation of allocations) {
    const studentId = chargeOwner.get(allocation.chargeId);
    if (!studentId) continue;
    paidByStudent.set(studentId, (paidByStudent.get(studentId) ?? 0) + allocation.amount);
  }

  const normalizedItems = items.map((item) => ({
    ...item,
    guardianName: item.guardian?.fullName ?? null,
    guardianPortalEmail: item.guardian?.user?.email ?? null,
    guardianPortalActive: item.guardian?.user?.isActive ?? false,
    convertedStudentCode: item.student?.studentDisplayId ?? item.student?.studentCode ?? null,
    convertedClassName: item.student?.enrollments[0]?.class.className ?? null,
    outstanding: item.student ? (chargeByStudent.get(item.student.id) ?? 0) - (paidByStudent.get(item.student.id) ?? 0) : null,
  }));

  const pipeline = Object.fromEntries(LEAD_STATUSES.map((item) => [item, 0])) as Record<string, number>;
  for (const row of byStatus) pipeline[row.status] = row._count._all;
  const pipelineCards: Array<{
    key: string;
    label: string;
    value: number;
    hint: string;
    accent: string;
    bg: string;
    ring: string;
  }> = [
    {
      key: "NEW",
      label: LEAD_STATUS_LABEL.NEW,
      value: pipeline.NEW ?? 0,
      hint: "Lead mới vào, cần chốt người phụ trách và nguồn đến.",
      accent: "text-sky-700",
      bg: "from-sky-50 via-white to-sky-100/70",
      ring: "ring-sky-200",
    },
    {
      key: "CONTACTING",
      label: LEAD_STATUS_LABEL.CONTACTING,
      value: pipeline.CONTACTING ?? 0,
      hint: "Đang gọi lại, nhắn tin hoặc tư vấn bước đầu.",
      accent: "text-cyan-700",
      bg: "from-cyan-50 via-white to-cyan-100/70",
      ring: "ring-cyan-200",
    },
    {
      key: "APPOINTED",
      label: LEAD_STATUS_LABEL.APPOINTED,
      value: pipeline.APPOINTED ?? 0,
      hint: "Đã hẹn test hoặc hẹn đến trung tâm.",
      accent: "text-violet-700",
      bg: "from-violet-50 via-white to-violet-100/70",
      ring: "ring-violet-200",
    },
    {
      key: "TESTED",
      label: LEAD_STATUS_LABEL.TESTED,
      value: pipeline.TESTED ?? 0,
      hint: "Đã có kết quả đầu vào, chờ chốt hướng học.",
      accent: "text-indigo-700",
      bg: "from-indigo-50 via-white to-indigo-100/70",
      ring: "ring-indigo-200",
    },
    {
      key: "QUALIFIED",
      label: LEAD_STATUS_LABEL.QUALIFIED,
      value: pipeline.QUALIFIED ?? 0,
      hint: "Đủ điều kiện đẩy sang intake và gắn lớp.",
      accent: "text-amber-700",
      bg: "from-amber-50 via-white to-amber-100/70",
      ring: "ring-amber-200",
    },
    {
      key: "UNQUALIFIED",
      label: LEAD_STATUS_LABEL.UNQUALIFIED,
      value: pipeline.UNQUALIFIED ?? 0,
      hint: "Chưa phù hợp, cần giữ ghi chú và hướng xử lý lại.",
      accent: "text-slate-700",
      bg: "from-slate-50 via-white to-slate-100/80",
      ring: "ring-slate-200",
    },
    {
      key: "ENROLLED",
      label: LEAD_STATUS_LABEL.ENROLLED,
      value: pipeline.ENROLLED ?? 0,
      hint: "Đã convert thành học viên thực tế.",
      accent: "text-emerald-700",
      bg: "from-emerald-50 via-white to-emerald-100/70",
      ring: "ring-emerald-200",
    },
    {
      key: "LOST",
      label: LEAD_STATUS_LABEL.LOST,
      value: pipeline.LOST ?? 0,
      hint: "Lead rơi rụng, cần nhìn lại nguyên nhân.",
      accent: "text-rose-700",
      bg: "from-rose-50 via-white to-rose-100/70",
      ring: "ring-rose-200",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Quản lý CRM tuyển sinh</h1>
          <p className="page-subtitle">Theo dõi và chuyển đổi {total} lead thành học viên</p>
        </div>
        {canCreate("leads", userRole) ? (
          <div className="flex items-center gap-3">
            <Link href="/leads/test-schedule" className="btn-ghost">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Danh sách test
            </Link>
            <Link href="/leads/intake" className="btn-ghost">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M19 8h4" />
                <path d="M21 6v4" />
              </svg>
              Đăng ký nhập học
            </Link>
            <Link href="/leads/new" className="btn-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Thêm lead
            </Link>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[30px] border border-[#dce7f7] bg-[linear-gradient(135deg,#f7fbff_0%,#eff6ff_52%,#ffffff_100%)] p-4 shadow-[0_24px_70px_-42px_rgba(14,116,144,0.22)] sm:p-5">
        <div className="flex flex-col gap-2 border-b border-[#e6edf8] px-1 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Pipeline CRM</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Thống kê lead theo từng chặng xử lý</h2>
            <p className="mt-1 text-sm text-ink-muted48">Bấm vào từng trạng thái để lọc nhanh danh sách CRM bên dưới. Khối này nên giúp nhìn ra ngay lead đang nghẽn ở đâu.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px] sm:grid-cols-3">
            <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted48">Tổng lead</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{total}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted48">Đủ điều kiện</p>
              <p className="mt-2 text-2xl font-semibold text-amber-700">{pipeline.QUALIFIED ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted48">Đã nhập học</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-700">{pipeline.ENROLLED ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {pipelineCards.map((item, index) => (
          <Link
            key={item.key}
            href={`/leads?status=${item.key}`}
            className={`group rounded-[26px] border border-white/80 bg-gradient-to-br ${item.bg} p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.4)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_-30px_rgba(14,116,144,0.28)] ${
              status === item.key ? `ring-2 ${item.ring} border-transparent shadow-[0_24px_55px_-30px_rgba(14,116,144,0.34)]` : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted48">Chặng {index + 1}</p>
                <p className="mt-2 text-base font-semibold text-ink">{item.label}</p>
              </div>
              <span className={`inline-flex rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold ${item.accent}`}>
                {total > 0 ? Math.round((item.value / total) * 100) : 0}%
              </span>
            </div>

            <div className="mt-5 flex items-end justify-between gap-3">
              <p className={`text-4xl font-semibold tracking-tight ${item.accent}`}>{item.value}</p>
              <span className={`text-xs font-semibold ${status === item.key ? item.accent : "text-ink-muted48"}`}>
                {status === item.key ? "Đang lọc" : "Bấm để lọc"}
              </span>
            </div>

            <p className="mt-3 min-h-[44px] text-sm leading-5 text-ink-muted64">{item.hint}</p>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/75">
              <div
                className={`h-full rounded-full transition-all ${status === item.key ? "opacity-100" : "opacity-80 group-hover:opacity-100"} ${
                  item.accent.includes("sky")
                    ? "bg-sky-500"
                    : item.accent.includes("cyan")
                      ? "bg-cyan-500"
                      : item.accent.includes("violet")
                        ? "bg-violet-500"
                        : item.accent.includes("indigo")
                          ? "bg-indigo-500"
                          : item.accent.includes("amber")
                            ? "bg-amber-500"
                            : item.accent.includes("slate")
                              ? "bg-slate-500"
                              : item.accent.includes("emerald")
                                ? "bg-emerald-500"
                                : "bg-rose-500"
                }`}
                style={{ width: `${total > 0 ? Math.max(8, Math.round((item.value / total) * 100)) : 8}%` }}
              />
            </div>
          </Link>
        ))}
      </div>
      </div>

      <ModuleActionHub
        title="CRM tuyển sinh dùng để nhận nhu cầu và đẩy sang nhập học thật"
        subtitle="Bấm đúng hành động theo vai trò: tạo lead mới, intake ghi danh, hoặc quay lại danh sách để xử lý pipeline và phụ huynh."
        actions={[
          { label: "Danh sách test", description: "Sổ hẹn test riêng — lịch hẹn, tình trạng test, cảnh báo ngày sắp tới.", href: "/leads/test-schedule", tone: "info" },
          { label: "Đăng ký nhập học", description: "Luồng mạnh nhất: tạo phụ huynh, học viên, lớp và portal trong một mạch.", href: "/leads/intake", tone: "primary" },
          { label: "Thêm lead mới", description: "Ghi nhận nhu cầu ban đầu khi phụ huynh vừa liên hệ trung tâm.", href: "/leads/new", tone: "success" },
        ]}
        metrics={[
          { label: "Tổng lead", value: total, hint: "Toàn bộ đầu mối đang theo dõi" },
          { label: "Đủ điều kiện", value: pipeline.QUALIFIED ?? 0, hint: "Có thể đẩy sang ghi danh", tone: "warning" },
          { label: "Đã nhập học", value: pipeline.ENROLLED ?? 0, hint: "Đã convert thành học viên", tone: "success" },
          { label: "Mất lead", value: pipeline.LOST ?? 0, hint: "Cần đọc lại lý do thất thoát", tone: "danger" },
        ]}
      />

      <LeadsTable
        initialData={normalizedItems}
        total={total}
        page={page}
        pageSize={pageSize}
        userRole={userRole || "RECEPTIONIST"}
        searchQuery={q}
      />
    </div>
  );
}
