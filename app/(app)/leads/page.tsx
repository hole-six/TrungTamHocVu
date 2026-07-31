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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {LEAD_STATUSES.map((item) => (
          <Link
            key={item}
            href={`/leads?status=${item}`}
            className={`card-sm text-center transition hover:border-primary hover:shadow-md ${
              status === item ? "border-primary ring-2 ring-primary/20 bg-primary/5" : ""
            }`}
          >
            <p className="font-display text-2xl font-semibold tracking-tight text-primary">{pipeline[item]}</p>
            <p className="mt-0.5 text-[11px] leading-tight text-ink-muted48">{LEAD_STATUS_LABEL[item]}</p>
          </Link>
        ))}
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
