import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StudentEditForm from "@/components/students/StudentEditForm";
import AssignEnrollmentForm from "@/components/students/AssignEnrollmentForm";
import StudentFinanceDesk from "@/components/students/StudentFinanceDesk";
import StudentSessionCredits from "@/components/students/StudentSessionCredits";
import QuickPaymentButton from "@/components/tuition/QuickPaymentButton";
import ScholarshipAdjustmentForm from "@/components/students/ScholarshipAdjustmentForm";
import RefundButton from "@/components/students/RefundButton";
import SchoolExamScoreForm from "@/components/students/SchoolExamScoreForm";
import GuardianAccountPanel from "@/components/guardians/GuardianAccountPanel";
import DetailTabs from "@/components/ui/DetailTabs";
import PageGuide from "@/components/ui/PageGuide";
import PageHero from "@/components/ui/PageHero/PageHero";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";
import { computeOutstandingBalance } from "@/lib/server/balance";
import { chargeOwnDueAmount } from "@/lib/server/tuition-rules";
import { computeEnrollmentSessionProgress } from "@/lib/server/class-generation";
import { getEnrollmentLearningSnapshot } from "@/lib/server/enrollment-learning";
import { getVietnamToday } from "@/lib/server/class-rules";
import EditableDateField from "@/components/ui/EditableDateField";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canCreate, canUpdate, canView, canViewFullWithOverride, canViewWithOverride } from "@/lib/server/role-matrix";
import { formatVnd, formatDate } from "@/lib/export-utils";

function badgeClass(status: string) {
  if (status === "ACTIVE" || status === "PAID" || status === "CONFIRMED" || status === "COMPLETED") {
    return "bg-primary/10 text-primary";
  }
  if (status === "LEFT" || status === "UNPAID" || status === "CANCELLED" || status === "VOIDED") {
    return "bg-red-100 text-red-700";
  }
  if (status === "PENDING" || status === "PLANNED") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-ink/5 text-ink-muted48";
}

function attendanceLabel(status: string) {
  switch (status) {
    case "PRESENT":
      return "Có mặt";
    case "ABSENT":
      return "Vắng";
    case "MAKEUP":
      return "Học bù";
    default:
      return status;
  }
}

function paymentStatusLabel(status: string, refunded: number) {
  switch (status) {
    case "REFUNDED":
      return "Đã hoàn";
    case "PARTIALLY_REFUNDED":
      return `Hoàn ${formatVnd(refunded)}`;
    case "ALLOCATED":
      return "Đã phân bổ";
    case "CONFIRMED":
      return "Đã xác nhận";
    case "VOIDED":
      return "Đã hủy";
    default:
      return status;
  }
}

const STUDENT_DETAIL_GUIDE_SECTIONS = [
  {
    title: "Trang này để làm gì",
    items: [
      "Đây là hồ sơ đầy đủ của một học viên: thông tin, phụ huynh, lớp, học phí và lịch sử học.",
      "5 tab giúp tách rõ từng việc để không bị rối khi thao tác.",
      "Khi cần đối chiếu tiền, lớp hoặc tiến độ học, bắt đầu từ đây.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách dùng nhanh",
    items: [
      "Tab Tổng quan để xem tình trạng hiện tại và các mốc chính.",
      "Tab Học phí để xử lý công nợ, kiểu thu, sách và học bổng.",
      "Các tab còn lại dùng để xem lớp, kết quả, buổi bổ trợ và lịch sử phát sinh.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý",
    items: [
      "Muốn chốt công nợ thì phải kiểm tra cả học phí, thanh toán và sách.",
      "Phụ huynh đổi kiểu thu thì xử lý ngay ở tab học phí.",
      "Buổi bổ trợ hoặc rút lớp có thể ảnh hưởng cả lớp học lẫn tài chính.",
    ],
    tone: "warning" as const,
  },
];

const STUDENT_DETAIL_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="student-header"]',
    title: "Trạng thái, mã học viên và lớp hiện tại",
    description:
      "Badge \"ĐANG HỌC/ĐÃ NGHỈ\" lấy theo Student.status (tổng thể), khác với trạng thái từng ghi danh (ACTIVE/WITHDRAWN/COMPLETED) — 1 học viên có thể còn \"ĐANG HỌC\" dù vừa rút 1 lớp cụ thể, miễn còn ít nhất 1 ghi danh khác đang hoạt động. Badge cam \"Nợ\" chỉ hiện khi công nợ THẬT (tính động, không cộng trùng nợ cũ) lớn hơn 0.",
    placement: "bottom",
  },
  {
    target: '[data-tour="student-actions"]',
    title: "Gán lớp và thu tiền nhanh ngay tại đây",
    description:
      "\"Gán lớp\" tạo ghi danh mới — chọn đúng kiểu thu học phí (trọn khóa/theo tháng/trả góp) ngay lúc này vì đổi sau sẽ phức tạp hơn khi đã phát sinh hóa đơn. Nút thu tiền nhanh gợi ý sẵn đúng số công nợ hiện tại, phân bổ tự động vào kỳ cũ nhất trước (không cần chọn thủ công kỳ nào).",
    placement: "bottom",
  },
  {
    target: '[data-tour="student-kpi-due"]',
    title: "\"Cần thu\" khác với tổng công nợ",
    description:
      "Đây CHỈ tính các kỳ ĐÃ ĐẾN HẠN (ngày bắt đầu kỳ ≤ hôm nay) — kỳ trả góp tương lai chưa tới hạn không bị gộp vào đây dù đã có hóa đơn, để không làm học viên trông như đang nợ quá hạn oan. Muốn xem TOÀN BỘ công nợ (kể cả chưa đến hạn) thì xem badge \"Nợ\" ở phần đầu trang.",
    placement: "bottom",
  },
  {
    target: '[data-tour="student-kpi-paid"]',
    title: "\"Đã lập\" và \"Đã thu\" — 2 số khác nhau",
    description:
      "\"Đã lập\" = tổng tiền trên các hóa đơn đã sinh ra (kể cả chưa thu). \"Đã thu\" = tiền thật đã vào sổ. Chênh lệch giữa 2 số này chính là phần còn nợ. Dòng nhỏ bên dưới tách riêng phần học phí đã thu (không gồm tiền giáo trình) theo đúng tỉ lệ của từng hóa đơn.",
    placement: "bottom",
  },
  {
    target: '[data-tour="student-kpi-attendance"]',
    title: "Có mặt / Vắng / Bù — đếm theo điểm danh thật",
    description:
      "3 số này đếm trực tiếp từ bảng điểm danh của học viên, không phải từ lịch học lý thuyết. Vắng nhiều có thể tự động sinh buổi bổ trợ tùy theo tình huống — xem chi tiết ở tab Buổi học.",
    placement: "bottom",
  },
  {
    target: '[data-tour="student-kpi-portal"]',
    title: "Cổng phụ huynh — cấp quyền xem học phí/điểm danh online",
    description:
      "Hiện email đăng nhập cổng phụ huynh của người giám hộ chính (không phải của học viên). \"Chưa cấp\" nghĩa là phụ huynh chưa có tài khoản portal — cấp ở tab Phụ huynh phía dưới.",
    placement: "left",
  },
  {
    target: '[data-tour="student-kpi-books"]',
    title: "Công nợ sách giáo trình — tách riêng khỏi học phí",
    description: "Tổng tiền sách đã phát nhưng chưa thanh toán — đây là khoản riêng, không cộng vào công nợ học phí ở các thẻ bên trái.",
    placement: "left",
  },
  {
    target: '[data-tour="student-tabs"]',
    title: "4 tab: Tổng quan, Học phí, Buổi học, Phụ huynh",
    description:
      "Xử lý rút lớp, học bổng/điều chỉnh, hoàn tiền, buổi bổ trợ đều nằm trong đúng tab liên quan — không có 1 chỗ chung cho tất cả. Nếu vừa bấm nút thu tiền, trang tự mở sẵn tab Học phí.",
    placement: "top",
  },
];

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { from?: string; focus?: string };
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) notFound();
  const access = await getUserRoleAndOverride(currentUser.id, "students");
  if (!canViewWithOverride("students", access.role, access.override)) notFound();
  const limitedToAssignedStudents = !canViewFullWithOverride("students", access.role, access.override);
  if (limitedToAssignedStudents && !currentUser.employeeId) notFound();

  const student = await prisma.student.findFirst({
    where: {
      id: params.id,
      ...(limitedToAssignedStudents
        ? {
            enrollments: {
              some: {
                status: "ACTIVE",
                class: {
                  OR: [
                    { defaultAssignments: { some: { employeeId: currentUser.employeeId!, isActive: true } } },
                    { sessions: { some: { assignments: { some: { employeeId: currentUser.employeeId! } } } } },
                  ],
                },
              },
            },
          }
        : {}),
    },
    include: {
      lead: true,
      guardians: {
        include: { guardian: { include: { user: true } } },
        orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
      },
      enrollments: {
        include: {
          class: { include: { course: true, nextClass: true, scheduleRules: { where: { isActive: true }, orderBy: { weekday: "asc" } } } },
          transferredFrom: { include: { class: true } },
          transferredTo: { include: { class: true }, orderBy: { enrollDate: "asc" } },
        },
        orderBy: [{ enrollDate: "desc" }, { createdAt: "desc" }],
      },
      charges: {
        include: {
          billingPeriod: true,
          class: true,
          invoice: true,
          allocations: {
            where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } },
            include: { payment: { include: { cashPosting: { include: { cashTransaction: true } } } } },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      payments: {
        orderBy: { paidDate: "desc" },
        include: {
          creditBalances: true,
          refunds: true,
          cashPosting: { include: { cashTransaction: true } },
          allocations: {
            include: {
              charge: { include: { billingPeriod: true, class: true } },
            },
          },
        },
      },
      scholarships: { include: { enrollment: { include: { class: true } } }, orderBy: { effectiveFrom: "desc" } },
      adjustments: { include: { enrollment: { include: { class: true } } }, orderBy: { effectiveFrom: "desc" } },
      creditBalances: { where: { usedAt: null }, orderBy: { createdAt: "asc" } },
      schoolExamScores: { orderBy: { schoolYear: "desc" } },
      bookIssues: {
        include: { book: true, class: true, charge: { include: { billingPeriod: true } } },
        orderBy: { issueDate: "desc" },
        take: 8,
      },
      attendances: {
        include: {
          session: {
            include: {
              class: true,
              assignments: { include: { employee: true }, orderBy: [{ role: "asc" }, { employeeId: "asc" }] },
              journal: true,
            },
          },
        },
        orderBy: { session: { sessionDate: "desc" } },
        take: 20,
      },
      journalEntries: {
        include: {
          scores: true,
          journal: {
            include: {
              session: {
                include: { class: true },
              },
            },
          },
        },
        orderBy: { journal: { createdAt: "desc" } },
        take: 6,
      },
      statusHistory: { orderBy: { changedAt: "desc" }, take: 8 },
      sessionCredits: {
        include: {
          sourceSession: { select: { sessionDate: true, class: { select: { className: true } } } },
          consumedSession: { select: { sessionDate: true, class: { select: { className: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!student) notFound();

  const role = access.role;
  const canEditStudent = canUpdate("students", role);
  const canManageFinance = canUpdate("tuition", role);
  const canSeeFinance = canView("tuition", role);
  const canManageGuardianAccount = canUpdate("students", role);
  const canManageSchedule = canUpdate("schedule", role);

  const availableCredits = student.sessionCredits.filter((c) => c.status === "AVAILABLE");
  // Danh sách buổi để chọn học bù — buổi sắp tới (chưa CANCELLED) trong 60 ngày tới,
  // cùng chi nhánh với học viên, không giới hạn chỉ lớp học viên đang ghi danh (học bù
  // có thể linh hoạt sang buổi/lớp khác cùng trình độ).
  const makeupSessionOptions =
    availableCredits.length > 0
      ? await prisma.classSession.findMany({
          where: {
            status: { not: "CANCELLED" },
            sessionDate: { gte: new Date(), lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
            class: { branchId: student.branchId },
          },
          select: { id: true, sessionDate: true, startTime: true, endTime: true, class: { select: { className: true } } },
          orderBy: { sessionDate: "asc" },
          take: 100,
        })
      : [];
  const canManageInventory = canCreate("inventory", role) || canUpdate("inventory", role);
  const showIntakeBanner = searchParams?.from === "intake";
  const autoOpenTuition = showIntakeBanner && searchParams?.focus === "tuition";

  const outstanding = canSeeFinance ? await computeOutstandingBalance(student.id) : 0;
  const activeEnrollments = student.enrollments.filter((e) => e.status === "ACTIVE");
  const currentEnrollment = activeEnrollments[0] ?? student.enrollments[0] ?? null;
  const learningSnapshots = await Promise.all(
    student.enrollments.map(async (enrollment) => ({
      enrollmentId: enrollment.id,
      snapshot: await getEnrollmentLearningSnapshot(prisma, enrollment),
    })),
  );
  const learningSnapshotByEnrollment = new Map(learningSnapshots.map((item) => [item.enrollmentId, item.snapshot]));
  const currentLearningSnapshot = currentEnrollment ? learningSnapshotByEnrollment.get(currentEnrollment.id) ?? null : null;
  const courseProgress = currentEnrollment?.classId
    ? await computeEnrollmentSessionProgress(currentEnrollment.classId, currentEnrollment.enrollDate)
    : null;
  const primaryGuardianLink = student.guardians.find((item) => item.isPrimary) ?? student.guardians[0] ?? null;
  const primaryGuardian = primaryGuardianLink?.guardian ?? null;

  const totalCharged = student.charges.reduce((sum, charge) => sum + charge.totalAmount, 0);
  const totalPaid = student.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const unpaidBookAmount = student.bookIssues.filter((issue) => issue.paymentStatus !== "PAID").reduce((sum, issue) => sum + issue.amount, 0);

  const attendanceStats = student.attendances.reduce(
    (acc, attendance) => {
      if (attendance.status === "PRESENT") acc.present += 1;
      if (attendance.status === "ABSENT") acc.absent += 1;
      if (attendance.status === "MAKEUP") acc.makeup += 1;
      return acc;
    },
    { present: 0, absent: 0, makeup: 0 }
  );

  const recentAttendanceClassIds = [...new Set(student.attendances.map((attendance) => attendance.session.classId))];
  const classLearningPlans =
    recentAttendanceClassIds.length > 0
      ? await prisma.class.findMany({
          where: { id: { in: recentAttendanceClassIds } },
          select: {
            id: true,
            sessions: {
              where: { status: { not: "CANCELLED" } },
              orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
              select: { id: true },
            },
            roadmapItems: {
              orderBy: { sessionNumber: "asc" },
              select: { sessionNumber: true, title: true, objective: true },
            },
          },
        })
      : [];
  const classLearningPlanMap = new Map(
    classLearningPlans.map((classPlan) => [
      classPlan.id,
      {
        sessionNumberById: new Map(classPlan.sessions.map((session, index) => [session.id, index + 1])),
        roadmapBySessionNumber: new Map(classPlan.roadmapItems.map((item) => [item.sessionNumber, item])),
      },
    ]),
  );

  const recentSessions = student.attendances.map((attendance) => {
    const teachers = attendance.session.assignments
      .filter((assignment) => assignment.role === "TEACHER")
      .map((assignment) => assignment.employee.fullName)
      .join(", ");
    const assistants = attendance.session.assignments
      .filter((assignment) => assignment.role !== "TEACHER")
      .map((assignment) => assignment.employee.shortName || assignment.employee.fullName)
      .join(", ");
    const learningPlan = classLearningPlanMap.get(attendance.session.classId);
    const sessionNumber = learningPlan?.sessionNumberById.get(attendance.session.id) ?? null;
    const roadmapItem = sessionNumber ? learningPlan?.roadmapBySessionNumber.get(sessionNumber) ?? null : null;

    return {
      attendance,
      teachers,
      assistants,
      sessionNumber,
      roadmapItem,
    };
  });

  const unusedCreditAmount = student.creditBalances.reduce((sum, credit) => sum + credit.amount, 0);
  const chargeRemainingMap = new Map<string, { paidAmount: number; remainingAmount: number }>();
  let creditLeft = unusedCreditAmount;

  [...student.charges]
    .sort((a, b) => a.billingPeriod.startDate.getTime() - b.billingPeriod.startDate.getTime())
    .forEach((charge) => {
      const paidAmount = charge.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
      const rawRemaining = Math.max(0, chargeOwnDueAmount(charge) - paidAmount);
      const creditApplied = Math.min(rawRemaining, creditLeft);
      creditLeft -= creditApplied;
      chargeRemainingMap.set(charge.id, {
        paidAmount,
        remainingAmount: rawRemaining - creditApplied,
      });
    });

  const chargeSummaries = student.charges.map((charge) => {
    const paymentState = chargeRemainingMap.get(charge.id) ?? {
      paidAmount: charge.allocations.reduce((sum, alloc) => sum + alloc.amount, 0),
      remainingAmount: Math.max(0, chargeOwnDueAmount(charge) - charge.allocations.reduce((sum, alloc) => sum + alloc.amount, 0)),
    };
    return {
      id: charge.id,
      classId: charge.classId,
      billingPeriodId: charge.billingPeriodId,
      periodName: charge.billingPeriod.periodName,
      startDate: charge.billingPeriod.startDate,
      className: charge.class.className,
      tuitionAmount: charge.tuitionAmount,
      materialsAmount: charge.materialsAmount,
      openingBalance: charge.openingBalance,
      totalAmount: charge.totalAmount,
      paidAmount: paymentState.paidAmount,
      remainingAmount: paymentState.remainingAmount,
    };
  });

  // Kỳ trả góp (INSTALLMENT) sinh sẵn charge cho cả các kỳ tương lai chưa tới hạn —
  // "cần thu ngay" chỉ được tính trên kỳ ĐÃ đến hạn (startDate <= hôm nay), không
  // gộp kỳ tương lai vào làm số nợ trông như đang quá hạn.
  const todayStart = getVietnamToday();
  const dueChargeSummaries = chargeSummaries.filter((charge) => charge.remainingAmount > 0 && charge.startDate.getTime() <= todayStart.getTime());

  const nextDueCharge = [...dueChargeSummaries].sort((a, b) => a.periodName.localeCompare(b.periodName))[0] ?? null;
  const dueNowAmount = dueChargeSummaries.reduce((sum, charge) => sum + charge.remainingAmount, 0);

  // Breakdown "Đã thu" theo học phí/giáo trình — PaymentAllocation chỉ gắn theo cả
  // charge, không tách khoản mục con, nên chia tỉ lệ paidAmount của mỗi charge theo
  // đúng tỉ lệ tuitionAmount:materialsAmount của chính charge đó (không có cách tách
  // chính xác hơn vì dữ liệu gốc không lưu allocation theo khoản mục).
  const { tuitionPaid, materialsPaid } = chargeSummaries.reduce(
    (acc, charge) => {
      const ownDue = chargeOwnDueAmount(charge);
      if (ownDue > 0) {
        acc.tuitionPaid += charge.paidAmount * (charge.tuitionAmount / ownDue);
        acc.materialsPaid += charge.paidAmount * (charge.materialsAmount / ownDue);
      }
      return acc;
    },
    { tuitionPaid: 0, materialsPaid: 0 }
  );

  // Tài chính riêng của enrollment hiện tại (khác 6 KPI card ở trên vốn tổng cả lịch
  // sử học viên) — lọc charge theo đúng enrollmentId để CSO thấy được học phí chính/
  // bổ trợ đầu khóa/bù trừ chuyển lớp của RIÊNG lần ghi danh đang học.
  const enrollmentCharges = currentEnrollment ? student.charges.filter((c) => c.enrollmentId === currentEnrollment.id) : [];
  const enrollmentFinance = enrollmentCharges.reduce(
    (acc, c) => {
      acc.mainTuition += c.mainTuitionAmount || c.tuitionAmount || 0;
      acc.paidCatchup += c.paidCatchupAmount || 0;
      acc.materials += c.materialsAmount || 0;
      acc.transferCredit += c.transferCreditAmount || 0;
      acc.total += c.totalAmount || 0;
      acc.paid += c.allocations.reduce((s, a) => s + a.amount, 0);
      return acc;
    },
    { mainTuition: 0, paidCatchup: 0, materials: 0, transferCredit: 0, total: 0, paid: 0 }
  );
  const enrollmentOutstanding = Math.max(0, enrollmentFinance.total - enrollmentFinance.paid);

  // Lịch sử chuyển/nâng lớp — chỉ hiện khi enrollment hiện tại thực sự có liên quan
  // tới 1 lần chuyển lớp (đến từ lớp cũ hoặc đã từng chuyển tiếp sang lớp khác).
  const transferHistory = currentEnrollment
    ? [
        ...(currentEnrollment.transferredFrom
          ? [{ direction: "from" as const, other: currentEnrollment.transferredFrom, self: currentEnrollment }]
          : []),
        ...currentEnrollment.transferredTo.map((next) => ({ direction: "to" as const, other: next, self: currentEnrollment })),
      ]
    : [];

  // Cảnh báo vận hành gộp — chỉ hiện dòng nào thực sự đúng điều kiện, CSO mở trang là
  // thấy ngay việc cần làm thay vì phải tự lượm lặt từng tín hiệu rải rác trên trang.
  const operationalWarnings: { text: string; severity: "warning" | "critical" }[] = [];
  if (currentLearningSnapshot?.continuationStatus === "NEED_TRANSFER") {
    operationalWarnings.push({
      text: currentEnrollment?.class.nextClass
        ? `Cần chuyển sang lớp ${currentEnrollment.class.nextClass.className} — còn thiếu ${currentLearningSnapshot.shortageAfterCurrentClass} buổi sau khi lớp hiện tại kết thúc.`
        : `Lớp hiện tại chưa cấu hình lớp tiếp theo — còn thiếu ${currentLearningSnapshot.shortageAfterCurrentClass} buổi sau khi lớp kết thúc.`,
      severity: "warning",
    });
  }
  if (availableCredits.length > 0) {
    operationalWarnings.push({ text: `Còn ${availableCredits.length} buổi bổ trợ chưa dùng.`, severity: "warning" });
  }
  if (currentLearningSnapshot && currentLearningSnapshot.remainingMainSessions > 0 && currentLearningSnapshot.remainingMainSessions <= 3) {
    operationalWarnings.push({ text: `Sắp học xong khóa chính — còn ${currentLearningSnapshot.remainingMainSessions} buổi.`, severity: "warning" });
  }
  if (canSeeFinance && outstanding > 0) {
    operationalWarnings.push({ text: `Còn nợ học phí ${formatVnd(outstanding)}.`, severity: "critical" });
  }
  const primaryOperation =
    !currentEnrollment
      ? { label: "Cần gán lớp", detail: "Học viên chưa có enrollment đang theo dõi.", tone: "critical" as const }
      : canSeeFinance && outstanding > 0
        ? { label: "Ưu tiên thu học phí", detail: `Còn nợ ${formatVnd(outstanding)}.`, tone: "critical" as const }
        : currentLearningSnapshot?.continuationStatus === "NEED_TRANSFER"
          ? { label: "Cần chuyển lớp", detail: currentEnrollment.class.nextClass ? `Đề xuất: ${currentEnrollment.class.nextClass.className}` : "Chưa cấu hình lớp tiếp theo.", tone: "warning" as const }
          : availableCredits.length > 0
            ? { label: "Cần xếp bổ trợ", detail: `${availableCredits.length} buổi bổ trợ còn khả dụng.`, tone: "warning" as const }
            : currentLearningSnapshot?.continuationStatus === "COMPLETED"
              ? { label: "Đã học đủ", detail: "Có thể kiểm tra chuyển lớp/nâng lớp nếu phụ huynh học tiếp.", tone: "success" as const }
              : { label: "Đang ổn", detail: "Không có việc khẩn cần xử lý ngay.", tone: "success" as const };
  const operationToneClass =
    primaryOperation.tone === "critical"
      ? "border-red-200 bg-red-50 text-red-800"
      : primaryOperation.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div className="space-y-3 sm:space-y-5 pb-16 sm:pb-20">
      <PageGuide
        title="Hướng dẫn hồ sơ học viên"
        summary="Giải thích nhanh 5 tab chính và nơi xử lý đúng từng việc."
        sections={STUDENT_DETAIL_GUIDE_SECTIONS}
        buttonLabel="Guide"
      />

      {/* ── HEADER ── */}
      <PageHero
        backHref="/students"
        identityDataTour="student-header"
        backLabel={
          <>
            <span className="hidden sm:inline">Quay lại danh sách học viên</span>
            <span className="sm:hidden">Học viên</span>
          </>
        }
        avatarLabel={student.fullName.charAt(0).toUpperCase()}
        statusPill={
          <span className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wide ${student.status === "ACTIVE" ? "bg-[#10b981] text-white" : "bg-[#64748b] text-white"}`}>
            <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-white" />
            <span className="hidden sm:inline">{student.status === "ACTIVE" ? "ĐANG HỌC" : "ĐÃ NGHỈ"}</span>
            <span className="sm:hidden">{student.status === "ACTIVE" ? "HỌC" : "NGHỈ"}</span>
          </span>
        }
        title={student.fullName}
        badges={
          <>
            <span className="inline-flex items-center rounded-lg bg-[#f97316] px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold text-white">{student.studentCode}</span>
            {currentEnrollment?.class?.className && <span className="inline-flex items-center rounded-lg bg-[#fb923c] px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold text-white truncate max-w-[150px] sm:max-w-none">{currentEnrollment.class.className}</span>}
            {outstanding > 0 && <span className="inline-flex items-center rounded-lg bg-[#f59e0b] px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold text-white whitespace-nowrap">Nợ {formatVnd(outstanding)}</span>}
          </>
        }
        meta={
          <>
            {student.lead?.leadCode ? `${student.lead.leadCode} · ` : ""}
            {primaryGuardian?.fullName ?? "Chưa gắn phụ huynh"}
            {primaryGuardian?.phone ? ` · ${primaryGuardian.phone}` : ""}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3" data-tour="student-actions">
            <SpotlightTour
              steps={STUDENT_DETAIL_TOUR_STEPS.filter((step) => {
                if (!canSeeFinance && ["student-kpi-due", "student-kpi-paid", "student-kpi-books"].some((key) => step.target.includes(key))) return false;
                return true;
              })}
            />
            {canEditStudent && (
              <AssignEnrollmentForm
                student={{
                  id: student.id,
                  fullName: student.fullName,
                  studentCode: student.studentCode,
                  currentClassName: currentEnrollment?.class?.className ?? null,
                  sessionCreditCount: availableCredits.length,
                }}
                triggerLabel={currentEnrollment ? "Gán lớp" : "Gán nhập"}
              />
            )}
            {canManageFinance && <QuickPaymentButton studentId={student.id} suggestedAmount={outstanding} autoOpen={autoOpenTuition} />}
            {currentEnrollment?.classId && (
              <Link href={`/classes/${currentEnrollment.classId}`} className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border-2 border-[#e5eaf7] bg-white px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm font-semibold text-[#0f1729] shadow-sm hover:border-[#f97316] hover:text-[#f97316] hover:-translate-y-0.5 transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sm:w-[18px] sm:h-[18px]"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span className="hidden sm:inline">Mở lớp hiện tại</span>
                <span className="sm:hidden">Lớp</span>
              </Link>
            )}
          </div>
        }
      />

      {showIntakeBanner && (
        <div className="rounded-xl sm:rounded-2xl border border-[#10b981] bg-[#ecfdf5] px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col gap-2 sm:gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs sm:text-sm font-bold text-[#065f46]">✓ Đã hoàn tất luồng nhập học</p>
              <p className="mt-1 text-xs sm:text-sm text-[#047857]">
                Học viên đã được tạo, liên kết phụ huynh
                {currentEnrollment?.class?.className && ` và ghi danh vào lớp ${currentEnrollment.class.className}`}.
                {canSeeFinance && " Có thể xử lý học phí và portal ngay tại màn 360 này."}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {canManageFinance && <QuickPaymentButton studentId={student.id} suggestedAmount={outstanding} autoOpen={autoOpenTuition} />}
              {primaryGuardian && (
                <Link href={`/guardians/${primaryGuardian.id}`} className="text-xs sm:text-sm font-bold text-[#f97316] hover:text-[#ea580c] whitespace-nowrap">
                  Mở PH →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="rounded-xl sm:rounded-2xl border border-[#dbe7ff] bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className={`rounded-xl border px-4 py-3 ${operationToneClass}`}>
            <p className="text-xs font-black uppercase tracking-[0.16em]">Việc cần làm</p>
            <p className="mt-1 text-lg font-black">{primaryOperation.label}</p>
            <p className="mt-0.5 text-sm font-semibold opacity-90">{primaryOperation.detail}</p>
          </div>

          <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-[#64748b]">Tiến độ</p>
              <p className="mt-1 text-base font-black text-[#0f1729]">
                {currentLearningSnapshot ? `${currentLearningSnapshot.completedMainSessions}/${currentLearningSnapshot.entitledMainSessions}` : "Chưa có lớp"}
              </p>
              <p className="text-xs text-[#64748b]">{currentLearningSnapshot ? `Còn ${currentLearningSnapshot.remainingMainSessions} buổi` : "Cần gán lớp trước"}</p>
            </div>
            <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-[#64748b]">Tiền</p>
              <p className={`mt-1 text-base font-black ${outstanding > 0 ? "text-red-600" : "text-emerald-700"}`}>{canSeeFinance ? formatVnd(outstanding) : "Ẩn"}</p>
              <p className="text-xs text-[#64748b]">Công nợ hiện tại</p>
            </div>
            <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-[#64748b]">Bổ trợ</p>
              <p className={`mt-1 text-base font-black ${availableCredits.length > 0 ? "text-amber-700" : "text-emerald-700"}`}>{availableCredits.length}</p>
              <p className="text-xs text-[#64748b]">Buổi còn khả dụng</p>
            </div>
            <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-[#64748b]">Kết thúc riêng</p>
              <p className="mt-1 text-base font-black text-[#0f1729]">{formatDate(currentLearningSnapshot?.expectedStudentEndDate ?? null)}</p>
              <p className="text-xs text-[#64748b]">
                {currentLearningSnapshot?.continuationStatus === "NEED_TRANSFER" ? "Không đủ buổi ở lớp này" : "Theo enrollment hiện tại"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {operationalWarnings.length > 0 ? (
        <div className="rounded-xl sm:rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Cảnh báo vận hành</p>
          <ul className="mt-2 space-y-1.5">
            {operationalWarnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-2 text-sm font-medium text-amber-900">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${warning.severity === "critical" ? "bg-red-600" : "bg-amber-600"}`} />
                {warning.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {currentEnrollment && currentLearningSnapshot ? (
        <div className="rounded-xl sm:rounded-2xl border border-[#dbe7ff] bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#2563eb]">Hành trình học riêng của học viên</p>
              <h2 className="mt-1 text-lg font-black text-[#0f1729]">{currentEnrollment.class.className}</h2>
              <p className="mt-1 text-sm text-[#64748b]">
                Bắt đầu {formatDate(currentEnrollment.learningStartDate ?? currentEnrollment.enrollDate)} · dự kiến kết thúc {formatDate(currentLearningSnapshot.expectedStudentEndDate)}
              </p>
            </div>
            <span className={`inline-flex w-fit rounded-lg px-3 py-1 text-xs font-bold ${currentLearningSnapshot.continuationStatus === "NEED_TRANSFER" ? "bg-amber-100 text-amber-800" : currentLearningSnapshot.continuationStatus === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>
              {currentLearningSnapshot.continuationStatus === "NEED_TRANSFER" ? "Cần chuyển lớp" : currentLearningSnapshot.continuationStatus === "COMPLETED" ? "Đã học đủ" : "Đang theo lớp"}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-3">
              <p className="text-xs font-bold text-[#64748b]">Tiến độ khóa chính</p>
              <p className="mt-1 text-xl font-black text-[#0f1729]">
                {currentLearningSnapshot.completedMainSessions}/{currentLearningSnapshot.entitledMainSessions}
              </p>
              <p className="text-xs text-[#64748b]">Còn {currentLearningSnapshot.remainingMainSessions} buổi</p>
              {currentLearningSnapshot.manualExtraSessions > 0 ? (
                <p className="text-xs font-semibold text-emerald-700">
                  Gồm {currentLearningSnapshot.manualExtraSessions} buổi cộng linh động
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-3">
              <p className="text-xs font-bold text-[#64748b]">Tiền còn lại</p>
              <p className="mt-1 text-xl font-black text-[#0f1729]">{formatVnd(currentLearningSnapshot.remainingValue)}</p>
              <p className="text-xs text-[#64748b]">{formatVnd(currentLearningSnapshot.unitPrice)} / buổi</p>
            </div>
            <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-3">
              <p className="text-xs font-bold text-[#64748b]">Bổ trợ đầu khóa</p>
              <p className="mt-1 text-xl font-black text-[#0f1729]">{currentEnrollment.paidCatchupSessionCount} buổi</p>
              <p className="text-xs text-[#64748b]">{formatVnd(currentLearningSnapshot.paidCatchupAmount)}</p>
            </div>
            <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-3">
              <p className="text-xs font-bold text-[#64748b]">Chuyển tiếp</p>
              <p className="mt-1 text-sm font-bold text-[#0f1729]">{currentEnrollment.class.nextClass?.className ?? "Chưa cấu hình"}</p>
              {currentLearningSnapshot.continuationStatus === "NEED_TRANSFER" ? (
                <p className="text-xs text-amber-700">Thiếu sau lớp hiện tại: {currentLearningSnapshot.shortageAfterCurrentClass} buổi</p>
              ) : (
                <p className="text-xs text-[#64748b]">Lớp hiện tại đủ đáp ứng số buổi còn lại</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {canSeeFinance && currentEnrollment && enrollmentCharges.length > 0 ? (
        <div className="rounded-xl sm:rounded-2xl border border-[#e5eaf7] bg-white p-4 sm:p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Tài chính của lần ghi danh hiện tại</p>
          <p className="mt-1 text-xs text-[#64748b]">Riêng cho enrollment đang học ở {currentEnrollment.class.className} — khác 6 số tổng bên dưới vốn cộng dồn toàn bộ lịch sử học viên.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <p className="text-[10px] font-bold uppercase text-[#64748b]">Học phí chính</p>
              <p className="mt-0.5 text-sm font-bold text-[#0f1729]">{formatVnd(enrollmentFinance.mainTuition)}</p>
            </div>
            {enrollmentFinance.paidCatchup > 0 ? (
              <div>
                <p className="text-[10px] font-bold uppercase text-[#64748b]">Bổ trợ đầu khóa</p>
                <p className="mt-0.5 text-sm font-bold text-[#0f1729]">{formatVnd(enrollmentFinance.paidCatchup)}</p>
              </div>
            ) : null}
            {enrollmentFinance.materials > 0 ? (
              <div>
                <p className="text-[10px] font-bold uppercase text-[#64748b]">Sách/tài liệu</p>
                <p className="mt-0.5 text-sm font-bold text-[#0f1729]">{formatVnd(enrollmentFinance.materials)}</p>
              </div>
            ) : null}
            {enrollmentFinance.transferCredit > 0 ? (
              <div>
                <p className="text-[10px] font-bold uppercase text-[#64748b]">Bù trừ từ lớp cũ</p>
                <p className="mt-0.5 text-sm font-bold text-[#0f1729]">-{formatVnd(enrollmentFinance.transferCredit)}</p>
              </div>
            ) : null}
            <div>
              <p className="text-[10px] font-bold uppercase text-[#64748b]">Đã thu</p>
              <p className="mt-0.5 text-sm font-bold text-emerald-700">{formatVnd(enrollmentFinance.paid)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-[#64748b]">Còn nợ</p>
              <p className={`mt-0.5 text-sm font-bold ${enrollmentOutstanding > 0 ? "text-red-600" : "text-emerald-700"}`}>{formatVnd(enrollmentOutstanding)}</p>
            </div>
          </div>
        </div>
      ) : null}

      {transferHistory.length > 0 ? (
        <div className="rounded-xl sm:rounded-2xl border border-[#e5eaf7] bg-white p-4 sm:p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Lịch sử chuyển/nâng lớp</p>
          <div className="mt-3 space-y-2">
            {transferHistory.map((item, index) => (
              <div key={index} className="rounded-lg border border-[#e5eaf7] bg-[#f8faff] px-3 py-2 text-sm">
                {item.direction === "from" ? (
                  <p className="font-medium text-[#0f1729]">
                    Chuyển từ <strong>{item.other.class.className}</strong> sang <strong>{item.self.class.className}</strong> · {formatDate(item.self.enrollDate)}
                  </p>
                ) : (
                  <p className="font-medium text-[#0f1729]">
                    Chuyển từ <strong>{item.self.class.className}</strong> sang <strong>{item.other.class.className}</strong> · {formatDate(item.other.enrollDate)}
                  </p>
                )}
                <p className="mt-1 text-xs text-[#64748b]">
                  Tiền còn lại lúc chuyển {formatVnd(item.direction === "from" ? item.self.transferredValueAmount : item.other.transferredValueAmount)} · quy đổi{" "}
                  {item.direction === "from" ? item.self.transferredConvertedSessionCount : item.other.transferredConvertedSessionCount} buổi
                  {(item.direction === "from" ? item.self.transferredRemainingCashAmount : item.other.transferredRemainingCashAmount) > 0
                    ? ` · dư ${formatVnd(item.direction === "from" ? item.self.transferredRemainingCashAmount : item.other.transferredRemainingCashAmount)}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── KPI 6 CARDS ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {canSeeFinance ? (
          <>
        <div className="rounded-xl sm:rounded-2xl border border-[#e5eaf7] bg-white p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all" data-tour="student-kpi-due">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-white shadow-md border border-[#e5eaf7] mb-3 sm:mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-6 sm:h-6"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-[#64748b] mb-0.5 sm:mb-1">Cần thu</p>
          <p className="text-lg sm:text-xl md:text-2xl font-black text-[#0f1729] mb-0.5 sm:mb-1">{formatVnd(dueNowAmount)}</p>
          <p className="text-[10px] sm:text-xs font-semibold text-[#64748b] truncate">{nextDueCharge ? `Kỳ ${nextDueCharge.periodName}` : "Không đến hạn"}</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl border border-[#e5eaf7] bg-white p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-white shadow-md border border-[#e5eaf7] mb-3 sm:mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-6 sm:h-6"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-[#64748b] mb-0.5 sm:mb-1">Đã lập</p>
          <p className="text-lg sm:text-xl md:text-2xl font-black text-[#0f1729] mb-0.5 sm:mb-1">{formatVnd(totalCharged)}</p>
          <p className="text-[10px] sm:text-xs font-semibold text-[#64748b]">{student.charges.length} kỳ</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl border border-[#e5eaf7] bg-white p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all" data-tour="student-kpi-paid">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-white shadow-md border border-[#e5eaf7] mb-3 sm:mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-6 sm:h-6"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-[#64748b] mb-0.5 sm:mb-1">Đã thu</p>
          <p className="text-lg sm:text-xl md:text-2xl font-black text-[#0f1729] mb-0.5 sm:mb-1">{formatVnd(totalPaid)}</p>
          <p className="text-[10px] sm:text-xs font-semibold text-[#64748b] truncate">HP {formatVnd(Math.round(tuitionPaid))}</p>
        </div>
          </>
        ) : null}
        <div className="rounded-xl sm:rounded-2xl border border-[#e5eaf7] bg-white p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all" data-tour="student-kpi-attendance">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-white shadow-md border border-[#e5eaf7] mb-3 sm:mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-6 sm:h-6"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-[#64748b] mb-0.5 sm:mb-1">Có mặt</p>
          <p className="text-lg sm:text-xl md:text-2xl font-black text-[#0f1729] mb-0.5 sm:mb-1">{attendanceStats.present}</p>
          <p className="text-[10px] sm:text-xs font-semibold text-[#64748b]">Vắng {attendanceStats.absent} · Bù {attendanceStats.makeup}</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl border border-[#e5eaf7] bg-white p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all" data-tour="student-kpi-portal">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-white shadow-md border border-[#e5eaf7] mb-3 sm:mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-6 sm:h-6"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-[#64748b] mb-0.5 sm:mb-1">Portal PH</p>
          <p className="text-base sm:text-lg font-black text-[#0f1729] mb-0.5 sm:mb-1 truncate">{primaryGuardian?.user?.email ? primaryGuardian.user.email.split('@')[0] : "Chưa cấp"}</p>
          <p className="text-[10px] sm:text-xs font-semibold text-[#64748b] truncate">{primaryGuardian?.user ? (primaryGuardian.user.isActive ? "Hoạt động" : "Thu hồi") : "Chưa có"}</p>
        </div>
        {canSeeFinance ? <div className="rounded-xl sm:rounded-2xl border border-[#e5eaf7] bg-white p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all" data-tour="student-kpi-books">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-white shadow-md border border-[#e5eaf7] mb-3 sm:mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-6 sm:h-6"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </div>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-[#64748b] mb-0.5 sm:mb-1">Sách</p>
          <p className="text-lg sm:text-xl md:text-2xl font-black text-[#0f1729] mb-0.5 sm:mb-1">{formatVnd(unpaidBookAmount)}</p>
          <p className="text-[10px] sm:text-xs font-semibold text-[#64748b] truncate">{unpaidBookAmount > 0 ? "Còn treo" : "Đủ"}</p>
        </div> : null}
      </div>

      {/* ── TABS ── */}
      <div data-tour="student-tabs">
      <DetailTabs
        defaultTabKey={autoOpenTuition && canSeeFinance ? "hocphi" : "tongquan"}
        tabs={[
          {
            key: "tongquan",
            label: "Tổng quan",
            content: (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div>
                      <h2 className="text-lg font-black tracking-tight text-[#0f1729]">Hồ sơ học viên</h2>
                      <p className="mt-1 text-sm text-[#64748b]">Thông tin cơ bản và mốc nhập học.</p>
                    </div>
                    {student.lead && (
                      <Link href={`/leads/${student.lead.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-[#f97316] hover:text-[#ea580c]">
                        Xem lead <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </Link>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#64748b]">Ngày nhập học</span>
                      <span className="text-sm font-bold text-[#0f1729]">
                        {canEditStudent ? (
                          <EditableDateField endpoint={`/api/students/${student.id}`} field="enrollDate" value={student.enrollDate} width="w-32" />
                        ) : (
                          formatDate(student.enrollDate)
                        )}
                      </span>
                    </div>
                    <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#64748b]">Ngày sinh</span>
                      <span className="text-sm font-bold text-[#0f1729]">
                        {canEditStudent ? (
                          <EditableDateField endpoint={`/api/students/${student.id}`} field="dob" value={student.dob} width="w-32" />
                        ) : (
                          formatDate(student.dob)
                        )}
                      </span>
                    </div>
                    <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#64748b]">Giới tính</span>
                      <span className="text-sm font-bold text-[#0f1729]">{student.gender ?? "—"}</span>
                    </div>
                    <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3">
                      <span className="text-sm font-semibold text-[#64748b]">SĐT / Địa chỉ</span>
                      <p className="text-sm font-bold text-[#0f1729] mt-1">{student.phone ?? "—"} · {student.address ?? "—"}</p>
                    </div>
                    <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#64748b]">Người giới thiệu</span>
                      <span className="text-sm font-bold text-[#0f1729]">{student.referredBy ?? "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                  <div className="mb-5">
                    <h2 className="text-lg font-black tracking-tight text-[#0f1729]">Liên kết đang dùng</h2>
                    <p className="mt-1 text-sm text-[#64748b]">Lead, phụ huynh, portal và lớp hiện tại.</p>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#64748b]">Lead gốc</span>
                      <span className="text-sm font-bold text-[#0f1729]">
                        {student.lead ? <Link href={`/leads/${student.lead.id}`} className="text-[#f97316] hover:text-[#ea580c]">{student.lead.leadCode}</Link> : "Không gắn lead"}
                      </span>
                    </div>
                    <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#64748b]">Phụ huynh chính</span>
                      <span className="text-sm font-bold text-[#0f1729]">
                        {primaryGuardian ? <Link href={`/guardians/${primaryGuardian.id}`} className="text-[#f97316] hover:text-[#ea580c]">{primaryGuardian.fullName}</Link> : "Chưa liên kết"}
                      </span>
                    </div>
                    <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#64748b]">Portal</span>
                      <span className="text-sm font-bold text-[#0f1729]">{primaryGuardian?.user?.email ?? "Chưa cấp"}</span>
                    </div>
                    <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3">
                      <span className="text-sm font-semibold text-[#64748b]">Lớp hiện tại</span>
                      <p className="text-sm font-bold text-[#0f1729] mt-1">
                        {currentEnrollment?.class ? (
                          <>
                            {currentEnrollment.class.className}
                            {currentEnrollment.class.course && ` · ${currentEnrollment.class.course.name}`}
                          </>
                        ) : (
                          "Chưa ghi danh"
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3">
                      <span className="text-sm font-semibold text-[#64748b]">Lịch học</span>
                      <p className="text-sm font-bold text-[#0f1729] mt-1">
                        {currentEnrollment?.class.scheduleRules.length
                          ? currentEnrollment.class.scheduleRules.map((item) => `${item.weekday}-${item.startTime}`).join(", ")
                          : "Chưa có"}
                      </p>
                    </div>
                  </div>
                </div>

                {currentEnrollment?.class && courseProgress?.planned !== null && courseProgress && (
                  <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h2 className="text-lg font-black tracking-tight text-[#0f1729]">Tiến độ khóa học</h2>
                        <p className="mt-1 text-sm text-[#64748b]">Tính từ ngày ghi danh {formatDate(currentEnrollment.enrollDate)}.</p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] border border-[#e5eaf7] p-5">
                      <div className="flex items-baseline justify-between mb-3">
                        <p className="text-sm font-bold text-[#0f1729]">
                          {currentEnrollment.class.className}
                          {currentEnrollment.class.course && ` · ${currentEnrollment.class.course.name}`}
                        </p>
                        <p className="text-2xl font-black text-[#3b82f6]">
                          {courseProgress.consumed}/{courseProgress.planned} <span className="text-sm font-normal text-[#64748b]">buổi</span>
                        </p>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-white/60">
                        <div
                          className={`h-full rounded-full ${courseProgress.remaining !== null && courseProgress.remaining <= 0 ? "bg-[#10b981]" : "bg-[#3b82f6]"}`}
                          style={{ width: `${Math.min(100, Math.max(2, (courseProgress.consumed / Math.max(1, courseProgress.planned)) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-black tracking-tight text-[#0f1729] mb-4">Cần chú ý</h2>
                  <div className="space-y-2">
                    {!currentEnrollment && (
                      <div className="flex items-center gap-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] px-4 py-3">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#ef4444]" />
                        <span className="text-sm font-semibold text-[#991b1b]">Chưa có lớp đang học</span>
                      </div>
                    )}
                    {!primaryGuardian && (
                      <div className="flex items-center gap-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] px-4 py-3">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#ef4444]" />
                        <span className="text-sm font-semibold text-[#991b1b]">Chưa gắn phụ huynh chính</span>
                      </div>
                    )}
                    {primaryGuardian && !primaryGuardian.user && (
                      <div className="flex items-center gap-3 rounded-xl bg-[#fef9c3] border border-[#fde047] px-4 py-3">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#f59e0b]" />
                        <span className="text-sm font-semibold text-[#854d0e]">Phụ huynh chưa có portal</span>
                      </div>
                    )}
                    {outstanding > 0 && (
                      <div className="flex items-center gap-3 rounded-xl bg-[#fef9c3] border border-[#fde047] px-4 py-3">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#f59e0b]" />
                        <span className="text-sm font-semibold text-[#854d0e]">Còn nợ {formatVnd(outstanding)}</span>
                      </div>
                    )}
                    {student.bookIssues.some((issue) => issue.paymentStatus !== "PAID") && (
                      <div className="flex items-center gap-3 rounded-xl bg-[#fef9c3] border border-[#fde047] px-4 py-3">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#f59e0b]" />
                        <span className="text-sm font-semibold text-[#854d0e]">Có sách chưa thu đủ</span>
                      </div>
                    )}
                    {!currentEnrollment &&
                    primaryGuardian &&
                    primaryGuardian.user &&
                    outstanding <= 0 &&
                    !student.bookIssues.some((issue) => issue.paymentStatus !== "PAID") ? (
                      <div className="flex items-center gap-3 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] px-4 py-3">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#10b981]" />
                        <span className="text-sm font-semibold text-[#065f46]">Hiện không có cảnh báo mở</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-black tracking-tight text-[#0f1729] mb-4">Lịch sử thay đổi</h2>
                  <div className="space-y-2">
                    {student.statusHistory.map((item) => (
                      <div key={item.id} className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-[#0f1729] text-sm">
                              {item.fromStatus ?? "INIT"} → {item.toStatus}
                            </p>
                            <p className="mt-1 text-xs text-[#64748b]">{item.reason ?? "Không có ghi chú"}</p>
                          </div>
                          <span className="text-xs text-[#64748b]">{formatDate(item.changedAt)}</span>
                        </div>
                      </div>
                    ))}
                    {student.statusHistory.length === 0 && <p className="text-sm text-[#64748b] bg-[#f8faff] rounded-xl p-4 border border-[#e5eaf7]">Chưa có lịch sử thay đổi.</p>}
                  </div>
                </div>
              </div>
            ),
          },
          ...(canSeeFinance ? [{
            key: "hocphi",
            label: "Học phí",
            content: (
              <div className="space-y-5">
                <StudentFinanceDesk
                  studentId={student.id}
                  studentName={student.fullName}
                  studentCode={student.studentCode}
                  outstanding={outstanding}
                  dueNowAmount={dueNowAmount}
                  currentClassName={currentEnrollment?.class?.className ?? null}
                  canIssueBooks={activeEnrollments.length > 0}
                  activeEnrollmentOptions={activeEnrollments.map((enrollment) => ({
                    enrollmentId: enrollment.id,
                    classId: enrollment.classId,
                    className: enrollment.class?.className ?? "Lớp chưa rõ tên",
                    billingModel: enrollment.billingModel,
                  }))}
                  nextDueCharge={nextDueCharge ? nextDueCharge : null}
                  charges={chargeSummaries}
                  bookIssues={student.bookIssues.map((issue) => ({
                    id: issue.id,
                    bookId: issue.bookId,
                    bookName: issue.book.name,
                    quantity: issue.quantity,
                    amount: issue.amount,
                    issueDate: issue.issueDate.toISOString(),
                    paymentStatus: issue.paymentStatus,
                    className: issue.class?.className ?? null,
                    notes: issue.notes,
                  }))}
                  bookRequirements={[]}
                  canManageFinance={canManageFinance}
                  canManageInventory={canManageInventory}
                />

                <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-lg font-black tracking-tight text-[#0f1729]">Các kỳ học phí gần đây</h2>
                      <p className="mt-1 text-sm text-[#64748b]">Xem nhanh kỳ nào còn nợ, kỳ nào đã thu xong.</p>
                    </div>
                    {canManageFinance && outstanding > 0 && <QuickPaymentButton studentId={student.id} suggestedAmount={outstanding} />}
                  </div>
                  <div className="space-y-3">
                    {student.charges.slice(0, 6).map((charge) => {
                      const paid = charge.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
                      const remaining = chargeOwnDueAmount(charge) - paid;
                      return (
                        <div key={charge.id} className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] p-4 hover:border-[#3b82f6] transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-[#0f1729]">{charge.billingPeriod.periodName} · {charge.class.className}</p>
                              <p className="mt-1 text-xs text-[#64748b]">
                                {charge.sessionCount} buổi · nghỉ {charge.absentCount} · trừ {charge.deductedCount}
                                {charge.invoice ? ` · Phiếu ${charge.invoice.invoiceNo}` : " · Chưa có phiếu"}
                              </p>
                            </div>
                            <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${remaining > 0 ? "bg-[#fef9c3] text-[#854d0e]" : "bg-[#dcfce7] text-[#166534]"}`}>
                              {remaining > 0 ? `Còn ${formatVnd(remaining)}` : "Đã đủ"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {student.charges.length === 0 && <p className="text-sm text-[#64748b] bg-[#f8faff] rounded-xl p-4 border border-[#e5eaf7]">Chưa có kỳ học phí nào.</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm overflow-hidden">
                    <div className="mb-5">
                      <h2 className="text-lg font-black tracking-tight text-[#0f1729]">Lịch sử thu</h2>
                      <p className="mt-1 text-sm text-[#64748b]">Các lần thu tiền và hoàn tiền gần đây.</p>
                    </div>
                    <div className="space-y-3">
                      {student.payments.slice(0, 6).map((payment) => {
                        const refunded = payment.refunds.reduce((sum, refund) => sum + refund.amount, 0);
                        return (
                          <div key={payment.id} className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                              <p className="font-bold text-[#0f1729]">{payment.paymentNo} · {formatDate(payment.paidDate)}</p>
                              <p className="mt-1 text-xs text-[#64748b]">
                                  {payment.method ?? "—"} · {payment.cashPosting?.cashTransaction ? `Đã vào quỹ ${formatDate(payment.cashPosting.cashTransaction.txnDate)}` : "Chưa thấy vào quỹ"}
                              </p>
                              </div>
                              <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${badgeClass(payment.status)}`}>{paymentStatusLabel(payment.status, refunded)}</span>
                            </div>
                            {canManageFinance && (
                              <div className="mt-3 flex justify-end">
                                <RefundButton paymentId={payment.id} refundable={payment.amount - refunded} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {student.payments.length === 0 && <p className="text-sm text-[#64748b] bg-[#f8faff] rounded-xl p-4 border border-[#e5eaf7]">Chưa có phiếu thu nào.</p>}
                    </div>
                  </div>

                  {canEditStudent && (
                    <ScholarshipAdjustmentForm
                      studentId={student.id}
                      scholarships={student.scholarships}
                      adjustments={student.adjustments}
                      enrollments={student.enrollments.map((e) => ({ id: e.id, className: e.class.className, status: e.status }))}
                    />
                  )}
                </div>
              </div>
            ),
          }] : []),
          {
            key: "hoctap",
            label: "Học tập",
            content: (
              <div className="space-y-5">
                <StudentSessionCredits
                  credits={student.sessionCredits.map((c) => ({
                    id: c.id,
                    status: c.status,
                    origin: c.origin,
                    paidAmount: c.paidAmount,
                    sourceSession: c.sourceSession ? { sessionDate: c.sourceSession.sessionDate, class: c.sourceSession.class } : null,
                    consumedSession: c.consumedSession ? { sessionDate: c.consumedSession.sessionDate, class: c.consumedSession.class } : null,
                    className: c.sourceSession?.class.className ?? c.consumedSession?.class.className ?? currentEnrollment?.class?.className ?? "Chưa rõ lớp",
                  }))}
                  sessionOptions={makeupSessionOptions.map((s) => ({
                    id: s.id,
                    sessionDate: s.sessionDate,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    class: s.class,
                  }))}
                  canManage={canManageSchedule}
                />

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                    <div className="mb-5">
                      <h2 className="text-lg font-black tracking-tight text-[#0f1729]">Buổi học gần đây</h2>
                      <p className="mt-1 text-sm text-[#64748b]">Xem nhanh tình trạng học ở các buổi gần nhất.</p>
                    </div>
                    <div className="space-y-3">
                      {recentSessions.map(({ attendance, teachers, assistants, sessionNumber, roadmapItem }) => {
                        const sessionHref = `/classes/${attendance.session.classId}/sessions/${attendance.session.id}`;
                        const classHref = `/classes/${attendance.session.classId}`;
                        const journalLesson = attendance.session.journal?.unitLesson?.trim();
                        const lessonTitle = roadmapItem?.title?.trim() || journalLesson || null;
                        const lessonDetail = roadmapItem?.objective?.trim() || attendance.session.journal?.teacherNote?.trim() || null;

                        return (
                          <div key={attendance.id} className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] p-4 transition-colors hover:border-[#3b82f6]">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <Link href={sessionHref} className="font-bold text-[#0f1729] hover:text-[#2563eb]">
                                    {formatDate(attendance.session.sessionDate)}
                                    {sessionNumber ? ` · Buổi ${sessionNumber}` : ""}
                                  </Link>
                                  <span className="text-xs font-semibold text-[#94a3b8]">trong</span>
                                  <Link href={classHref} className="text-sm font-bold text-[#f97316] hover:text-[#ea580c]">
                                    {attendance.session.class.className}
                                  </Link>
                                </div>

                                <div className="mt-2 rounded-lg border border-[#e5eaf7] bg-white px-3 py-2">
                                  <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Bài đã học</p>
                                  <p className="mt-1 text-sm font-bold text-[#0f1729]">
                                    {lessonTitle ?? "Chưa gắn bài/roadmap cho buổi này"}
                                  </p>
                                  {lessonDetail ? <p className="mt-1 text-xs leading-5 text-[#64748b]">{lessonDetail}</p> : null}
                                </div>

                                <p className="mt-2 text-xs text-[#64748b]">
                                  GV: {teachers || "Chưa phân công"} · TG: {assistants || "—"} · Nhật ký: {attendance.session.journal?.publishedAt ? "Đã gửi PH" : attendance.session.journal ? "Đang lưu nháp" : "Chưa có"}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Link href={sessionHref} className="inline-flex items-center rounded-lg bg-[#dbeafe] px-2.5 py-1 text-xs font-bold text-[#1d4ed8] hover:bg-[#bfdbfe]">
                                    Mở buổi học →
                                  </Link>
                                  <Link href={classHref} className="inline-flex items-center rounded-lg bg-white border border-[#e5eaf7] px-2.5 py-1 text-xs font-bold text-[#64748b] hover:border-[#f97316] hover:text-[#f97316]">
                                    Mở lớp →
                                  </Link>
                                </div>
                              </div>
                              <span className={`inline-flex shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold whitespace-nowrap ${attendance.status === "ABSENT" ? "bg-[#fee2e2] text-[#991b1b]" : attendance.status === "MAKEUP" ? "bg-[#e0f2fe] text-[#075985]" : "bg-[#dcfce7] text-[#166534]"}`}>
                                {attendanceLabel(attendance.status)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {recentSessions.length === 0 && <p className="text-sm text-[#64748b] bg-[#f8faff] rounded-xl p-4 border border-[#e5eaf7]">Chưa có buổi học nào để đối chiếu.</p>}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                    <div className="mb-5">
                      <h2 className="text-lg font-black tracking-tight text-[#0f1729]">Nhận xét gần đây</h2>
                      <p className="mt-1 text-sm text-[#64748b]">Các nhận xét học tập mới nhất của giáo viên.</p>
                    </div>
                    <div className="space-y-3">
                      {student.journalEntries.slice(0, 3).map((entry) => (
                        <div key={entry.id} className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] p-4">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Link href={`/classes/${entry.journal.session.classId}/sessions/${entry.journal.sessionId}`} className="font-bold text-[#0f1729] hover:text-[#2563eb]">
                              {formatDate(entry.journal.session.sessionDate)}
                            </Link>
                            <span className="text-xs font-semibold text-[#94a3b8]">·</span>
                            <Link href={`/classes/${entry.journal.session.classId}`} className="text-sm font-bold text-[#f97316] hover:text-[#ea580c]">
                              {entry.journal.session.class.className}
                            </Link>
                          </div>
                          {entry.journal.unitLesson ? <p className="mt-1 text-xs font-bold text-[#64748b]">{entry.journal.unitLesson}</p> : null}
                          <p className="mt-1 text-sm text-[#64748b]">{entry.comment ?? "Chưa có nhận xét riêng."}</p>
                        </div>
                      ))}
                      {student.journalEntries.length === 0 && <p className="text-sm text-[#64748b] bg-[#f8faff] rounded-xl p-4 border border-[#e5eaf7]">Chưa có journal nào gần đây.</p>}
                    </div>
                  </div>
                </div>

                {canEditStudent ? <SchoolExamScoreForm studentId={student.id} scores={student.schoolExamScores} /> : null}
              </div>
            ),
          },
          {
            key: "phuhuynh",
            label: "Phụ huynh",
            content: (
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div>
                      <h2 className="text-lg font-black tracking-tight text-[#0f1729]">Phụ huynh liên kết</h2>
                      <p className="mt-1 text-sm text-[#64748b]">Xem liên hệ chính, portal và vai trò của từng người.</p>
                    </div>
                    <Link href="/guardians" className="inline-flex items-center gap-1 text-sm font-bold text-[#3b82f6] hover:text-[#0ea5e9]">
                      Danh bạ <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {student.guardians.map((item) => (
                      <div key={item.id} className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4 hover:border-[#3b82f6] transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-bold text-[#0f1729]">
                              {item.guardian.fullName}
                              {item.isPrimary && <span className="ml-2 inline-flex items-center rounded-lg bg-[#3b82f6] px-2 py-0.5 text-[10px] font-bold text-white">CHÍNH</span>}
                            </p>
                            <p className="mt-1 text-xs text-[#64748b]">
                              {item.relation ?? "Người liên hệ"} · {item.guardian.phone ?? "Chưa có SĐT"}
                            </p>
                          </div>
                          <Link href={`/guardians/${item.guardian.id}`} className="text-sm font-bold text-[#3b82f6] hover:text-[#0ea5e9]">
                            Mở →
                          </Link>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center rounded-lg bg-white border border-[#e5eaf7] px-2.5 py-1 text-xs font-semibold text-[#64748b]">{item.guardian.user?.email ?? "Chưa cấp portal"}</span>
                          <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ${item.guardian.user?.isActive ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fef9c3] text-[#854d0e]"}`}>
                            {item.guardian.user ? (item.guardian.user.isActive ? "Portal hoạt động" : "Portal chưa kích hoạt") : "Chưa có portal"}
                          </span>
                        </div>
                      </div>
                    ))}
                    {student.guardians.length === 0 && <p className="text-sm text-[#64748b] bg-[#f8faff] rounded-xl p-4 border border-[#e5eaf7]">Chưa liên kết phụ huynh nào.</p>}
                  </div>
                </div>

                {canManageGuardianAccount && primaryGuardian && (
                  <GuardianAccountPanel
                    guardianId={primaryGuardian.id}
                    account={primaryGuardian.user ? { email: primaryGuardian.user.email, isActive: primaryGuardian.user.isActive } : null}
                    defaultEmail=""
                  />
                )}
              </div>
            ),
          },
          {
            key: "hoso",
            label: "Hồ sơ",
            content: canEditStudent ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-black tracking-tight text-[#0f1729]">Cập nhật hồ sơ</h2>
                  <p className="mt-1 text-sm text-[#64748b]">Sửa thông tin cá nhân, trạng thái và ghi chú nội bộ.</p>
                </div>
                <StudentEditForm
                  studentId={student.id}
                  initial={{
                    status: student.status,
                    gender: student.gender ?? "",
                    dob: student.dob ? student.dob.toISOString().slice(0, 10) : "",
                    phone: student.phone ?? "",
                    address: student.address ?? "",
                    leaveReason: student.leaveReason ?? "",
                    evaluation: student.evaluation ?? "",
                    referredBy: student.referredBy ?? "",
                    notes: student.notes ?? "",
                  }}
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black tracking-tight text-[#0f1729] mb-5">Hồ sơ học viên</h2>
                <div className="space-y-3">
                  <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#64748b]">Giới tính</span>
                    <span className="text-sm font-bold text-[#0f1729]">{student.gender ?? "—"}</span>
                  </div>
                  <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#64748b]">Ngày sinh</span>
                    <span className="text-sm font-bold text-[#0f1729]">{formatDate(student.dob)}</span>
                  </div>
                  <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#64748b]">Địa chỉ</span>
                    <span className="text-sm font-bold text-[#0f1729]">{student.address ?? "—"}</span>
                  </div>
                  <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#64748b]">Người giới thiệu</span>
                    <span className="text-sm font-bold text-[#0f1729]">{student.referredBy ?? "—"}</span>
                  </div>
                  {student.notes && (
                    <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3">
                      <span className="text-sm font-semibold text-[#64748b]">Ghi chú nội bộ</span>
                      <p className="mt-1 text-sm font-bold text-[#0f1729]">{student.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ),
          },
        ]}
      />
      </div>
    </div>
  );
}







