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
import { computeOutstandingBalance } from "@/lib/server/balance";
import { computeEnrollmentSessionProgress } from "@/lib/server/class-generation";
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
  const currentEnrollment = student.enrollments.find((e) => e.status === "ACTIVE") ?? student.enrollments[0] ?? null;
  const courseProgress = currentEnrollment?.classId
    ? await computeEnrollmentSessionProgress(currentEnrollment.classId, currentEnrollment.enrollDate)
    : null;
  const primaryGuardianLink = student.guardians.find((item) => item.isPrimary) ?? student.guardians[0] ?? null;
  const primaryGuardian = primaryGuardianLink?.guardian ?? null;

  const totalCharged = student.charges.reduce((sum, charge) => sum + charge.totalAmount, 0);
  const totalPaid = student.payments.reduce((sum, payment) => sum + payment.amount, 0);

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
      periodName: charge.billingPeriod.periodName,
      className: charge.class.className,
      tuitionAmount: charge.tuitionAmount,
      materialsAmount: charge.materialsAmount,
      openingBalance: charge.openingBalance,
      totalAmount: charge.totalAmount,
      paidAmount: paymentState.paidAmount,
      remainingAmount: paymentState.remainingAmount,
    };
  });

  const nextDueCharge =
    [...chargeSummaries]
      .filter((charge) => charge.remainingAmount > 0)
      .sort((a, b) => a.periodName.localeCompare(b.periodName))[0] ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/students" className="text-sm text-primary">
          ← Quay lại danh sách học viên
        </Link>
        <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{student.fullName}</h1>
              <span className={`badge ${badgeClass(student.status)}`}>{student.status === "ACTIVE" ? "Đang học" : "Đã nghỉ"}</span>
              {currentEnrollment ? <span className={`badge ${badgeClass(currentEnrollment.status)}`}>Enrollment: {currentEnrollment.status}</span> : null}
              {outstanding > 0 ? <span className="badge bg-amber-100 text-amber-700">Còn nợ {formatVnd(outstanding)}</span> : <span className="badge bg-emerald-100 text-emerald-700">Đã cân học phí</span>}
            </div>
            <p className="mt-2 text-sm text-ink-muted48">
              Mã HV: <strong>{student.studentDisplayId ?? student.studentCode}</strong>
              {student.studentDisplayId ? <span> · Mã số gốc: {student.studentCode}</span> : null}
              {student.lead?.leadCode ? (
                <span>
                  {" · "}Lead gốc: <strong>{student.lead.leadCode}</strong>
                </span>
              ) : null}
              {" · "}Lớp hiện tại: {currentEnrollment?.class?.className ?? "Chưa ghi danh"}
              {" · "}Phụ huynh chính: {primaryGuardian?.fullName ?? "Chưa liên kết"}
            </p>
            <p className="mt-1 text-sm text-ink-muted48">
              Portal: {primaryGuardian?.user?.email ?? "Chưa cấp"} · Lần học gần nhất: {formatDate(recentSessions[0]?.attendance.session.sessionDate ?? null)}
              {nextDueCharge ? ` · Kỳ cần xử lý: ${nextDueCharge.periodName}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canEditStudent ? (
              <AssignEnrollmentForm
                student={{
                  id: student.id,
                  fullName: student.fullName,
                  studentCode: student.studentCode,
                  studentDisplayId: student.studentDisplayId,
                  currentClassName: currentEnrollment?.class?.className ?? null,
                }}
                triggerLabel={currentEnrollment ? "Gán thêm lớp" : "Gán nhập học"}
              />
            ) : null}
            {canManageFinance ? <QuickPaymentButton studentId={student.id} suggestedAmount={outstanding} autoOpen={autoOpenTuition} /> : null}
            {currentEnrollment?.classId ? (
              <Link href={`/classes/${currentEnrollment.classId}`} className="text-sm font-medium text-primary">
                Mở lớp hiện tại →
              </Link>
            ) : null}
            {canSeeFinance ? (
              <Link href="/tuition" className="text-sm font-medium text-primary">
                Mở học phí →
              </Link>
            ) : null}
          </div>
        </div>
      </div>

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Công nợ hiện tại</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatVnd(outstanding)}</p>
          <p className="mt-1 text-xs text-ink-muted48">{nextDueCharge ? `Đang vướng kỳ ${nextDueCharge.periodName}` : "Không có kỳ còn nợ"}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Tổng phải thu</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatVnd(totalCharged)}</p>
          <p className="mt-1 text-xs text-ink-muted48">{student.charges.length} kỳ học phí</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Đã thu & phân bổ</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatVnd(totalPaid)}</p>
          <p className="mt-1 text-xs text-ink-muted48">{student.payments.length} phiếu thu</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Điểm danh gần đây</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{attendanceStats.present}</p>
          <p className="mt-1 text-xs text-ink-muted48">Có mặt · {attendanceStats.absent} vắng · {attendanceStats.makeup} bù</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Portal phụ huynh</p>
          <p className="mt-2 font-display text-lg font-semibold tracking-tight">{primaryGuardian?.user?.email ?? "Chưa cấp"}</p>
          <p className="mt-1 text-xs text-ink-muted48">{primaryGuardian?.user ? (primaryGuardian.user.isActive ? "Đang hoạt động" : "Đã thu hồi") : "Cần cấp để xem journal / reminder"}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Sách / giáo trình</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{student.bookIssues.length}</p>
          <p className="mt-1 text-xs text-ink-muted48">{student.bookIssues[0] ? `Lần gần nhất ${formatDate(student.bookIssues[0].issueDate)}` : "Chưa phát sách"}</p>
        </div>
      </div>

      <StudentFinanceDesk
        studentId={student.id}
        studentName={student.fullName}
        studentCode={student.studentDisplayId ?? student.studentCode}
        outstanding={outstanding}
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
        recentPayments={student.payments.slice(0, 5).map((payment) => ({
          id: payment.id,
          paymentNo: payment.paymentNo,
          amount: payment.amount,
          paidDate: payment.paidDate.toISOString(),
          method: payment.method,
          notes: payment.notes,
          discountAmount: payment.creditBalances
            .filter((credit) => (credit.reason ?? "").startsWith("Chiết khấu tiền mặt"))
            .reduce((sum, credit) => sum + credit.amount, 0),
          discountReason:
            payment.creditBalances.find((credit) => (credit.reason ?? "").startsWith("Chiết khấu tiền mặt"))?.reason ?? null,
        }))}
        canManageFinance={canManageFinance}
        canManageInventory={canManageInventory}
      />

      <StudentSessionCredits
        credits={student.sessionCredits.map((c) => ({
          id: c.id,
          status: c.status,
          sourceSession: { sessionDate: c.sourceSession.sessionDate, class: c.sourceSession.class },
          consumedSession: c.consumedSession ? { sessionDate: c.consumedSession.sessionDate, class: c.consumedSession.class } : null,
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.9fr)]">
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">Tổng quan 360</h2>
                <p className="mt-1 text-sm text-ink-muted48">Một nơi để đối chất học viên, phụ huynh, lớp học, học phí và lịch sử vận hành.</p>
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
                  {student.status === "LEFT" ? (
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-ink-muted48">Ngày nghỉ học</dt>
                      <dd className="font-medium">
                        {canEditStudent ? (
                          <EditableDateField endpoint={`/api/students/${student.id}`} field="leaveDate" value={student.leaveDate} width="w-32" />
                        ) : (
                          formatDate(student.leaveDate)
                        )}
                      </dd>
                    </div>
                  ) : null}
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
                {courseProgress.remaining !== null && courseProgress.remaining > 0 && courseProgress.classEnded ? (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    Lớp đã qua ngày dự kiến kết thúc nhưng học viên mới học {courseProgress.consumed}/{courseProgress.planned} buổi — còn dư{" "}
                    {courseProgress.remaining} buổi cần bảo lưu hoặc học bù ở lớp khác.
                  </p>
                ) : courseProgress.remaining !== null && courseProgress.remaining <= 0 ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700">Đã học đủ số buổi của khóa.</p>
                ) : (
                  <p className="mt-2 text-xs text-ink-muted48">Còn {courseProgress.remaining} buổi trong khóa.</p>
                )}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight">Timeline học phí</h2>
                  <p className="mt-1 text-sm text-ink-muted48">Nhìn charge, phân bổ thu tiền và invoice theo từng kỳ.</p>
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
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                        <div>
                          <p className="text-xs text-ink-muted48">Học phí kỳ này</p>
                          <p className="mt-1 font-medium">{formatVnd(charge.tuitionAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-muted48">Giáo trình</p>
                          <p className="mt-1 font-medium">{formatVnd(charge.materialsAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-muted48">Tồn đầu kỳ</p>
                          <p className="mt-1 font-medium">{formatVnd(charge.openingBalance)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-muted48">Tổng phải thu</p>
                          <p className="mt-1 font-medium">{formatVnd(charge.totalAmount)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {student.charges.length === 0 ? <p className="text-sm text-ink-muted48">Chưa có kỳ học phí nào được ghi nhận.</p> : null}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight">Timeline thanh toán</h2>
                  <p className="mt-1 text-sm text-ink-muted48">Xem mỗi phiếu thu đang phân bổ vào charge nào và đã post quỹ chưa.</p>
                </div>
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
                      <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-ink-muted48">Số tiền thu</span>
                          <span className="font-medium">{formatVnd(payment.amount)}</span>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-ink-muted48">Phân bổ</span>
                          <span className="text-right font-medium">
                            {payment.allocations.length
                              ? payment.allocations.map((alloc) => `${alloc.charge.billingPeriod.periodName}: ${formatVnd(alloc.amount)}`).join(" · ")
                              : "Chưa phân bổ"}
                          </span>
                        </div>
                      </div>
                      {canManageFinance ? (
                        <div className="mt-3 flex justify-end">
                          <RefundButton paymentId={payment.id} refundable={payment.amount - refunded} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {student.payments.length === 0 ? <p className="text-sm text-ink-muted48">Chưa có khoản thanh toán nào.</p> : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight">Buổi học gần nhất</h2>
                  <p className="mt-1 text-sm text-ink-muted48">Đối chất attendance, người dạy thực tế và trạng thái journal.</p>
                </div>
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
                    <div className="mt-3 flex flex-wrap gap-3 text-xs">
                      <Link href={`/classes/${attendance.session.classId}/sessions/${attendance.sessionId}`} className="text-primary">
                        Mở buổi học →
                      </Link>
                      <Link href={`/journal/${attendance.sessionId}`} className="text-primary">
                        Mở journal →
                      </Link>
                    </div>
                  </div>
                ))}
                {recentSessions.length === 0 ? <p className="text-sm text-ink-muted48">Chưa có buổi học nào để đối chất.</p> : null}
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight">Journal & giáo trình</h2>
                  <p className="mt-1 text-sm text-ink-muted48">Những gì phụ huynh và quản lý cần xem lại nhanh nhất.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {student.journalEntries.slice(0, 3).map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-hairline p-4">
                    <p className="font-medium text-ink">{entry.journal.session.class.className} · {formatDate(entry.journal.session.sessionDate)}</p>
                    <p className="mt-1 text-sm text-ink-muted48">{entry.comment ?? "Chưa có nhận xét riêng."}</p>
                    <p className="mt-2 text-xs text-ink-muted48">
                      Homework: {entry.homeworkStatus ?? "—"} · {entry.scores.length ? entry.scores.map((score) => `${score.label} ${score.score ?? "—"}/${score.maxScore}`).join(" · ") : "Chưa có cột điểm"}
                    </p>
                  </div>
                ))}
                {student.bookIssues.slice(0, 3).map((issue) => (
                  <div key={issue.id} className="rounded-2xl border border-hairline p-4">
                    <p className="font-medium text-ink">{issue.book.name} · {formatDate(issue.issueDate)}</p>
                    <p className="mt-1 text-xs text-ink-muted48">
                      {issue.class?.className ?? "Không gắn lớp"} · SL {issue.quantity} · {formatVnd(issue.amount)} · {issue.paymentStatus}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted48">{issue.charge?.billingPeriod ? `Gắn charge ${issue.charge.billingPeriod.periodName}` : "Chưa gắn kỳ thu tiền"}</p>
                  </div>
                ))}
                {student.journalEntries.length === 0 && student.bookIssues.length === 0 ? (
                  <p className="text-sm text-ink-muted48">Chưa có journal hoặc phát sách gần đây.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="font-display text-base font-bold tracking-tight text-ink">Panel đối chất</h2>
            <div className="mt-3 space-y-3 text-sm">
              <div className="rounded-2xl border border-hairline p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Cảnh báo vận hành</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {!currentEnrollment ? <li>• Chưa có enrollment hiện tại — luồng nhập học chưa khép kín.</li> : null}
                  {!primaryGuardian ? <li>• Chưa gắn phụ huynh chính — hóa đơn/reminder sẽ thiếu đầu mối.</li> : null}
                  {primaryGuardian && !primaryGuardian.user ? <li>• Phụ huynh chưa có portal — chưa xem được journal/công nợ.</li> : null}
                  {outstanding > 0 ? <li>• Còn nợ {formatVnd(outstanding)} — cần nhắc thu theo phụ huynh.</li> : null}
                  {recentSessions.some((item) => item.attendance.session.journal == null) ? <li>• Có buổi học chưa có journal — phụ huynh sẽ thiếu nhật ký.</li> : null}
                  {student.bookIssues.some((issue) => issue.paymentStatus !== "PAID") ? <li>• Có giáo trình chưa thu đủ — cần đối chiếu với charge/payment.</li> : null}
                  {!student.notes && !student.evaluation ? <li>• Hồ sơ nội bộ còn trống đánh giá/ghi chú vận hành.</li> : null}
                </ul>
              </div>

              <div className="rounded-2xl border border-hairline p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Phụ huynh & portal</p>
                <div className="mt-2 space-y-2">
                  {student.guardians.map((link) => (
                    <div key={link.id} className="rounded-xl bg-canvas-parchment/50 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <Link href={`/guardians/${link.guardian.id}`} className="font-medium text-primary">
                          {link.guardian.fullName}
                        </Link>
                        <span className={`badge ${link.isPrimary ? "bg-primary/10 text-primary" : "bg-ink/5 text-ink-muted48"}`}>{link.isPrimary ? "Chính" : link.relation ?? "Phụ"}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted48">
                        {link.guardian.phone ?? "Chưa có SĐT"} · {link.guardian.user?.email ?? "Chưa cấp portal"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-hairline p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Lịch sử trạng thái</p>
                <div className="mt-2 space-y-2">
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

          {canEditStudent ? (
            <>
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
              <ScholarshipAdjustmentForm
                studentId={student.id}
                scholarships={student.scholarships}
                adjustments={student.adjustments}
                enrollments={student.enrollments.map((e) => ({ id: e.id, className: e.class.className, status: e.status }))}
              />
              <SchoolExamScoreForm studentId={student.id} scores={student.schoolExamScores} />
              {canManageGuardianAccount && primaryGuardian ? (
                <GuardianAccountPanel
                  guardianId={primaryGuardian.id}
                  account={primaryGuardian.user ? { email: primaryGuardian.user.email, isActive: primaryGuardian.user.isActive } : null}
                  defaultEmail=""
                />
              ) : null}
            </>
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
                {student.status === "LEFT" ? (
                  <div>
                    <dt className="text-ink-muted48">Ngày nghỉ / Lý do</dt>
                    <dd className="font-medium">
                      {formatDate(student.leaveDate)}
                      {student.leaveReason ? ` · ${student.leaveReason}` : ""}
                    </dd>
                  </div>
                ) : null}
                {student.evaluation ? (
                  <div>
                    <dt className="text-ink-muted48">Đánh giá</dt>
                    <dd className="font-medium">{student.evaluation}</dd>
                  </div>
                ) : null}
                {student.notes ? (
                  <div>
                    <dt className="text-ink-muted48">Ghi chú nội bộ</dt>
                    <dd className="font-medium">{student.notes}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
