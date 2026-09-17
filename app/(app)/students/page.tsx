import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pickCurrentEnrollment } from "@/lib/server/class-rules";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canView, canViewFullWithOverride, canViewWithOverride } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { chargeOwnDueAmount } from "@/lib/server/tuition-rules";
import { getEnrollmentLearningSnapshot } from "@/lib/server/enrollment-learning";
import { getWalletBalance } from "@/lib/server/enrollment-wallet";
import StudentsTable from "./StudentsTable";
import PageGuide from "@/components/ui/PageGuide";

const PAGE_SIZE = 20;
const STUDENTS_PAGE_GUIDE_SECTIONS = [
  {
    title: "Mục tiêu trang này",
    items: [
      "Theo dõi danh sách học viên, lớp đang học và tình trạng công nợ của từng bạn.",
      "Tìm nhanh theo tên, mã học viên, số điện thoại hoặc phụ huynh liên kết.",
      "Đi từ danh sách sang hồ sơ chi tiết để xử lý học phí, ghi danh và lớp học.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách thao tác nhanh",
    items: [
      "Dùng ô tìm kiếm và bộ lọc trạng thái để gom đúng nhóm học viên cần xử lý.",
      "Mở hồ sơ từng học viên khi cần kiểm tra học phí, phụ huynh, lớp và lịch sử thu.",
      "Nếu cần xuất dữ liệu, nên lọc đúng nhóm trước để file dễ đọc và đối soát hơn.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý vận hành",
    items: [
      "Công nợ hiển thị là phần còn phải thu sau khi đã trừ các khoản thanh toán.",
      "Học viên có buổi bổ trợ hoặc đang chuyển lớp cần mở hồ sơ để xem kỹ trước khi thao tác.",
      "Nếu thấy số liệu lạ, hãy đối chiếu lại charge, phiếu thu và trạng thái ghi danh của học viên.",
    ],
    tone: "warning" as const,
  },
];

// Trước đây "Cần chuyển"/"Sắp hết"/portal/công nợ trên các ô thống kê chỉ đếm trên
// ĐÚNG 20 dòng của trang đang xem (pageItems), không phải toàn bộ danh sách đã lọc —
// khác hẳn "Tất cả"/"Đang học" cạnh nó vốn là số thật từ groupBy toàn bộ. Nhìn giống
// nhau nhưng sai bản chất, dễ khiến nhân viên tin nhầm số liệu. Hàm này quét TOÀN BỘ
// học viên khớp `where` (không phân trang) để ra đúng 4 số — tách riêng khỏi luồng
// dựng bảng chính (không kèm sách/tín dụng/billing mode...) để không làm chậm trang
// khi không cần các số này.
async function computeGlobalStudentStats(where: Prisma.StudentWhereInput) {
  const students = await prisma.student.findMany({
    where,
    select: {
      id: true,
      guardians: { select: { isPrimary: true, guardian: { select: { user: { select: { isActive: true } } } } } },
      // Lấy theo ĐÚNG thứ tự mà bảng bên dưới dùng để chọn "ghi danh hiện tại"
      // (ACTIVE trước, rồi mới tới ghi danh gần nhất). Trước đây ô thống kê chỉ lấy
      // enrollment ACTIVE nên học viên đã rút lớp mà ví còn ÂM (vẫn đang nợ tiền) không
      // được đếm, trong khi bấm vào chip lọc thì họ lại hiện ra — hai nơi ra hai con số.
      enrollments: {
        include: { class: { include: { nextClass: true, scheduleRules: { where: { isActive: true }, orderBy: { weekday: "asc" } } } } },
        orderBy: [{ status: "asc" }, { enrollDate: "desc" }],
      },
    },
  });

  const studentIds = students.map((item) => item.id);
  const chargeRows = studentIds.length
    ? await prisma.charge.findMany({
        where: { studentId: { in: studentIds } },
        select: { id: true, studentId: true, tuitionAmount: true, materialsAmount: true },
      })
    : [];
  const allocationTotals = chargeRows.length
    ? await prisma.paymentAllocation.groupBy({
        by: ["chargeId"],
        where: { chargeId: { in: chargeRows.map((charge) => charge.id) }, payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } },
        _sum: { amount: true },
      })
    : [];
  const paymentTotals = studentIds.length
    ? await prisma.payment.groupBy({
        by: ["studentId"],
        where: { studentId: { in: studentIds }, status: { notIn: ["VOIDED", "REFUNDED"] } },
        _sum: { amount: true },
      })
    : [];
  const paidTotalByStudent = new Map(paymentTotals.map((row) => [row.studentId, row._sum.amount ?? 0]));
  const paidByCharge = new Map(allocationTotals.map((row) => [row.chargeId, row._sum.amount ?? 0]));
  const chargeByStudent = new Map<string, number>();
  const paidByStudent = new Map<string, number>();
  for (const charge of chargeRows) {
    chargeByStudent.set(charge.studentId, (chargeByStudent.get(charge.studentId) ?? 0) + chargeOwnDueAmount(charge));
    paidByStudent.set(charge.studentId, (paidByStudent.get(charge.studentId) ?? 0) + (paidByCharge.get(charge.id) ?? 0));
  }

  let portalCount = 0;
  let debtCount = 0;
  // Đã thu nhưng chưa gắn vào phiếu nào = phụ huynh đóng dư; không nợ và không dư = đóng đủ.
  let advanceCount = 0;
  let paidUpCount = 0;
  let needTransferCount = 0;
  let endingSoonCount = 0;
  // Chỉ số theo VÍ BUỔI HỌC — nhóm đóng theo tháng (95% học viên) không có khái niệm
  // "còn N buổi của khóa", nên 2 chỉ số cũ (cần chuyển lớp / sắp hết khóa) luôn bằng 0
  // với họ. Cái thật sự cần hành động là: ai đã học vượt tiền đã đóng (ví âm) và ai
  // sắp hết ví để gọi thu tháng mới.
  let walletNegativeCount = 0;
  let walletLowCount = 0;

  await Promise.all(
    students.map(async (student) => {
      const primaryGuardian = student.guardians.find((link) => link.isPrimary) ?? student.guardians[0];
      if (primaryGuardian?.guardian.user?.isActive) portalCount++;

      const outstanding = (chargeByStudent.get(student.id) ?? 0) - (paidByStudent.get(student.id) ?? 0);
      const advance = Math.max(0, (paidTotalByStudent.get(student.id) ?? 0) - (paidByStudent.get(student.id) ?? 0));
      if (outstanding > 0) debtCount++;
      if (advance > 0) advanceCount++;
      if (outstanding <= 0 && advance === 0) paidUpCount++;

      const activeEnrollment = student.enrollments.find((item) => item.status === "ACTIVE");
      const currentEnrollment = activeEnrollment ?? pickCurrentEnrollment(student.enrollments) ?? undefined;
      if (!currentEnrollment || !currentEnrollment.class) return;

      // Ví: tính trên ghi danh HIỆN TẠI kể cả đã rút lớp — ví âm là tiền còn phải thu,
      // ví dương của người đã nghỉ là tiền còn phải hoàn, cả hai đều cần hành động.
      if (currentEnrollment.billingModel === "PERIOD") {
        const balance = await getWalletBalance(prisma, currentEnrollment.id);
        if (balance < 0) walletNegativeCount++;
        else if (balance <= 2) walletLowCount++;
        return;
      }

      // Các chỉ số theo mô hình khóa chỉ có nghĩa với người ĐANG học — học viên đã rút
      // mà còn buổi chưa học không phải là ca "cần chuyển lớp".
      const enrollment = activeEnrollment;
      if (!enrollment || !enrollment.class) return;
      const snapshot = await getEnrollmentLearningSnapshot(prisma, { ...enrollment, class: { ...enrollment.class, course: null } });
      if (snapshot.continuationStatus === "NEED_TRANSFER") {
        needTransferCount++;
      } else if (snapshot.remainingMainSessions > 0 && snapshot.remainingMainSessions <= 3) {
        endingSoonCount++;
      }
    }),
  );

  return { portalCount, debtCount, advanceCount, paidUpCount, needTransferCount, endingSoonCount, walletNegativeCount, walletLowCount };
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    status?: string;
    page?: string;
    pageSize?: string;
    code?: string;
    name?: string;
    className?: string;
    guardian?: string;
    continuationStatus?: string;
    outstandingFrom?: string;
    outstandingTo?: string;
    sessionCreditFrom?: string;
    sessionCreditTo?: string;
    wallet?: string;
    fee?: string;
  };
}) {
  const user = await getCurrentUser();
  if (!user) notFound();
  const access = await getUserRoleAndOverride(user.id, "students");
  if (!canViewWithOverride("students", access.role, access.override)) notFound();
  const userRole = access.role;
  const limitedToAssignedStudents = !canViewFullWithOverride("students", access.role, access.override);
  const canViewFinance = canView("tuition", userRole);
  const activeBranchId = await getCurrentBranchId();

  const q = searchParams.q?.trim() ?? "";
  const status = searchParams.status ?? "";
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = Number(searchParams.pageSize ?? PAGE_SIZE);
  // Lọc theo từng cột (hàng cố định dưới header bảng) — độc lập với ô tìm chung `q`.
  const codeFilter = searchParams.code?.trim() ?? "";
  const nameFilter = searchParams.name?.trim() ?? "";
  const classNameFilter = searchParams.className?.trim() ?? "";
  const guardianFilter = searchParams.guardian?.trim() ?? "";
  // Lọc theo Ví buổi học: "am" = đang âm (đã học vượt tiền đã đóng), "sap-het" = còn <= 2 buổi.
  const walletFilter = searchParams.wallet?.trim() ?? "";
  // Lọc theo TÌNH TRẠNG HỌC PHÍ: no = còn nợ, du = đã đóng dư (tiền đóng trước),
  // sap-het = sắp hết khóa, du-no = đóng đủ (không nợ, không dư).
  const feeFilter = searchParams.fee?.trim() ?? "";
  // continuationStatus/outstanding không phải cột thật (tính SAU khi query, từ charge +
  // enrollment snapshot) — không lọc được bằng Prisma `where` trực tiếp. Áp dụng bằng
  // cách: tính đủ cho TOÀN BỘ danh sách khớp các filter còn lại (không phân trang ở
  // DB), lọc 2 field này trong JS ở SERVER, rồi mới cắt trang — vẫn là lọc backend
  // đúng nghĩa (không gửi dữ liệu chưa lọc ra browser), chỉ khác chỗ phân trang xảy ra
  // sau bước tính toán thay vì ở Prisma `skip/take`.
  const continuationStatusFilter = searchParams.continuationStatus?.trim() ?? "";
  const outstandingFrom = searchParams.outstandingFrom?.trim() ?? "";
  const outstandingTo = searchParams.outstandingTo?.trim() ?? "";
  const sessionCreditFrom = searchParams.sessionCreditFrom?.trim() ?? "";
  const sessionCreditTo = searchParams.sessionCreditTo?.trim() ?? "";

  const assignmentScope: Prisma.StudentWhereInput = limitedToAssignedStudents
    ? user.employeeId
      ? {
          enrollments: {
            some: {
              status: "ACTIVE",
              class: {
                OR: [
                  { defaultAssignments: { some: { employeeId: user.employeeId, isActive: true } } },
                  { sessions: { some: { assignments: { some: { employeeId: user.employeeId } } } } },
                ],
              },
            },
          },
        }
      : { id: "__NO_ASSIGNED_STUDENTS__" }
    : {};
  const baseWhere: Prisma.StudentWhereInput = {
    ...(activeBranchId ? { branchId: activeBranchId } : {}),
    ...assignmentScope,
  };
  const where: Prisma.StudentWhereInput = {
    ...baseWhere,
    // Mấy trạng thái dưới đây KHÔNG nằm ở Student.status (chỉ có Đang học/Đã nghỉ) mà
    // suy từ GHI DANH:
    //   Bảo lưu  = đang tạm dừng CÓ hẹn ngày học lại (pausedTo) và không còn lớp đang học
    //   Tạm nghỉ = đang tạm dừng CHƯA hẹn ngày học lại
    //   Chuyển lớp = đã có ghi danh chuyển sang lớp khác
    ...(status === "PAUSED"
      ? { AND: [{ enrollments: { some: { status: "PAUSED", pausedTo: { not: null } }, none: { status: "ACTIVE" } } }] }
      : status === "TEMP_LEAVE"
        ? { AND: [{ enrollments: { some: { status: "PAUSED", pausedTo: null }, none: { status: "ACTIVE" } } }] }
        : status === "TRANSFERRED"
          ? { AND: [{ enrollments: { some: { status: "TRANSFERRED" } } }] }
          : status
            ? { status }
            : {}),
    ...(codeFilter ? { studentCode: { contains: codeFilter } } : {}),
    ...(nameFilter ? { fullName: { contains: nameFilter } } : {}),
    ...(classNameFilter
      ? {
          enrollments: {
            some: {
              status: "ACTIVE",
              class: { OR: [{ className: { contains: classNameFilter } }, { classCode: { contains: classNameFilter } }] },
            },
          },
        }
      : {}),
    ...(guardianFilter
      ? { guardians: { some: { isPrimary: true, guardian: { fullName: { contains: guardianFilter } } } } }
      : {}),
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

  const needsComputedFilter = Boolean(continuationStatusFilter || outstandingFrom || outstandingTo || sessionCreditFrom || sessionCreditTo || walletFilter || feeFilter);

  const [items, grouped, countResult] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { createdAt: "desc" },
      // continuationStatus/outstanding lọc SAU khi tính (xem ghi chú ở trên) — khi có
      // 1 trong 2 filter đó, phải lấy đủ toàn bộ danh sách khớp rồi mới cắt trang, nên
      // bỏ skip/take ở đây; ngược lại giữ nguyên phân trang ở DB như cũ (rẻ hơn).
      ...(needsComputedFilter ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      include: {
        lead: true,
        guardians: {
          include: { guardian: { include: { user: true } } },
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        },
        enrollments: {
          include: {
            class: {
              include: {
                nextClass: true,
                scheduleRules: { where: { isActive: true }, orderBy: { weekday: "asc" } },
              },
            },
          },
          orderBy: [{ status: "asc" }, { enrollDate: "desc" }],
        },
      },
    }),
    prisma.student.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    }),
    needsComputedFilter ? Promise.resolve(null) : prisma.student.count({ where }),
  ]);

  const studentIds = items.map((item) => item.id);
  const currentEnrollments = items
    .map((item) => pickCurrentEnrollment(item.enrollments))
    .filter((enrollment): enrollment is NonNullable<typeof enrollment> => Boolean(enrollment));
  const [chargeRows, allocationTotals, bookIssueRows, studentMetaRows, availableSessionCreditRows, learningSnapshots, walletBalances, paymentTotals] = await Promise.all([
    canViewFinance ? prisma.charge.findMany({
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
    }) : Promise.resolve([]),
    canViewFinance ? prisma.paymentAllocation.groupBy({
      by: ["chargeId"],
      where: {
        charge: { studentId: { in: studentIds } },
        payment: { status: { notIn: ["VOIDED", "REFUNDED"] } },
      },
      _sum: { amount: true },
    }) : Promise.resolve([]),
    canViewFinance ? prisma.bookIssue.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        studentId: true,
        amount: true,
        quantity: true,
        paymentStatus: true,
      },
    }) : Promise.resolve([]),
    canViewFinance ? prisma.student.findMany({
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
    }) : Promise.resolve([]),
    prisma.sessionCredit.groupBy({
      by: ["studentId"],
      where: {
        studentId: { in: studentIds },
        status: "AVAILABLE",
      },
      _count: { _all: true },
      _avg: { unitPriceSnapshot: true },
    }),
    Promise.all(
      currentEnrollments.map(async (enrollment) => ({
        enrollmentId: enrollment.id,
        snapshot: enrollment.class
          ? await getEnrollmentLearningSnapshot(prisma, {
              ...enrollment,
              class: {
                ...enrollment.class,
                course: null,
              },
            })
          : null,
      })),
    ),
    Promise.all(
      currentEnrollments
        .filter((enrollment) => enrollment.billingModel === "PERIOD")
        .map(async (enrollment) => ({ enrollmentId: enrollment.id, balance: await getWalletBalance(prisma, enrollment.id) })),
    ),
    // Tổng tiền đã thu của học viên — trừ đi phần đã phân bổ vào phiếu ra TIỀN ĐÓNG DƯ
    // (đóng trước), là cơ sở của chip lọc "Dư học phí".
    canViewFinance
      ? prisma.payment.groupBy({
          by: ["studentId"],
          where: { studentId: { in: studentIds }, status: { notIn: ["VOIDED", "REFUNDED"] } },
          _sum: { amount: true },
        })
      : Promise.resolve([]),
  ]);
  const paymentTotalByStudent = new Map(paymentTotals.map((row) => [row.studentId, row._sum.amount ?? 0]));

  // Chiết khấu đang active (học bổng + điều chỉnh HP) — khách hỏi thẳng "chiết khấu
  // đang nằm ở đâu" vì trước đây chỉ xem được trong tab Học phí của drawer, không
  // thấy đâu trên danh sách. Chỉ cộng dồn % đang trong hiệu lực (effectiveFrom/To bao
  // quanh hôm nay hoặc để trống) — hiển thị gộp trên list, chi tiết từng khoản vẫn ở
  // drawer.
  // CỐ TÌNH KHÔNG gate theo canViewFinance — "có học bổng hay không" không nhạy cảm
  // như số tiền nợ cụ thể; trước đây gate chung khiến vai trò không có quyền xem tài
  // chính bị mất LUÔN cả thông tin có học bổng, trong khi cột hiển thị nó (Học viên)
  // vẫn luôn hiện với mọi vai trò.
  const now = new Date();
  const [activeScholarships, activeAdjustments] = await Promise.all([
    prisma.scholarship.findMany({
      where: {
        studentId: { in: studentIds },
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      select: { studentId: true, percentage: true },
    }),
    prisma.adjustment.findMany({
      where: {
        studentId: { in: studentIds },
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      select: { studentId: true, percentage: true },
    }),
  ]);
  const activeDiscountByStudent = new Map<string, number>();
  for (const row of [...activeScholarships, ...activeAdjustments]) {
    activeDiscountByStudent.set(row.studentId, (activeDiscountByStudent.get(row.studentId) ?? 0) + row.percentage);
  }

  const chargeByStudent = new Map<string, number>();
  const tuitionByStudent = new Map<string, number>();
  const materialsByStudent = new Map<string, number>();
  const openingBalanceByStudent = new Map<string, number>();
  const chargeOwner = new Map<string, string>();
  const latestPeriodByStudent = new Map<string, { periodName: string; startDate: Date }>();
  const billingModesByStudent = new Map<string, Set<string>>();
  for (const row of chargeRows) {
    chargeOwner.set(row.id, row.studentId);
    // chargeOwnDueAmount (không dùng row.totalAmount) — cộng dồn qua nhiều charge của
    // cùng 1 học viên, dùng totalAmount trực tiếp sẽ đếm trùng nợ cũ (openingBalance).
    chargeByStudent.set(row.studentId, (chargeByStudent.get(row.studentId) ?? 0) + chargeOwnDueAmount(row));
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
    if (chargeOwnDueAmount(charge) - paid > 0) {
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
  const sessionCreditUnitPriceByStudent = new Map(
    availableSessionCreditRows.map((row) => [row.studentId, Math.round(row._avg.unitPriceSnapshot ?? 0)]),
  );
  const learningSnapshotByEnrollment = new Map(learningSnapshots.map((row) => [row.enrollmentId, row.snapshot]));
  const walletBalanceByEnrollment = new Map(walletBalances.map((row) => [row.enrollmentId, row.balance]));

  const normalizedItems = items.map((item) => {
    const primaryGuardian = item.guardians.find((guardianLink) => guardianLink.isPrimary)?.guardian ?? item.guardians[0]?.guardian ?? null;
    const currentEnrollment = pickCurrentEnrollment(item.enrollments);
    const counts = studentMetaById.get(item.id);
    const learningSnapshot = currentEnrollment ? learningSnapshotByEnrollment.get(currentEnrollment.id) ?? null : null;
    return {
      ...item,
      primaryGuardian,
      currentClassName: currentEnrollment?.class?.className ?? currentEnrollment?.packageLabel ?? null,
      currentClassCode: currentEnrollment?.class?.classCode ?? null,
      currentClassStatus: currentEnrollment?.class?.status ?? null,
      // Trạng thái GHI DANH hiện tại (khác Student.status) — để bảng hiện "Bảo lưu" ngay ngoài danh sách.
      currentEnrollmentStatus: currentEnrollment?.status ?? null,
      currentPausedFrom: currentEnrollment?.status === "PAUSED" ? currentEnrollment.pausedFrom?.toISOString() ?? null : null,
      currentBillingModel: currentEnrollment?.billingModel ?? null,
      currentWalletBalance: currentEnrollment?.billingModel === "PERIOD" ? walletBalanceByEnrollment.get(currentEnrollment.id) ?? 0 : null,
      leadCode: item.lead?.leadCode ?? null,
      outstanding: canViewFinance ? (chargeByStudent.get(item.id) ?? 0) - (paidByStudent.get(item.id) ?? 0) : undefined,
      // Tiền đã thu nhưng chưa gắn vào phiếu nào — "dư học phí" của phụ huynh.
      advanceAmount: canViewFinance
        ? Math.max(0, (paymentTotalByStudent.get(item.id) ?? 0) - (paidByStudent.get(item.id) ?? 0))
        : undefined,
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
      activeDiscountPercent: activeDiscountByStudent.get(item.id) ?? 0,
      sessionCreditCount: availableSessionCreditByStudent.get(item.id) ?? 0,
      sessionCreditUnitPrice: sessionCreditUnitPriceByStudent.get(item.id) ?? null,
      enrollmentsCount: item.enrollments.length,
      learningRemainingSessions: learningSnapshot?.remainingMainSessions ?? null,
      learningPurchasedSessions: learningSnapshot?.entitledMainSessions ?? null,
      learningCompletedSessions: learningSnapshot?.completedMainSessions ?? null,
      expectedStudentEndDate: learningSnapshot?.expectedStudentEndDate ?? null,
      continuationStatus: learningSnapshot?.continuationStatus ?? null,
      shortageAfterCurrentClass: learningSnapshot?.shortageAfterCurrentClass ?? 0,
      nextClassName: currentEnrollment?.class?.nextClass?.className ?? null,
    };
  });

  // continuationStatus/outstanding lọc ở đây (sau khi đã tính xong, xem ghi chú ở
  // needsComputedFilter) rồi mới cắt trang — vẫn trên server, chưa gửi gì ra browser.
  let filteredItems = normalizedItems;
  // Lọc theo Ví buổi học — chỉ áp cho nhóm đóng theo tháng (nhóm khác không có ví).
  if (walletFilter === "am") {
    filteredItems = filteredItems.filter((item) => item.currentWalletBalance != null && item.currentWalletBalance < 0);
  } else if (walletFilter === "sap-het") {
    filteredItems = filteredItems.filter(
      (item) => item.currentWalletBalance != null && item.currentWalletBalance >= 0 && item.currentWalletBalance <= 2,
    );
  }
  if (feeFilter === "no") {
    filteredItems = filteredItems.filter((item) => (item.outstanding ?? 0) > 0);
  } else if (feeFilter === "du") {
    filteredItems = filteredItems.filter((item) => (item.advanceAmount ?? 0) > 0);
  } else if (feeFilter === "sap-het") {
    // Cùng một định nghĩa với số trên chip (computeGlobalStudentStats): cần chuyển lớp,
    // hoặc chỉ còn 1–3 buổi của khóa. Hai nơi lệch định nghĩa là chip và bảng ra 2 số.
    filteredItems = filteredItems.filter(
      (item) =>
        // Nhóm đóng theo tháng không có khái niệm "hết khóa" (đóng tới đâu học tới đó)
        // — đúng như cách computeGlobalStudentStats đếm, để chip và bảng cùng một số.
        item.currentBillingModel !== "PERIOD" &&
        // Chỉ người ĐANG học mới là ca "sắp hết khóa cần xử lý" — người đã rút/chuyển
        // lớp không tính (computeGlobalStudentStats cũng chỉ xét ghi danh đang học).
        item.currentEnrollmentStatus === "ACTIVE" &&
        (item.continuationStatus === "NEED_TRANSFER" ||
          ((item.learningRemainingSessions ?? 0) > 0 && (item.learningRemainingSessions ?? 0) <= 3)),
    );
  } else if (feeFilter === "du-no") {
    filteredItems = filteredItems.filter((item) => (item.outstanding ?? 0) <= 0 && (item.advanceAmount ?? 0) === 0);
  }
  if (continuationStatusFilter) {
    filteredItems = filteredItems.filter((item) => item.continuationStatus === continuationStatusFilter);
  }
  if (outstandingFrom) {
    filteredItems = filteredItems.filter((item) => (item.outstanding ?? 0) >= Number(outstandingFrom));
  }
  if (outstandingTo) {
    filteredItems = filteredItems.filter((item) => (item.outstanding ?? 0) <= Number(outstandingTo));
  }
  if (sessionCreditFrom) {
    filteredItems = filteredItems.filter((item) => (item.sessionCreditCount ?? 0) >= Number(sessionCreditFrom));
  }
  if (sessionCreditTo) {
    filteredItems = filteredItems.filter((item) => (item.sessionCreditCount ?? 0) <= Number(sessionCreditTo));
  }

  const total = needsComputedFilter ? filteredItems.length : countResult ?? 0;
  const pageItems = needsComputedFilter
    ? filteredItems.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
    : filteredItems;

  const stats = Object.fromEntries(grouped.map((row) => [row.status, row._count._all])) as Record<string, number>;
  const [pausedCount, tempLeaveCount, transferredCount] = await Promise.all([
    prisma.student.count({
      where: { ...baseWhere, AND: [{ enrollments: { some: { status: "PAUSED", pausedTo: { not: null } }, none: { status: "ACTIVE" } } }] },
    }),
    prisma.student.count({
      where: { ...baseWhere, AND: [{ enrollments: { some: { status: "PAUSED", pausedTo: null }, none: { status: "ACTIVE" } } }] },
    }),
    prisma.student.count({ where: { ...baseWhere, AND: [{ enrollments: { some: { status: "TRANSFERRED" } } }] } }),
  ]);
  const { portalCount, debtCount, advanceCount, paidUpCount, needTransferCount, endingSoonCount, walletNegativeCount, walletLowCount } =
    await computeGlobalStudentStats(where);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageGuide
        title="Guide học viên"
        summary="Giải thích nhanh cách tìm đúng học viên và đi vào hồ sơ để xử lý chuẩn."
        sections={STUDENTS_PAGE_GUIDE_SECTIONS}
        buttonLabel="Guide học viên"
      />
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-[#0f1729]">Quản lý học viên</h1>
        <p className="mt-1 text-xs sm:text-sm text-[#64748b]">Theo dõi hồ sơ, học phí và lớp học của {total} học viên</p>
      </div>

      <StudentsTable
        initialData={pageItems}
        total={total}
        page={page}
        pageSize={pageSize}
        userRole={userRole || "TEACHER"}
        canViewFinance={canViewFinance}
        searchQuery={q}
        status={status}
        stats={{
          total,
          active: stats.ACTIVE ?? 0,
          left: stats.LEFT ?? 0,
          paused: pausedCount,
          tempLeave: tempLeaveCount,
          transferred: transferredCount,
          portal: portalCount,
          debt: debtCount,
          advance: advanceCount,
          paidUp: paidUpCount,
          needTransfer: needTransferCount,
          endingSoon: endingSoonCount,
          walletNegative: walletNegativeCount,
          walletLow: walletLowCount,
        }}
        walletFilter={walletFilter}
        feeFilter={feeFilter}
      />
    </div>
  );
}
