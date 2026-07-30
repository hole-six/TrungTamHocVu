import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StudentEditForm from "@/components/students/StudentEditForm";
import QuickPaymentButton from "@/components/tuition/QuickPaymentButton";
import ScholarshipAdjustmentForm from "@/components/students/ScholarshipAdjustmentForm";
import RefundButton from "@/components/students/RefundButton";
import SchoolExamScoreForm from "@/components/students/SchoolExamScoreForm";
import { computeOutstandingBalance } from "@/lib/server/balance";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate, canView } from "@/lib/server/role-matrix";

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function formatDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("vi-VN") : "—";
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
      guardians: { include: { guardian: { include: { user: true } } } },
      enrollments: { include: { class: true }, orderBy: { enrollDate: "desc" } },
      charges: { include: { billingPeriod: true }, orderBy: { createdAt: "desc" } },
      payments: { orderBy: { paidDate: "desc" }, include: { refunds: true } },
      scholarships: { orderBy: { effectiveFrom: "desc" } },
      adjustments: { orderBy: { effectiveFrom: "desc" } },
      schoolExamScores: { orderBy: { schoolYear: "desc" } },
    },
  });
  if (!student) notFound();

  const currentUser = await getCurrentUser();
  const role = currentUser ? await getUserRole(currentUser.id) : null;
  const canEditStudent = canUpdate("students", role);
  const canManageFinance = canUpdate("tuition", role);
  const canSeeFinance = canView("tuition", role);
  const showIntakeBanner = searchParams?.from === "intake";
  const autoOpenTuition = showIntakeBanner && searchParams?.focus === "tuition";

  const outstanding = await computeOutstandingBalance(student.id);
  const currentEnrollment = student.enrollments.find((e) => e.status === "ACTIVE") ?? student.enrollments[0];
  const primaryGuardian = student.guardians.find((item) => item.isPrimary)?.guardian ?? student.guardians[0]?.guardian ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/students" className="text-sm text-primary">
          ← Quay lại danh sách học viên
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{student.fullName}</h1>
            <p className="mt-1 text-sm text-ink-muted48">
              Mã HV: <strong>{student.studentDisplayId ?? student.studentCode}</strong>
              {student.studentDisplayId ? <span> · Mã số: {student.studentCode}</span> : null}
              {" · "}Lớp: {currentEnrollment?.class?.className ?? "Chưa ghi danh"}
              {student.lead?.leadCode ? (
                <span>
                  {" · "}Lead gốc: <strong>{student.lead.leadCode}</strong>
                </span>
              ) : null}
            </p>
          </div>
          <span className={`badge ${student.status === "ACTIVE" ? "bg-primary/10 text-primary" : "bg-ink/5 text-ink-muted48"}`}>
            {student.status === "ACTIVE" ? "Đang học" : "Đã nghỉ"}
          </span>
        </div>
      </div>

      {showIntakeBanner ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-800">Đã hoàn tất luồng nhập học</p>
              <p className="mt-1 text-sm text-emerald-700">
                Học viên đã được tạo
                {currentEnrollment?.class?.className ? ` và ghi danh vào lớp ${currentEnrollment.class.className}` : ""}.
                {canSeeFinance ? " Có thể xử lý học phí ngay tại đây." : " Có thể bàn giao tiếp cho bộ phận học phí."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {canManageFinance ? (
                <QuickPaymentButton studentId={student.id} suggestedAmount={outstanding} autoOpen={autoOpenTuition} />
              ) : null}
              {canSeeFinance ? (
                <Link href="/tuition" className="text-sm font-medium text-primary">
                  Mở học phí →
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {canSeeFinance && (
          <div className="card">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Công nợ học phí</p>
              {outstanding > 0 && canManageFinance ? <QuickPaymentButton studentId={student.id} suggestedAmount={outstanding} /> : null}
            </div>
            <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatVnd(outstanding)}</p>
          </div>
        )}
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Ngày nhập học</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatDate(student.enrollDate)}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Số điện thoại</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{student.phone ?? "—"}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Phụ huynh nhận hóa đơn</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{primaryGuardian?.fullName ?? "Chưa liên kết"}</p>
          <p className="mt-1 text-xs text-ink-muted48">
            {primaryGuardian?.user ? `Portal: ${primaryGuardian.user.email}` : "Chưa cấp tài khoản portal"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {!canSeeFinance && (
            <div className="card">
              <p className="text-sm text-ink-muted48">Vai trò của bạn không có quyền xem thông tin học phí / thanh toán của học viên.</p>
            </div>
          )}

          {canSeeFinance ? (
            <>
              <div className="card overflow-x-auto">
                <h2 className="font-display text-lg font-semibold tracking-tight">Học phí theo kỳ</h2>
                <table className="mt-4 w-full text-left text-sm">
                  <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                    <tr>
                      <th className="py-2 font-medium">Kỳ</th>
                      <th className="py-2 font-medium">Số buổi</th>
                      <th className="py-2 font-medium">Nghỉ</th>
                      <th className="py-2 font-medium">Học phí</th>
                      <th className="py-2 font-medium">Giáo trình</th>
                      <th className="py-2 font-medium">Tổng</th>
                      <th className="py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.charges.map((charge) => (
                      <tr key={charge.id} className="border-b border-hairline last:border-0">
                        <td className="py-2">{charge.billingPeriod.periodName}</td>
                        <td className="py-2">{charge.sessionCount}</td>
                        <td className="py-2">{charge.absentCount}</td>
                        <td className="py-2">{formatVnd(charge.tuitionAmount)}</td>
                        <td className="py-2">{formatVnd(charge.materialsAmount)}</td>
                        <td className="py-2 font-medium">{formatVnd(charge.totalAmount)}</td>
                        <td className="py-2">
                          <Link href={`/invoices/${charge.id}`} target="_blank" className="text-xs text-primary">
                            Hóa đơn
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {student.charges.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-ink-muted48">
                          Chưa có kỳ học phí nào được ghi nhận.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="card overflow-x-auto">
                <h2 className="font-display text-lg font-semibold tracking-tight">Lịch sử thanh toán</h2>
                <table className="mt-4 w-full text-left text-sm">
                  <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                    <tr>
                      <th className="py-2 font-medium">Ngày</th>
                      <th className="py-2 font-medium">Số tiền</th>
                      <th className="py-2 font-medium">Hình thức</th>
                      <th className="py-2 font-medium">Trạng thái</th>
                      <th className="py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.payments.map((payment) => {
                      const refunded = payment.refunds.reduce((sum, refund) => sum + refund.amount, 0);
                      return (
                        <tr key={payment.id} className="border-b border-hairline last:border-0">
                          <td className="py-2">{formatDate(payment.paidDate)}</td>
                          <td className="py-2 font-medium">{formatVnd(payment.amount)}</td>
                          <td className="py-2">{payment.method ?? "—"}</td>
                          <td className="py-2 text-ink-muted48">
                            {payment.status === "REFUNDED"
                              ? "Đã hoàn"
                              : payment.status === "PARTIALLY_REFUNDED"
                                ? `Hoàn ${formatVnd(refunded)}`
                                : "—"}
                          </td>
                          <td className="py-2">
                            {canManageFinance ? <RefundButton paymentId={payment.id} refundable={payment.amount - refunded} /> : null}
                          </td>
                        </tr>
                      );
                    })}
                    {student.payments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-ink-muted48">
                          Chưa có khoản thanh toán nào.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="card space-y-3">
            <h2 className="font-display text-base font-bold tracking-tight text-ink">Liên kết hồ sơ</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-ink-muted48">Lead gốc</dt>
                <dd className="font-medium">
                  {student.lead ? (
                    <Link href={`/leads/${student.lead.id}`} className="text-primary">
                      {student.lead.leadCode} — {student.lead.fullName}
                    </Link>
                  ) : (
                    "Không gắn lead"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted48">Phụ huynh chính / thanh toán</dt>
                <dd className="font-medium">
                  {primaryGuardian ? (
                    <Link href={`/guardians/${primaryGuardian.id}`} className="text-primary">
                      {primaryGuardian.fullName}
                    </Link>
                  ) : (
                    "Chưa liên kết phụ huynh"
                  )}
                </dd>
                <p className="mt-1 text-xs text-ink-muted48">
                  {primaryGuardian?.phone ?? "Chưa có số điện thoại"}
                  {primaryGuardian?.user ? ` · Portal ${primaryGuardian.user.isActive ? "đang hoạt động" : "đã thu hồi"}` : " · Chưa cấp portal"}
                </p>
              </div>
              <div>
                <dt className="text-ink-muted48">Lớp/ghi danh hiện tại</dt>
                <dd className="font-medium">{currentEnrollment?.class?.className ?? "Chưa ghi danh"}</dd>
                <p className="mt-1 text-xs text-ink-muted48">{currentEnrollment ? `Trạng thái enrollment: ${currentEnrollment.status}` : "Cần xếp lớp để tiếp tục luồng."}</p>
              </div>
              <div>
                <dt className="text-ink-muted48">Nguyên tắc vận hành</dt>
                <dd className="font-medium">Học phí gắn theo học viên, nhưng người nhận hóa đơn và reminder là phụ huynh chính.</dd>
              </div>
            </dl>
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
              />
              <SchoolExamScoreForm studentId={student.id} scores={student.schoolExamScores} />
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
                {student.schoolExamScores[0] ? (
                  <div>
                    <dt className="text-ink-muted48">Điểm học lực ({student.schoolExamScores[0].schoolYear})</dt>
                    <dd className="font-medium">
                      GHKI {student.schoolExamScores[0].midTerm1 ?? "—"} · CHKI {student.schoolExamScores[0].finalTerm1 ?? "—"} · GHKII{" "}
                      {student.schoolExamScores[0].midTerm2 ?? "—"} · CHKII {student.schoolExamScores[0].finalTerm2 ?? "—"}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="text-xs text-ink-muted48">Vai trò của bạn chỉ có quyền xem hồ sơ này.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
