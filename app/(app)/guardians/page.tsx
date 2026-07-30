import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import GuardiansTable from "@/components/guardians/GuardiansTable";
import ModuleActionHub from "@/components/navigation/ModuleActionHub";

const PAGE_SIZE = 20;

export default async function GuardiansPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; pageSize?: string };
}) {
  const user = await getCurrentUser();
  const userRole = user ? await getUserRole(user.id) : null;

  const q = searchParams.q?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = Number(searchParams.pageSize ?? PAGE_SIZE);

  const where = q
    ? {
        OR: [
          { fullName: { contains: q } },
          { phone: { contains: q } },
          { user: { email: { contains: q } } },
          { students: { some: { student: { fullName: { contains: q } } } } },
          { leads: { some: { leadCode: { contains: q } } } },
        ],
      }
    : {};

  const [guardians, total] = await Promise.all([
    prisma.guardian.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: true,
        leads: { select: { id: true, leadCode: true }, take: 2, orderBy: { createdAt: "desc" } },
        students: {
          include: {
            student: {
              include: {
                lead: true,
                enrollments: { include: { class: true }, orderBy: { enrollDate: "desc" }, take: 1 },
              },
            },
          },
          take: 2,
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        },
        _count: {
          select: { leads: true, students: true },
        },
      },
    }),
    prisma.guardian.count({ where }),
  ]);

  const studentIds = guardians.flatMap((guardian) => guardian.students.map((link) => link.student.id));
  const charges = studentIds.length
    ? await prisma.charge.findMany({
        where: { studentId: { in: studentIds } },
        select: { studentId: true, totalAmount: true, id: true },
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

  const normalizedGuardians = guardians.map((guardian) => {
    const children = guardian.students.map((link) => {
      const currentEnrollment = link.student.enrollments[0] ?? null;
      return {
        id: link.student.id,
        fullName: link.student.fullName,
        leadCode: link.student.lead?.leadCode ?? null,
        className: currentEnrollment?.class.className ?? null,
        outstanding: (chargeByStudent.get(link.student.id) ?? 0) - (paidByStudent.get(link.student.id) ?? 0),
      };
    });

    return {
      ...guardian,
      children,
      portalEmail: guardian.user?.email ?? null,
      portalActive: guardian.user?.isActive ?? false,
    };
  });

  const activePortalCount = normalizedGuardians.filter((guardian) => guardian.portalActive).length;
  const debtGuardianCount = normalizedGuardians.filter((guardian) => guardian.children?.some((child) => child.outstanding > 0)).length;
  const linkedStudentCount = normalizedGuardians.reduce((sum, guardian) => sum + (guardian._count?.students ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Quản lý phụ huynh</h1>
          <p className="page-subtitle">Danh sách và thông tin chi tiết của {total} phụ huynh</p>
        </div>
        {userRole !== "TEACHER" && (
          <Link href="/guardians/new" className="btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Thêm phụ huynh
          </Link>
        )}
      </div>

      <ModuleActionHub
        title="Phụ huynh là đầu mối nhận hóa đơn, nhắc phí và portal"
        subtitle="Đây là nơi quản lý mối liên hệ giữa lead, học viên và tài khoản portal để thông tin không bị lệch người nhận."
        actions={[
          { label: "Thêm phụ huynh", description: "Tạo hồ sơ thủ công khi cần bổ sung ngoài luồng CRM/intake.", href: "/guardians/new", tone: "primary" },
          { label: "Mở CRM tuyển sinh", description: "Quay lại lead nếu cần nối phụ huynh với một nhu cầu tuyển sinh mới.", href: "/leads", tone: "info" },
          { label: "Kiểm tra học phí", description: "Đi sang học phí để xử lý các phụ huynh có con đang còn nợ.", href: "/tuition", tone: "warning" },
        ]}
        metrics={[
          { label: "Tổng phụ huynh", value: total, hint: "Toàn bộ hồ sơ phụ huynh" },
          { label: "Portal hoạt động", value: activePortalCount, hint: "Đã đăng nhập/xài được", tone: "info" },
          { label: "HV liên kết", value: linkedStudentCount, hint: "Số liên kết phụ huynh–học viên", tone: "success" },
          { label: "Có công nợ", value: debtGuardianCount, hint: "Ít nhất 1 con đang còn nợ", tone: "danger" },
        ]}
      />

      <GuardiansTable
        initialData={normalizedGuardians}
        total={total}
        page={page}
        pageSize={pageSize}
        userRole={userRole || "TEACHER"}
      />
    </div>
  );
}
