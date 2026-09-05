import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate, canView } from "@/lib/server/role-matrix";
import { LEAD_STATUSES, LEAD_STATUS_FILTER_GROUPS } from "@/lib/server/lead-rules";
import { getCurrentBranchId } from "@/lib/branch-filter";
import LeadsTable from "@/components/leads/LeadsTable";
import PageGuide from "@/components/ui/PageGuide";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";
import NewLeadDrawer from "@/components/leads/NewLeadDrawer";

const PAGE_SIZE = 20;

function resolveLeadStatusFilter(status: string) {
  const group = LEAD_STATUS_FILTER_GROUPS.find((item) => item.key === status);
  if (group) return { status: { in: [...group.statuses] } };
  if ((LEAD_STATUSES as readonly string[]).includes(status)) return { status };
  return { status: { not: "ENROLLED" } };
}

const LEADS_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="leads-header"]',
    title: "CRM tuyển sinh — Lead khác Học viên",
    description: "Lead ở đây là hồ sơ CHƯA chính thức ghi danh. Khi chuyển thành học viên (trạng thái Đạt → Chuyển thành HV), hồ sơ sẽ chuyển hẳn sang module Học viên, mặc định ẩn khỏi danh sách CRM này.",
    placement: "bottom",
  },
  {
    target: '[data-tour="leads-filters"]',
    title: "Lọc theo trạng thái pipeline và lịch test",
    description: "3 chip \"Chưa hẹn/Sắp tới/Quá hạn\" lọc riêng theo lịch test đầu vào — kết hợp được với chip trạng thái pipeline ở trên để khoanh đúng nhóm cần gọi lại hôm nay.",
    placement: "bottom",
  },
  {
    target: '[data-tour="leads-table"]',
    title: "Đổi trạng thái ngay trên bảng, không cần mở chi tiết",
    description: "Nhãn \"Trùng SĐT\" cảnh báo lead có thể đã tồn tại — kiểm tra kỹ trước khi tạo hồ sơ mới hoặc chuyển đổi thành học viên.",
    placement: "top",
  },
];
const LEADS_PAGE_GUIDE_SECTIONS = [
  {
    title: "Mục tiêu trang này",
    items: [
      "Theo dõi lead tuyển sinh từ lúc mới vào đến khi test, chờ xếp lớp hoặc chuyển thành học viên.",
      "Nhìn nhanh trạng thái CRM để biết hồ sơ nào còn cần gọi lại, hẹn test hoặc chốt ghi danh.",
      "Từ danh sách chính có thể đi tiếp vào chi tiết lead để xử lý sâu hơn.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách thao tác nhanh",
    items: [
      "Dùng tìm kiếm để lọc theo tên, mã lead, số điện thoại hoặc phụ huynh.",
      "Dùng các dãy trạng thái để gom đúng nhóm cần xử lý trong ngày, ví dụ sắp test hoặc quá hạn.",
      "Chỉ chuyển trạng thái khi đã xử lý xong bước hiện tại để dashboard CRM không bị nhiễu.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý vận hành",
    items: [
      "Lead đã ghi danh nên theo dõi ở module học viên nhiều hơn, không nên tiếp tục xử lý như CRM mới.",
      "Các lead trùng số điện thoại cần kiểm tra kỹ trước khi tạo mới hoặc sửa trạng thái.",
      "Nếu một lead đã có test nhưng chưa rõ kết quả, hãy mở chi tiết để xem lịch test gần nhất trước.",
    ],
    tone: "warning" as const,
  },
];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    status?: string;
    testStatus?: string;
    urgent?: string;
    page?: string;
    pageSize?: string;
    leadCode?: string;
    name?: string;
    source?: string;
    phone?: string;
    meetFrom?: string;
    meetTo?: string;
    startFrom?: string;
    startTo?: string;
    notes?: string;
  };
}) {
  const user = await getCurrentUser();
  const userRole = user ? await getUserRole(user.id) : null;
  if (!user || !canView("leads", userRole)) notFound();
  const activeBranchId = await getCurrentBranchId();

  const q = searchParams.q?.trim() ?? "";
  const status = searchParams.status ?? "";
  const testStatus = searchParams.testStatus?.trim() ?? "";
  const urgent = searchParams.urgent?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = Number(searchParams.pageSize ?? PAGE_SIZE);
  // Lọc theo từng cột (hàng cố định dưới header bảng) — độc lập với ô tìm chung `q`.
  const leadCodeFilter = searchParams.leadCode?.trim() ?? "";
  const nameFilter = searchParams.name?.trim() ?? "";
  const sourceFilter = searchParams.source?.trim() ?? "";
  const phoneFilter = searchParams.phone?.trim() ?? "";
  const meetFrom = searchParams.meetFrom?.trim() ?? "";
  const meetTo = searchParams.meetTo?.trim() ?? "";
  const startFrom = searchParams.startFrom?.trim() ?? "";
  const startTo = searchParams.startTo?.trim() ?? "";
  const notesFilter = searchParams.notes?.trim() ?? "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soonBoundary = new Date(today);
  soonBoundary.setDate(soonBoundary.getDate() + 3);
  soonBoundary.setHours(23, 59, 59, 999);

  const where = {
    ...(activeBranchId ? { branchId: activeBranchId } : {}),
    // Lead đã "Đã ghi danh" (ENROLLED) đã có học viên thật, việc theo dõi tiếp thuộc
    // về module Học viên chứ không còn là việc CRM tuyển sinh nữa — mặc định ẩn khỏi
    // danh sách chính để ưu tiên các lead còn cần xử lý, vẫn xem được khi bấm rõ
    // ràng vào chip "Đã ghi danh" (status=ENROLLED).
    ...resolveLeadStatusFilter(status),
    ...(leadCodeFilter ? { leadCode: { contains: leadCodeFilter } } : {}),
    ...(nameFilter ? { fullName: { contains: nameFilter } } : {}),
    ...(sourceFilter ? { source: { contains: sourceFilter } } : {}),
    // Dùng AND lồng 1 OR riêng (không phải OR trần) — tránh đè lên OR của ô tìm chung
    // `q` phía dưới nếu cả 2 cùng có giá trị (2 key "OR" trần trong cùng object sẽ bị
    // ghi đè, chỉ còn cái sau).
    ...(phoneFilter ? { AND: [{ OR: [{ phone: { contains: phoneFilter } }, { secondaryPhone: { contains: phoneFilter } }] }] } : {}),
    ...(meetFrom || meetTo
      ? { meetDate: { ...(meetFrom ? { gte: new Date(meetFrom) } : {}), ...(meetTo ? { lte: new Date(meetTo) } : {}) } }
      : {}),
    ...(startFrom || startTo
      ? { expectedStartDate: { ...(startFrom ? { gte: new Date(startFrom) } : {}), ...(startTo ? { lte: new Date(startTo) } : {}) } }
      : {}),
    ...(notesFilter ? { notes: { contains: notesFilter } } : {}),
    ...(testStatus === "NONE" ? { placementTests: { none: {} } } : testStatus ? { placementTests: { some: { status: testStatus } } } : {}),
    ...(urgent === "overdue"
      ? { placementTests: { some: { status: "SCHEDULED", scheduledDate: { lt: today } } } }
      : urgent === "soon"
        ? { placementTests: { some: { status: "SCHEDULED", scheduledDate: { gte: today, lte: soonBoundary } } } }
        : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q } },
            { leadCode: { contains: q } },
            { phone: { contains: q } },
            { secondaryPhone: { contains: q } },
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
      where: activeBranchId ? { branchId: activeBranchId } : {},
      _count: { _all: true },
    }),
  ]);

  const statusCounts = Object.fromEntries(LEAD_STATUSES.map((item) => [item, 0])) as Record<string, number>;
  for (const row of byStatus) statusCounts[row.status] = row._count._all;
  const statusOptions = LEAD_STATUS_FILTER_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    count: group.statuses.reduce((sum, key) => sum + (statusCounts[key] ?? 0), 0),
  }));

  const branchLeadFilter = activeBranchId ? { branchId: activeBranchId } : {};
  const phones = [...new Set(items.flatMap((item) => [item.phone, item.secondaryPhone]).filter((phone): phone is string => !!phone))];
  const duplicatePhoneLeads = phones.length
    ? await prisma.lead.findMany({
        where: {
          OR: [{ phone: { in: phones } }, { secondaryPhone: { in: phones } }],
          id: { notIn: items.map((item) => item.id) },
        },
        select: { fullName: true, phone: true, secondaryPhone: true },
      })
    : [];

  const duplicatesByPhone = new Map<string, string[]>();
  for (const lead of duplicatePhoneLeads) {
    for (const phone of [lead.phone, lead.secondaryPhone]) {
      if (!phone) continue;
      duplicatesByPhone.set(phone, [...(duplicatesByPhone.get(phone) ?? []), lead.fullName]);
    }
  }

  const [missingTestCount, overdueCount, soonCount, classOptions] = await Promise.all([
    prisma.lead.count({
      where: {
        ...branchLeadFilter,
        status: { notIn: ["ENROLLED", "LOST"] },
        placementTests: { none: {} },
      },
    }),
    prisma.placementTest.count({
      where: { status: "SCHEDULED", scheduledDate: { lt: today }, lead: branchLeadFilter },
    }),
    prisma.placementTest.count({
      where: { status: "SCHEDULED", scheduledDate: { gte: today, lte: soonBoundary }, lead: branchLeadFilter },
    }),
    prisma.class.findMany({
      where: { ...branchLeadFilter, status: "ACTIVE" },
      select: { id: true, className: true },
      orderBy: { className: "asc" },
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

  const normalizedItems = items.map((item) => {
    const duplicatePhoneNames = new Set<string>();
    for (const phone of [item.phone, item.secondaryPhone]) {
      if (!phone) continue;
      for (const name of duplicatesByPhone.get(phone) ?? []) duplicatePhoneNames.add(name);
    }

    return {
      ...item,
      guardianName: item.guardian?.fullName ?? null,
      guardianPortalEmail: item.guardian?.user?.email ?? null,
      guardianPortalActive: item.guardian?.user?.isActive ?? false,
      convertedStudentCode: item.student?.studentCode ?? null,
      convertedClassName: item.student?.enrollments[0]?.class?.className ?? item.student?.enrollments[0]?.packageLabel ?? null,
      outstanding: item.student ? (chargeByStudent.get(item.student.id) ?? 0) - (paidByStudent.get(item.student.id) ?? 0) : null,
      hasStudent: !!item.student,
      latestTest: item.placementTests[0] ?? null,
      duplicatePhoneNames: [...duplicatePhoneNames],
      interestedClassId: item.interestedClass?.id ?? null,
      interestedClassName: item.interestedClass?.className ?? null,
    };
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageGuide
        title="Guide CRM tuyển sinh"
        summary="Cách đọc trạng thái lead, lọc đúng nhóm cần xử lý và tránh bỏ sót lịch test."
        sections={LEADS_PAGE_GUIDE_SECTIONS}
        buttonLabel="Guide CRM"
      />
      <div className="flex flex-col gap-3 sm:gap-4 xl:flex-row xl:items-start xl:justify-between" data-tour="leads-header">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-[#0f1729]">Quản lý CRM tuyển sinh</h1>
          <p className="mt-1 text-xs sm:text-sm text-[#64748b]">Theo dõi lead, lịch test và chuyển đổi {total} hồ sơ thành học viên</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <SpotlightTour steps={LEADS_TOUR_STEPS} />
          {canCreate("leads", userRole) ? <NewLeadDrawer classOptions={classOptions} /> : null}
        </div>
      </div>

      <LeadsTable
        initialData={normalizedItems}
        total={total}
        page={page}
        pageSize={pageSize}
        userRole={userRole || "RECEPTIONIST"}
        searchQuery={q}
        statusOptions={statusOptions}
        statusFilter={status}
        testStatusFilter={testStatus}
        urgentFilter={urgent}
        missingTestCount={missingTestCount}
        soonCount={soonCount}
        overdueCount={overdueCount}
        classOptions={classOptions}
        enrolledCount={statusCounts.ENROLLED ?? 0}
      />
    </div>
  );
}
