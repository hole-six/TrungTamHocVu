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
import { computeOutstandingBalance } from "@/lib/server/balance";
import { computeEnrollmentSessionProgress } from "@/lib/server/class-generation";
import { getVietnamToday } from "@/lib/server/class-rules";
import EditableDateField from "@/components/ui/EditableDateField";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate, canUpdate, canView } from "@/lib/server/role-matrix";

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function formatDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("vi-VN") : "—";
}

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
    case "EXCUSED":
      return "Vắng có phép";
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

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { from?: string; focus?: string };
}) {
  const student = await prisma.student.findUnique({
    where: { id: params.id },
    include: {
      lead: true,
      guardians: {
        include: { guardian: { include: { user: true } } },
        orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
      },
      enrollments: {
        include: { class: { include: { course: true, scheduleRules: { where: { isActive: true }, orderBy: { weekday: "asc" } } } } },
        orderBy: [{ enrollDate: "desc" }, { createdAt: "desc" }],
      },
      charges: {
        include: {
          billingPeriod: true,
          class: true,
          invoice: true,
          allocations: { include: { payment: { include: { cashPosting: { include: { cashTransaction: true } } } } } },
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
      adjustments: { orderBy: { effectiveFrom: "desc" } },
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
        take: 8,
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

  const currentUser = await getCurrentUser();
  const role = currentUser ? await getUserRole(currentUser.id) : null;
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

  const outstanding = await computeOutstandingBalance(student.id);
  const activeEnrollments = student.enrollments.filter((e) => e.status === "ACTIVE");
  const currentEnrollment = activeEnrollments[0] ?? student.enrollments[0] ?? null;
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
      if (attendance.status === "EXCUSED") acc.excused += 1;
      return acc;
    },
    { present: 0, absent: 0, makeup: 0, excused: 0 }
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

    return {
      attendance,
      teachers,
      assistants,
    };
  });

  const unusedCreditAmount = student.creditBalances.reduce((sum, credit) => sum + credit.amount, 0);
  const chargeRemainingMap = new Map<string, { paidAmount: number; remainingAmount: number }>();
  let creditLeft = unusedCreditAmount;

  [...student.charges]
    .sort((a, b) => a.billingPeriod.startDate.getTime() - b.billingPeriod.startDate.getTime())
    .forEach((charge) => {
      const paidAmount = charge.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
      const rawRemaining = Math.max(0, charge.totalAmount - paidAmount);
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
      remainingAmount: Math.max(0, charge.totalAmount - charge.allocations.reduce((sum, alloc) => sum + alloc.amount, 0)),
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
      if (charge.totalAmount > 0) {
        acc.tuitionPaid += charge.paidAmount * (charge.tuitionAmount / charge.totalAmount);
        acc.materialsPaid += charge.paidAmount * (charge.materialsAmount / charge.totalAmount);
      }
      return acc;
    },
    { tuitionPaid: 0, materialsPaid: 0 }
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#dbe7fb] bg-white px-5 py-5 shadow-sm">
        <Link href="/students" className="text-sm font-medium text-primary">
          ← Quay lại danh sách học viên
        </Link>

        <div className="mt-4 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">
                Hồ sơ học viên
              </span>
              <span className={`badge ${badgeClass(student.status)}`}>{student.status === "ACTIVE" ? "Đang học" : "Đã nghỉ"}</span>
              {currentEnrollment ? (
                <span className={`badge ${badgeClass(currentEnrollment.status)}`}>
                  {currentEnrollment.status === "ACTIVE" ? "Ghi danh đang chạy" : currentEnrollment.status}
                </span>
              ) : null}
              {outstanding > 0 ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Còn nợ {formatVnd(outstanding)}</span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Đã cân học phí</span>
              )}
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-ink">{student.fullName}</h1>
              <p className="mt-1 text-sm text-ink-muted48">
                Mã HV {student.studentCode}
                {student.lead?.leadCode ? ` · Lead ${student.lead.leadCode}` : ""}
                {currentEnrollment?.class?.className ? ` · ${currentEnrollment.class.className}` : " · Chưa ghi danh"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                PH {primaryGuardian?.fullName ?? "chưa liên kết"}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Portal {primaryGuardian?.user?.email ?? "chưa cấp"}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Học gần nhất {formatDate(recentSessions[0]?.attendance.session.sessionDate ?? null)}
              </span>
              {nextDueCharge ? (
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                  Kỳ cần xử lý {nextDueCharge.periodName}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {canEditStudent ? (
              <AssignEnrollmentForm
                student={{
                  id: student.id,
                  fullName: student.fullName,
                  studentCode: student.studentCode,
                  currentClassName: currentEnrollment?.class?.className ?? null,
                }}
                triggerLabel={currentEnrollment ? "Gán thêm lớp" : "Gán nhập học"}
              />
            ) : null}
            {canManageFinance ? <QuickPaymentButton studentId={student.id} suggestedAmount={outstanding} autoOpen={autoOpenTuition} /> : null}
            {currentEnrollment?.classId ? (
              <Link href={`/classes/${currentEnrollment.classId}`} className="btn-ghost-sm">
                Mở lớp hiện tại
              </Link>
            ) : null}
            {canSeeFinance ? (
              <Link href="/tuition" className="btn-ghost-sm">
                Mở học phí
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {showIntakeBanner ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-800">Đã hoàn tất luồng nhập học</p>
              <p className="mt-1 text-sm text-emerald-700">
                Học viên đã được tạo, liên kết phụ huynh
                {currentEnrollment?.class?.className ? ` và ghi danh vào lớp ${currentEnrollment.class.className}` : ""}.
                {canSeeFinance ? " Có thể xử lý học phí và portal ngay tại màn 360 này." : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {canManageFinance ? <QuickPaymentButton studentId={student.id} suggestedAmount={outstanding} autoOpen={autoOpenTuition} /> : null}
              {primaryGuardian ? (
                <Link href={`/guardians/${primaryGuardian.id}`} className="text-sm font-medium text-primary">
                  Mở phụ huynh →
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700">Cần thu ngay</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-rose-800">{formatVnd(dueNowAmount)}</p>
          <p className="mt-1 text-xs text-rose-700">{nextDueCharge ? `Kỳ ${nextDueCharge.periodName} đã đến hạn` : "Không có kỳ nào đến hạn"}</p>
        </div>
        <div className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Tổng đã lập</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-sky-800">{formatVnd(totalCharged)}</p>
          <p className="mt-1 text-xs text-sky-700">Học phí + sách + nợ đầu kỳ · {student.charges.length} kỳ (gồm kỳ chưa tới hạn)</p>
        </div>
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Đã thu</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-emerald-800">{formatVnd(totalPaid)}</p>
          <p className="mt-1 text-xs text-emerald-700">Học phí {formatVnd(Math.round(tuitionPaid))} · Sách {formatVnd(Math.round(materialsPaid))}</p>
        </div>
        <div className="rounded-[22px] border border-violet-200 bg-violet-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">Điểm danh</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-violet-800">{attendanceStats.present}</p>
          <p className="mt-1 text-xs text-violet-700">Vắng {attendanceStats.absent} · Bù {attendanceStats.makeup}</p>
        </div>
        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">Portal</p>
          <p className="mt-2 truncate font-semibold tracking-tight text-slate-900">{primaryGuardian?.user?.email ?? "Chưa cấp"}</p>
          <p className="mt-1 text-xs text-slate-700">{primaryGuardian?.user ? (primaryGuardian.user.isActive ? "Đang hoạt động" : "Đã thu hồi") : "Chưa có tài khoản"}</p>
        </div>
        <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Giáo trình</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-amber-800">{formatVnd(unpaidBookAmount)}</p>
          <p className="mt-1 text-xs text-amber-700">{unpaidBookAmount > 0 ? "Sách chưa thu" : "Đã thu đủ tiền sách"}</p>
        </div>
      </div>

      <DetailTabs
        defaultTabKey={autoOpenTuition ? "hocphi" : "tongquan"}
        tabs={[
          {
            key: "tongquan",
            label: "Tổng quan",
            content: (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.9fr)]">
                <div className="space-y-6">
                  <div className="card">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="font-display text-lg font-semibold tracking-tight">Tổng quan học viên</h2>
                        <p className="mt-1 text-sm text-ink-muted48">Hồ sơ chính, liên kết vận hành và tiến độ lớp hiện tại.</p>
                      </div>
                      {student.lead ? (
                        <Link href={`/leads/${student.lead.id}`} className="text-sm font-medium text-primary">
                          Xem lead gốc →
                        </Link>
                      ) : null}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Hồ sơ học viên</p>
                        <dl className="mt-3 space-y-2 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-ink-muted48">Ngày nhập học</dt>
                            <dd className="font-medium">
                              {canEditStudent ? (
                                <EditableDateField endpoint={`/api/students/${student.id}`} field="enrollDate" value={student.enrollDate} width="w-32" />
                              ) : (
                                formatDate(student.enrollDate)
                              )}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-ink-muted48">Ngày sinh</dt>
                            <dd className="font-medium">
                              {canEditStudent ? (
                                <EditableDateField endpoint={`/api/students/${student.id}`} field="dob" value={student.dob} width="w-32" />
                              ) : (
                                formatDate(student.dob)
                              )}
                            </dd>
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <dt className="text-ink-muted48">Giới tính</dt>
                            <dd className="text-right font-medium">{student.gender ?? "—"}</dd>
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <dt className="text-ink-muted48">SĐT / Địa chỉ</dt>
                            <dd className="text-right font-medium">{student.phone ?? "—"} · {student.address ?? "—"}</dd>
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <dt className="text-ink-muted48">Người giới thiệu</dt>
                            <dd className="text-right font-medium">{student.referredBy ?? "—"}</dd>
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <dt className="text-ink-muted48">Đánh giá nội bộ</dt>
                            <dd className="text-right font-medium">{student.evaluation ?? "Chưa có"}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Liên kết vận hành</p>
                        <dl className="mt-3 space-y-2 text-sm">
                          <div className="flex items-start justify-between gap-4">
                            <dt className="text-ink-muted48">Lead gốc</dt>
                            <dd className="text-right font-medium">
                              {student.lead ? <Link href={`/leads/${student.lead.id}`} className="text-primary">{student.lead.leadCode}</Link> : "Không gắn lead"}
                            </dd>
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <dt className="text-ink-muted48">Phụ huynh chính</dt>
                            <dd className="text-right font-medium">
                              {primaryGuardian ? <Link href={`/guardians/${primaryGuardian.id}`} className="text-primary">{primaryGuardian.fullName}</Link> : "Chưa liên kết"}
                            </dd>
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <dt className="text-ink-muted48">Portal</dt>
                            <dd className="text-right font-medium">{primaryGuardian?.user?.email ?? "Chưa cấp"}</dd>
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <dt className="text-ink-muted48">Lớp / khóa hiện tại</dt>
                            <dd className="text-right font-medium">
                              {currentEnrollment?.class ? (
                                <>
                                  {currentEnrollment.class.className}
                                  {currentEnrollment.class.course ? ` · ${currentEnrollment.class.course.name}` : ""}
                                </>
                              ) : (
                                "Chưa ghi danh"
                              )}
                            </dd>
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <dt className="text-ink-muted48">Lịch học chuẩn</dt>
                            <dd className="text-right font-medium">
                              {currentEnrollment?.class.scheduleRules.length
                                ? currentEnrollment.class.scheduleRules.map((item) => `${item.weekday}-${item.startTime}`).join(", ")
                                : "Chưa có"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>

                    {currentEnrollment?.class && courseProgress?.planned !== null && courseProgress ? (
                      <div className="mt-4 rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Tiến độ khóa học hiện tại</p>
                          <p className="text-xs text-ink-muted48">Tính từ ngày ghi danh {formatDate(currentEnrollment.enrollDate)}</p>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <p className="text-sm font-semibold text-ink">
                            {currentEnrollment.class.className}
                            {currentEnrollment.class.course ? ` · ${currentEnrollment.class.course.name}` : ""}
                          </p>
                          <p className="font-display text-lg font-semibold tracking-tight">
                            {courseProgress.consumed}/{courseProgress.planned} <span className="text-sm font-normal text-ink-muted48">buổi</span>
                          </p>
                        </div>
                        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-ink/10">
                          <div
                            className={`h-full rounded-full ${courseProgress.remaining !== null && courseProgress.remaining <= 0 ? "bg-emerald-500" : "bg-primary"}`}
                            style={{ width: `${Math.min(100, Math.max(2, (courseProgress.consumed / Math.max(1, courseProgress.planned)) * 100))}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="card">
                    <h2 className="font-display text-base font-bold tracking-tight text-ink">Cảnh báo vận hành</h2>
                    <ul className="mt-3 space-y-2 text-sm">
                      {!currentEnrollment ? <li>• Chưa có enrollment hiện tại.</li> : null}
                      {!primaryGuardian ? <li>• Chưa gắn phụ huynh chính.</li> : null}
                      {primaryGuardian && !primaryGuardian.user ? <li>• Phụ huynh chưa có portal.</li> : null}
                      {outstanding > 0 ? <li>• Còn nợ {formatVnd(outstanding)}.</li> : null}
                      {recentSessions.some((item) => item.attendance.session.journal == null) ? <li>• Có buổi học chưa có journal.</li> : null}
                      {student.bookIssues.some((issue) => issue.paymentStatus !== "PAID") ? <li>• Có giáo trình chưa thu đủ.</li> : null}
                      {!student.notes && !student.evaluation ? <li>• Hồ sơ nội bộ còn trống ghi chú/đánh giá.</li> : null}
                    </ul>
                    {!currentEnrollment &&
                    primaryGuardian &&
                    primaryGuardian.user &&
                    outstanding <= 0 &&
                    !recentSessions.some((item) => item.attendance.session.journal == null) &&
                    !student.bookIssues.some((issue) => issue.paymentStatus !== "PAID") &&
                    (student.notes || student.evaluation) ? (
                      <p className="mt-3 text-sm text-emerald-700">Hiện không có cảnh báo mở.</p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="card">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Lịch sử trạng thái</p>
                    <div className="mt-3 space-y-2">
                      {student.statusHistory.map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-canvas-parchment/50 px-3 py-2 text-xs">
                          <div>
                            <p className="font-medium text-ink">
                              {item.fromStatus ?? "INIT"} → {item.toStatus}
                            </p>
                            <p className="mt-1 text-ink-muted48">{item.reason ?? "Không có lý do ghi lại"}</p>
                          </div>
                          <span className="text-ink-muted48">{formatDate(item.changedAt)}</span>
                        </div>
                      ))}
                      {student.statusHistory.length === 0 ? <p className="text-sm text-ink-muted48">Chưa có lịch sử trạng thái.</p> : null}
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "hocphi",
            label: "Học phí",
            content: (
              <div className="space-y-6">
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

                <div className="card overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-display text-lg font-semibold tracking-tight">Kỳ học phí gần nhất</h2>
                      <p className="mt-1 text-sm text-ink-muted48">Nhìn nhanh công nợ, số buổi và invoice.</p>
                    </div>
                    {canManageFinance && outstanding > 0 ? <QuickPaymentButton studentId={student.id} suggestedAmount={outstanding} /> : null}
                  </div>
                  <div className="mt-4 space-y-3">
                    {student.charges.slice(0, 6).map((charge) => {
                      const paid = charge.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
                      const remaining = charge.totalAmount - paid;
                      return (
                        <div key={charge.id} className="rounded-2xl border border-hairline p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-ink">{charge.billingPeriod.periodName} · {charge.class.className}</p>
                              <p className="mt-1 text-xs text-ink-muted48">
                                {charge.sessionCount} buổi · nghỉ {charge.absentCount} · trừ {charge.deductedCount}
                                {charge.invoice ? ` · Invoice ${charge.invoice.invoiceNo}` : " · Chưa phát hành invoice"}
                              </p>
                            </div>
                            <span className={`badge ${remaining > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                              {remaining > 0 ? `Còn ${formatVnd(remaining)}` : "Đã đủ"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {student.charges.length === 0 ? <p className="text-sm text-ink-muted48">Chưa có kỳ học phí nào.</p> : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div className="card overflow-hidden">
                    <div>
                      <h2 className="font-display text-lg font-semibold tracking-tight">Lịch sử thu</h2>
                      <p className="mt-1 text-sm text-ink-muted48">Tình trạng thanh toán và hoàn tiền.</p>
                    </div>
                    <div className="mt-4 space-y-3">
                      {student.payments.slice(0, 6).map((payment) => {
                        const refunded = payment.refunds.reduce((sum, refund) => sum + refund.amount, 0);
                        return (
                          <div key={payment.id} className="rounded-2xl border border-hairline p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-ink">{payment.paymentNo} · {formatDate(payment.paidDate)}</p>
                                <p className="mt-1 text-xs text-ink-muted48">
                                  {payment.method ?? "—"} · {payment.cashPosting?.cashTransaction ? `Đã post quỹ ${formatDate(payment.cashPosting.cashTransaction.txnDate)}` : "Chưa thấy cash posting"}
                                </p>
                              </div>
                              <span className={`badge ${badgeClass(payment.status)}`}>{paymentStatusLabel(payment.status, refunded)}</span>
                            </div>
                            {canManageFinance ? (
                              <div className="mt-3 flex justify-end">
                                <RefundButton paymentId={payment.id} refundable={payment.amount - refunded} />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      {student.payments.length === 0 ? <p className="text-sm text-ink-muted48">Chưa có phiếu thu nào.</p> : null}
                    </div>
                  </div>

                  {canEditStudent ? (
                    <ScholarshipAdjustmentForm
                      studentId={student.id}
                      scholarships={student.scholarships}
                      adjustments={student.adjustments}
                      enrollments={student.enrollments.map((e) => ({ id: e.id, className: e.class.className, status: e.status }))}
                    />
                  ) : null}
                </div>
              </div>
            ),
          },
          {
            key: "hoctap",
            label: "Học tập",
            content: (
              <div className="space-y-6">
                <StudentSessionCredits
                  credits={student.sessionCredits.map((c) => ({
                    id: c.id,
                    status: c.status,
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

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div className="card">
                    <div>
                      <h2 className="font-display text-lg font-semibold tracking-tight">Buổi học gần đây</h2>
                      <p className="mt-1 text-sm text-ink-muted48">Điểm danh, giáo viên và nhật ký buổi học.</p>
                    </div>
                    <div className="mt-4 space-y-3">
                      {recentSessions.map(({ attendance, teachers, assistants }) => (
                        <div key={attendance.id} className="rounded-2xl border border-hairline p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-ink">{attendance.session.class.className} · {formatDate(attendance.session.sessionDate)}</p>
                              <p className="mt-1 text-xs text-ink-muted48">
                                GV: {teachers || "Chưa phân công"} · TG: {assistants || "—"} · Journal: {attendance.session.journal?.publishedAt ? "Đã publish" : attendance.session.journal ? "Đã lưu draft" : "Chưa có"}
                              </p>
                            </div>
                            <span className={`badge ${attendance.status === "ABSENT" ? "bg-red-100 text-red-700" : attendance.status === "MAKEUP" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>
                              {attendanceLabel(attendance.status)}
                            </span>
                          </div>
                        </div>
                      ))}
                      {recentSessions.length === 0 ? <p className="text-sm text-ink-muted48">Chưa có buổi học nào để đối chiếu.</p> : null}
                    </div>
                  </div>

                  <div className="card">
                    <div>
                      <h2 className="font-display text-lg font-semibold tracking-tight">Journal & giáo trình</h2>
                      <p className="mt-1 text-sm text-ink-muted48">Nhận xét học tập và tài liệu gần nhất.</p>
                    </div>
                    <div className="mt-4 space-y-3">
                      {student.journalEntries.slice(0, 3).map((entry) => (
                        <div key={entry.id} className="rounded-2xl border border-hairline p-4">
                          <p className="font-medium text-ink">{entry.journal.session.class.className} · {formatDate(entry.journal.session.sessionDate)}</p>
                          <p className="mt-1 text-sm text-ink-muted48">{entry.comment ?? "Chưa có nhận xét riêng."}</p>
                        </div>
                      ))}
                      {student.journalEntries.length === 0 ? <p className="text-sm text-ink-muted48">Chưa có journal nào gần đây.</p> : null}
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
              <div className="space-y-6">
                <div className="card">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Phụ huynh liên kết</p>
                      <p className="mt-1 text-sm text-ink-muted48">Liên hệ, portal và vai trò của từng phụ huynh.</p>
                    </div>
                    <Link href="/guardians" className="text-sm font-medium text-primary">
                      Mở danh bạ phụ huynh →
                    </Link>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {student.guardians.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-hairline bg-white/80 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ink">
                              {item.guardian.fullName}
                              {item.isPrimary ? <span className="ml-2 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">Chính</span> : null}
                            </p>
                            <p className="mt-1 text-xs text-ink-muted48">
                              {item.relation ?? "Người liên hệ"} · {item.guardian.phone ?? "Chưa có số điện thoại"}
                            </p>
                          </div>
                          <Link href={`/guardians/${item.guardian.id}`} className="text-sm font-medium text-primary">
                            Mở PH →
                          </Link>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="badge bg-ink/5 text-ink-muted80">{item.guardian.user?.email ?? "Chưa cấp portal"}</span>
                          <span className={`badge ${item.guardian.user?.isActive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {item.guardian.user ? (item.guardian.user.isActive ? "Portal hoạt động" : "Portal chưa kích hoạt") : "Chưa có portal"}
                          </span>
                        </div>
                      </div>
                    ))}
                    {student.guardians.length === 0 ? <p className="text-sm text-ink-muted48">Chưa liên kết phụ huynh nào.</p> : null}
                  </div>
                </div>

                {canManageGuardianAccount && primaryGuardian ? (
                  <GuardianAccountPanel
                    guardianId={primaryGuardian.id}
                    account={primaryGuardian.user ? { email: primaryGuardian.user.email, isActive: primaryGuardian.user.isActive } : null}
                    defaultEmail=""
                  />
                ) : null}
              </div>
            ),
          },
          {
            key: "hoso",
            label: "Hồ sơ",
            content: canEditStudent ? (
              <div className="space-y-6">
                <div className="card">
                  <h2 className="font-display text-lg font-semibold tracking-tight">Cập nhật hồ sơ</h2>
                  <p className="mt-1 text-sm text-ink-muted48">Chỉnh thông tin cá nhân, trạng thái và ghi chú nội bộ.</p>
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
              <div className="card space-y-3">
                <h2 className="font-display text-base font-bold tracking-tight text-ink">Hồ sơ</h2>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-ink-muted48">Giới tính</dt>
                    <dd className="font-medium">{student.gender ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted48">Ngày sinh</dt>
                    <dd className="font-medium">{formatDate(student.dob)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted48">Địa chỉ</dt>
                    <dd className="font-medium">{student.address ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted48">Người giới thiệu</dt>
                    <dd className="font-medium">{student.referredBy ?? "—"}</dd>
                  </div>
                  {student.notes ? (
                    <div>
                      <dt className="text-ink-muted48">Ghi chú nội bộ</dt>
                      <dd className="font-medium">{student.notes}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}







