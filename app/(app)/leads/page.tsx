import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate, canView } from "@/lib/server/role-matrix";
import { LEAD_STATUSES, LEAD_STATUS_FILTER_GROUPS, LEAD_SUB_STATUS, dayBounds, startOfToday } from "@/lib/server/lead-rules";
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
    title: "Data tuyển sinh — khác Học viên",
    description: "Lead ở đây là hồ sơ CHƯA chính thức ghi danh. Khi chuyển thành học viên (trạng thái Đạt → Chuyển thành HV), hồ sơ sẽ chuyển hẳn sang module Học viên, mặc định ẩn khỏi Data tuyển sinh.",
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
      "Theo dõi data tuyển sinh từ lúc mới vào đến khi test, chờ xếp lớp hoặc chuyển thành học viên.",
      "Nhìn nhanh trạng thái để biết hồ sơ nào còn cần gọi lại, hẹn test hoặc chốt ghi danh.",
      "Từ danh sách chính có thể đi tiếp vào chi tiết lead để xử lý sâu hơn.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách thao tác nhanh",
    items: [
      "Dùng tìm kiếm để lọc theo tên, mã lead, số điện thoại hoặc phụ huynh.",
      "Dùng các dãy trạng thái để gom đúng nhóm cần xử lý trong ngày, ví dụ sắp test hoặc quá hạn.",
      "Chỉ chuyển trạng thái khi đã xử lý xong bước hiện tại để số liệu tuyển sinh không bị nhiễu.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý vận hành",
    items: [
      "Hồ sơ đã nhập học nên theo dõi ở module học viên, không tiếp tục xử lý như data mới.",
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
    sub?: string;
    period?: string;
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
  const subStatus = searchParams.sub?.trim() ?? "";
  // Kỳ dữ liệu tuyển sinh: tính theo NGÀY NHẬN DATA (createdAt). "" = tất cả.
  const period = searchParams.period === "week" || searchParams.period === "month" ? searchParams.period : "";
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

  const today = startOfToday();
  const todayBounds = dayBounds(0);
  const tomorrowBounds = dayBounds(1);

  // KỲ DỮ LIỆU: tuần này (thứ 2 → chủ nhật) hoặc tháng này, tính theo ngày nhận data.
  function periodRange(kind: string): { gte: Date; lte: Date } | null {
    if (kind === "week") {
      const start = startOfToday();
      const weekday = (start.getDay() + 6) % 7; // thứ 2 = 0
      start.setDate(start.getDate() - weekday);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { gte: start, lte: end };
    }
    if (kind === "month") {
      const start = startOfToday();
      start.setDate(1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
      return { gte: start, lte: end };
    }
    return null;
  }

  // Kỳ dữ liệu áp cho cả danh sách lẫn số trên chip trạng thái. Chip báo động là việc
  // "phải gọi hôm nay" nên nó tự bỏ kỳ (link của chip xóa param period) — nhờ vậy số
  // trên chip và số dòng trong bảng luôn khớp, không có lọc ngầm nào bị bỏ qua.
  const periodWindow = periodRange(period);
  const periodWhere = periodWindow ? { createdAt: periodWindow } : {};

  // BÁO ĐỘNG gộp CẢ 2 mốc hẹn: ngày hẹn test (chưa test) và ngày dự kiến nhập học
  // (chưa thành học viên). Lead đã nhập học hoặc đã đóng thì không nhắc nữa.
  function alertWhere(bucket: string) {
    const range =
      bucket === "overdue"
        ? { lt: today }
        : bucket === "today"
          ? { gte: todayBounds.start, lte: todayBounds.end }
          : bucket === "tomorrow"
            ? { gte: tomorrowBounds.start, lte: tomorrowBounds.end }
            : null;
    if (!range) return null;
    return {
      status: { notIn: ["ENROLLED", "LOST"] },
      OR: [
        { placementTests: { some: { status: "SCHEDULED", scheduledDate: range } } },
        { AND: [{ student: { is: null } }, { expectedStartDate: range }] },
      ],
    };
  }

  const urgentWhere = alertWhere(urgent);
  // Dùng AND lồng 1 OR riêng (không phải OR trần) — tránh đè lên OR của ô tìm chung `q`.
  const andFilters = [
    ...(phoneFilter ? [{ OR: [{ phone: { contains: phoneFilter } }, { secondaryPhone: { contains: phoneFilter } }] }] : []),
    ...(urgentWhere ? [urgentWhere] : []),
  ];

  const where = {
    ...(activeBranchId ? { branchId: activeBranchId } : {}),
    // Lead đã "Đã ghi danh" (ENROLLED) đã có học viên thật, việc theo dõi tiếp thuộc
    // về module Học viên chứ không còn là việc CRM tuyển sinh nữa — mặc định ẩn khỏi
    // danh sách chính để ưu tiên các lead còn cần xử lý, vẫn xem được khi bấm rõ
    // ràng vào chip "Đã ghi danh" (status=ENROLLED).
    ...resolveLeadStatusFilter(status),
    ...(subStatus ? { subStatus } : {}),
    ...periodWhere,
    ...(leadCodeFilter ? { leadCode: { contains: leadCodeFilter } } : {}),
    ...(nameFilter ? { fullName: { contains: nameFilter } } : {}),
    ...(sourceFilter ? { source: { contains: sourceFilter } } : {}),
    // Mọi điều kiện dạng AND gom hết vào andFilters phía trên — 2 key "AND" trần trong
    // cùng một object sẽ đè nhau, chỉ còn cái sau (bug từng gặp với ô lọc số điện thoại).
    ...(meetFrom || meetTo
      ? { meetDate: { ...(meetFrom ? { gte: new Date(meetFrom) } : {}), ...(meetTo ? { lte: new Date(meetTo) } : {}) } }
      : {}),
    ...(startFrom || startTo
      ? { expectedStartDate: { ...(startFrom ? { gte: new Date(startFrom) } : {}), ...(startTo ? { lte: new Date(startTo) } : {}) } }
      : {}),
    ...(notesFilter ? { notes: { contains: notesFilter } } : {}),
    ...(testStatus === "NONE" ? { placementTests: { none: {} } } : testStatus ? { placementTests: { some: { status: testStatus } } } : {}),
    ...(andFilters.length ? { AND: andFilters } : {}),
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
      where: { ...(activeBranchId ? { branchId: activeBranchId } : {}), ...periodWhere },
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

  // Số của 3 chip báo động ĐẾM THEO LEAD (không đếm theo phiếu test) vì mỗi dòng trong
  // bảng là 1 lead — trước đây đếm theo placement_test nên số trên chip lệch số dòng.
  const alertCountWhere = (bucket: string) => ({ ...branchLeadFilter, AND: [alertWhere(bucket)!] });
  const [missingTestCount, overdueCount, todayCount, tomorrowCount, bySubStatus, classOptions] = await Promise.all([
    prisma.lead.count({
      where: {
        ...branchLeadFilter,
        ...periodWhere,
        status: { notIn: ["ENROLLED", "LOST"] },
        placementTests: { none: {} },
      },
    }),
    prisma.lead.count({ where: alertCountWhere("overdue") }),
    prisma.lead.count({ where: alertCountWhere("today") }),
    prisma.lead.count({ where: alertCountWhere("tomorrow") }),
    prisma.lead.groupBy({
      by: ["subStatus"],
      where: { ...branchLeadFilter, ...periodWhere },
      _count: { _all: true },
    }),
    prisma.class.findMany({
      where: { ...branchLeadFilter, status: "ACTIVE" },
      select: { id: true, className: true },
      orderBy: { className: "asc" },
    }),
  ]);

  const subStatusCounts = Object.fromEntries(bySubStatus.map((row) => [row.subStatus ?? "", row._count._all]));
  const subStatusOptions = LEAD_SUB_STATUS.map((item) => ({
    value: item.value,
    label: item.label,
    group: item.group as string,
    count: subStatusCounts[item.value] ?? 0,
  }));

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
        title="Hướng dẫn Data tuyển sinh"
        summary="Cách đọc trạng thái lead, lọc đúng nhóm cần xử lý và tránh bỏ sót lịch test."
        sections={LEADS_PAGE_GUIDE_SECTIONS}
        buttonLabel="Hướng dẫn"
      />
      <div className="flex flex-col gap-3 sm:gap-4 xl:flex-row xl:items-start xl:justify-between" data-tour="leads-header">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-[#0f1729]">Data tuyển sinh</h1>
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
        overdueCount={overdueCount}
        todayCount={todayCount}
        tomorrowCount={tomorrowCount}
        subStatusOptions={subStatusOptions}
        subStatusFilter={subStatus}
        periodFilter={period}
        classOptions={classOptions}
        enrolledCount={statusCounts.ENROLLED ?? 0}
      />
    </div>
  );
}
