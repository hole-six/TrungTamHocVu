import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import StudentsTable from "./StudentsTable";

const PAGE_SIZE = 20;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string; pageSize?: string };
}) {
  const user = await getCurrentUser();
  const userRole = user ? await getUserRole(user.id) : null;
  const activeBranchId = await getCurrentBranchId();

  const q = searchParams.q?.trim() ?? "";
  const status = searchParams.status ?? "";
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = Number(searchParams.pageSize ?? PAGE_SIZE);

  const where = {
    ...(activeBranchId ? { branchId: activeBranchId } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q } },
            { studentCode: { contains: q } },
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
      where: activeBranchId ? { branchId: activeBranchId } : {},
      _count: { _all: true },
    }),
  ]);

  const studentIds = items.map((item) => item.id);
  const [chargeRows, allocationTotals, bookIssueRows, studentMetaRows, availableSessionCreditRows] = await Promise.all([
    prisma.charge.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        id: true,
        studentId: true,
        totalAmount: true,
        tuitionAmount: true,
        materialsAmount: true,
        openingBalance: true,
        billingModel: true,
        billingPeriod: {
          select: {
            periodName: true,
            startDate: true,
          },
        },
      },
    }),
    prisma.paymentAllocation.groupBy({
      by: ["chargeId"],
      where: { charge: { studentId: { in: studentIds } } },
      _sum: { amount: true },
    }),
    prisma.bookIssue.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        studentId: true,
        amount: true,
        quantity: true,
        paymentStatus: true,
      },
    }),
    prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true,
        _count: {
          select: {
            charges: true,
            bookIssues: true,
            scholarships: true,
            adjustments: true,
          },
        },
      },
    }),
    prisma.sessionCredit.groupBy({
      by: ["studentId"],
      where: {
        studentId: { in: studentIds },
        status: "AVAILABLE",
      },
      _count: { _all: true },
    }),
  ]);

  const chargeByStudent = new Map<string, number>();
  const tuitionByStudent = new Map<string, number>();
  const materialsByStudent = new Map<string, number>();
  const openingBalanceByStudent = new Map<string, number>();
  const chargeOwner = new Map<string, string>();
  const latestPeriodByStudent = new Map<string, { periodName: string; startDate: Date }>();
  const billingModesByStudent = new Map<string, Set<string>>();
  for (const row of chargeRows) {
    chargeOwner.set(row.id, row.studentId);
    chargeByStudent.set(row.studentId, (chargeByStudent.get(row.studentId) ?? 0) + row.totalAmount);
    tuitionByStudent.set(row.studentId, (tuitionByStudent.get(row.studentId) ?? 0) + row.tuitionAmount);
    materialsByStudent.set(row.studentId, (materialsByStudent.get(row.studentId) ?? 0) + row.materialsAmount);
    openingBalanceByStudent.set(row.studentId, (openingBalanceByStudent.get(row.studentId) ?? 0) + row.openingBalance);
    const modes = billingModesByStudent.get(row.studentId) ?? new Set<string>();
    modes.add(row.billingModel);
    billingModesByStudent.set(row.studentId, modes);
    const latest = latestPeriodByStudent.get(row.studentId);
    if (!latest || row.billingPeriod.startDate > latest.startDate) {
      latestPeriodByStudent.set(row.studentId, { periodName: row.billingPeriod.periodName, startDate: row.billingPeriod.startDate });
    }
  }

  const paidByStudent = new Map<string, number>();
  const paidByCharge = new Map<string, number>();
  for (const row of allocationTotals) {
    paidByCharge.set(row.chargeId, row._sum.amount ?? 0);
    const studentId = chargeOwner.get(row.chargeId);
    if (!studentId) continue;
    paidByStudent.set(studentId, (paidByStudent.get(studentId) ?? 0) + (row._sum.amount ?? 0));
  }

  const unpaidChargeCountByStudent = new Map<string, number>();
  for (const charge of chargeRows) {
    const paid = paidByCharge.get(charge.id) ?? 0;
    if (charge.totalAmount - paid > 0) {
      unpaidChargeCountByStudent.set(charge.studentId, (unpaidChargeCountByStudent.get(charge.studentId) ?? 0) + 1);
    }
  }

  const bookIssueAmountByStudent = new Map<string, number>();
  const unpaidBookIssuesByStudent = new Map<string, number>();
  const bookIssueQuantityByStudent = new Map<string, number>();
  for (const issue of bookIssueRows) {
    bookIssueAmountByStudent.set(issue.studentId, (bookIssueAmountByStudent.get(issue.studentId) ?? 0) + issue.amount);
    bookIssueQuantityByStudent.set(issue.studentId, (bookIssueQuantityByStudent.get(issue.studentId) ?? 0) + issue.quantity);
    if (issue.paymentStatus !== "PAID") {
      unpaidBookIssuesByStudent.set(issue.studentId, (unpaidBookIssuesByStudent.get(issue.studentId) ?? 0) + 1);
    }
  }

  const studentMetaById = new Map(studentMetaRows.map((row) => [row.id, row._count]));
  const availableSessionCreditByStudent = new Map(
    availableSessionCreditRows.map((row) => [row.studentId, row._count._all]),
  );

  const normalizedItems = items.map((item) => {
    const primaryGuardian = item.guardians.find((guardianLink) => guardianLink.isPrimary)?.guardian ?? item.guardians[0]?.guardian ?? null;
    const currentEnrollment = item.enrollments.find((enrollment) => enrollment.status === "ACTIVE") ?? item.enrollments[0] ?? null;
    const counts = studentMetaById.get(item.id);
    return {
      ...item,
      primaryGuardian,
      currentClassName: currentEnrollment?.class.className ?? null,
      currentClassCode: currentEnrollment?.class.classCode ?? null,
      currentBillingModel: currentEnrollment?.billingModel ?? null,
      leadCode: item.lead?.leadCode ?? null,
      outstanding: (chargeByStudent.get(item.id) ?? 0) - (paidByStudent.get(item.id) ?? 0),
      totalCharged: chargeByStudent.get(item.id) ?? 0,
      totalPaid: paidByStudent.get(item.id) ?? 0,
      tuitionCharged: tuitionByStudent.get(item.id) ?? 0,
      materialsCharged: materialsByStudent.get(item.id) ?? 0,
      openingBalanceTotal: openingBalanceByStudent.get(item.id) ?? 0,
      unpaidChargeCount: unpaidChargeCountByStudent.get(item.id) ?? 0,
      latestChargePeriod: latestPeriodByStudent.get(item.id)?.periodName ?? null,
      billingModes: Array.from(billingModesByStudent.get(item.id) ?? []),
      bookIssueAmount: bookIssueAmountByStudent.get(item.id) ?? 0,
      unpaidBookIssueCount: unpaidBookIssuesByStudent.get(item.id) ?? 0,
      bookIssueQuantity: bookIssueQuantityByStudent.get(item.id) ?? 0,
      chargeCount: counts?.charges ?? 0,
      scholarshipCount: counts?.scholarships ?? 0,
      adjustmentCount: counts?.adjustments ?? 0,
      sessionCreditCount: availableSessionCreditByStudent.get(item.id) ?? 0,
      enrollmentsCount: item.enrollments.length,
    };
  });

  const stats = Object.fromEntries(grouped.map((row) => [row.status, row._count._all])) as Record<string, number>;
  const portalCount = normalizedItems.filter((item) => item.primaryGuardian?.user?.isActive).length;
  const debtCount = normalizedItems.filter((item) => (item.outstanding ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="page-title">Quản lý học viên</h1>
          <p className="page-subtitle">Theo dõi hồ sơ, học phí và lớp học của {total} học viên</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/classes" className="btn-primary">
            Lớp học
          </Link>
          <Link href="/tuition" className="btn-primary">
            Học phí
          </Link>
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
      </div>

      <StudentsTable
        initialData={normalizedItems}
        total={total}
        page={page}
        pageSize={pageSize}
        userRole={userRole || "TEACHER"}
        searchQuery={q}
        status={status}
        stats={{
          total,
          active: stats.ACTIVE ?? 0,
          left: stats.LEFT ?? 0,
          portal: portalCount,
          debt: debtCount,
        }}
      />
    </div>
  );
}
