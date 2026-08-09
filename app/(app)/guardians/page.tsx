import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { getCurrentBranchId } from "@/lib/branch-filter";
import GuardiansTable from "@/components/guardians/GuardiansTable";
import NewGuardianButton from "@/components/guardians/NewGuardianButton";
import PageGuide from "@/components/ui/PageGuide";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";

const PAGE_SIZE = 20;

const GUARDIANS_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="guardians-table"]',
    title: "Công nợ tính gộp từ các con đang liên kết",
    description: "Chip \"Có công nợ\" và cột công nợ trong bảng đều cộng dồn từ TẤT CẢ học viên đang gắn với phụ huynh đó — không phải một khoản riêng của phụ huynh.",
    placement: "top",
  },
];
const GUARDIANS_PAGE_GUIDE_SECTIONS = [
  {
    title: "Mục tiêu trang này",
    items: [
      "Quản lý phụ huynh, tài khoản portal và học viên đang liên kết với từng phụ huynh.",
      "Theo dõi nhanh phụ huynh nào đã có portal, có học viên và đang có công nợ.",
      "Đi từ danh sách sang đúng hồ sơ để xử lý liên hệ, liên kết hoặc hỗ trợ portal.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách thao tác nhanh",
    items: [
      "Tìm theo tên phụ huynh, số điện thoại, email portal hoặc tên học viên liên kết.",
      "Nhìn nhanh danh sách con của từng phụ huynh để biết học viên nào đang gắn với người đó.",
      "Khi cần tạo mới, thêm phụ huynh trước rồi liên kết học viên sau để hồ sơ sạch hơn.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý vận hành",
    items: [
      "Một phụ huynh có thể gắn nhiều học viên nên luôn kiểm tra đúng người trước khi sửa.",
      "Công nợ ở đây là tổng hợp từ học viên liên kết, không phải khoản riêng độc lập của phụ huynh.",
      "Phụ huynh chưa gắn học viên vẫn có thể được tạo trước để phục vụ ghi danh sau.",
    ],
    tone: "warning" as const,
  },
];

export default async function GuardiansPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; pageSize?: string };
}) {
  const user = await getCurrentUser();
  const userRole = user ? await getUserRole(user.id) : null;
  const activeBranchId = await getCurrentBranchId();

  const q = searchParams.q?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = Number(searchParams.pageSize ?? PAGE_SIZE);

  // Guardian không có cột branchId riêng (dùng chung cho mọi cơ sở) — chỉ suy ra được
  // cơ sở qua lead/học viên đang liên kết. Phụ huynh chưa liên kết gì (mồ côi) không
  // thuộc cơ sở nào nên chỉ hiện ở chế độ "Tất cả cơ sở", không hiện khi đang xem
  // riêng 1 cơ sở cụ thể.
  const branchFilter = activeBranchId
    ? {
        OR: [
          { leads: { some: { branchId: activeBranchId } } },
          { students: { some: { student: { branchId: activeBranchId } } } },
        ],
      }
    : {};

  const searchFilter = q
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

  // branchFilter và searchFilter đều có thể tự khai báo "OR" riêng — gộp bằng AND để
  // 2 điều kiện không đè lên nhau (spread trực tiếp sẽ làm key "OR" sau ghi đè key
  // "OR" trước).
  const where = { AND: [branchFilter, searchFilter] };

  const [guardians, total, guardiansForStats] = await Promise.all([
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
          take: 3,
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        },
        _count: {
          select: { leads: true, students: true },
        },
      },
    }),
    prisma.guardian.count({ where }),
    prisma.guardian.findMany({
      where,
      select: {
        id: true,
        user: { select: { email: true, isActive: true } },
        students: { select: { studentId: true } },
      },
    }),
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

  const statStudentIds = [...new Set(guardiansForStats.flatMap((guardian) => guardian.students.map((link) => link.studentId)))];
  const statCharges = statStudentIds.length
    ? await prisma.charge.findMany({
        where: { studentId: { in: statStudentIds } },
        select: { id: true, studentId: true, totalAmount: true },
      })
    : [];
  const statAllocations = statCharges.length
    ? await prisma.paymentAllocation.findMany({
        where: { chargeId: { in: statCharges.map((charge) => charge.id) } },
        select: { chargeId: true, amount: true },
      })
    : [];

  const statChargeOwner = new Map(statCharges.map((charge) => [charge.id, charge.studentId]));
  const statChargeByStudent = new Map<string, number>();
  for (const charge of statCharges) {
    statChargeByStudent.set(charge.studentId, (statChargeByStudent.get(charge.studentId) ?? 0) + charge.totalAmount);
  }
  const statPaidByStudent = new Map<string, number>();
  for (const allocation of statAllocations) {
    const studentId = statChargeOwner.get(allocation.chargeId);
    if (!studentId) continue;
    statPaidByStudent.set(studentId, (statPaidByStudent.get(studentId) ?? 0) + allocation.amount);
  }

  const stats = {
    total,
    withPortal: guardiansForStats.filter((guardian) => Boolean(guardian.user?.email)).length,
    withStudents: guardiansForStats.filter((guardian) => guardian.students.length > 0).length,
    withDebt: guardiansForStats.filter((guardian) =>
      guardian.students.some((link) => (statChargeByStudent.get(link.studentId) ?? 0) - (statPaidByStudent.get(link.studentId) ?? 0) > 0),
    ).length,
    linkedStudents: statStudentIds.length,
  };

  return (
    <div className="space-y-6">
      <PageGuide
        title="Guide phụ huynh"
        summary="Hướng dẫn ngắn cách đọc portal, học viên liên kết và công nợ theo phụ huynh."
        sections={GUARDIANS_PAGE_GUIDE_SECTIONS}
        buttonLabel="Guide phụ huynh"
      />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="page-title">Quản lý phụ huynh</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SpotlightTour steps={GUARDIANS_TOUR_STEPS} />
          <Link href="/leads" className="btn-ghost">
            CRM
          </Link>
          <Link href="/tuition" className="btn-ghost">
            Học phí
          </Link>
          {userRole !== "TEACHER" ? <NewGuardianButton /> : null}
        </div>
      </div>

      <GuardiansTable
        initialData={normalizedGuardians}
        total={total}
        page={page}
        pageSize={pageSize}
        userRole={userRole || "TEACHER"}
        stats={stats}
      />
    </div>
  );
}
