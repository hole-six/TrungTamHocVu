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
import { canUpdate } from "@/lib/server/role-matrix";

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}
function formatDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("vi-VN") : "—";
}

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const student = await prisma.student.findUnique({
    where: { id: params.id },
    include: {
      guardians: { include: { guardian: true } },
      enrollments: { include: { class: true }, orderBy: { enrollDate: "desc" } },
      charges: { include: { billingPeriod: true }, orderBy: { createdAt: "desc" }, take: 12 },
      payments: { orderBy: { paidDate: "desc" }, take: 12, include: { refunds: true } },
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

  const outstanding = await computeOutstandingBalance(student.id);
  const currentEnrollment = student.enrollments.find((e) => e.status === "ACTIVE") ?? student.enrollments[0];

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
              Mã HV: <strong>{student.studentCode}</strong> · Lớp: {currentEnrollment?.class?.className ?? "Chưa ghi danh"}
            </p>
          </div>
          <span
            className={`badge ${student.status === "ACTIVE" ? "bg-primary/10 text-primary" : "bg-ink/5 text-ink-muted48"}`}
          >
            {student.status === "ACTIVE" ? "Đang học" : "Đã nghỉ"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Công nợ học phí</p>
            {outstanding > 0 && canManageFinance && <QuickPaymentButton studentId={student.id} suggestedAmount={outstanding} />}
          </div>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatVnd(outstanding)}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Ngày nhập học</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatDate(student.enrollDate)}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Số điện thoại</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{student.phone ?? "—"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
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
                {student.charges.map((c) => (
                  <tr key={c.id} className="border-b border-hairline last:border-0">
                    <td className="py-2">{c.billingPeriod.periodName}</td>
                    <td className="py-2">{c.sessionCount}</td>
                    <td className="py-2">{c.absentCount}</td>
                    <td className="py-2">{formatVnd(c.tuitionAmount)}</td>
                    <td className="py-2">{formatVnd(c.materialsAmount)}</td>
                    <td className="py-2 font-medium">{formatVnd(c.totalAmount)}</td>
                    <td className="py-2">
                      <Link href={`/invoices/${c.id}`} target="_blank" className="text-xs text-primary">
                        Hóa đơn
                      </Link>
                    </td>
                  </tr>
                ))}
                {student.charges.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-ink-muted48">
                      Chưa có kỳ học phí nào được ghi nhận.
                    </td>
                  </tr>
                )}
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
                {student.payments.map((p) => {
                  const refunded = p.refunds.reduce((s, r) => s + r.amount, 0);
                  return (
                    <tr key={p.id} className="border-b border-hairline last:border-0">
                      <td className="py-2">{formatDate(p.paidDate)}</td>
                      <td className="py-2 font-medium">{formatVnd(p.amount)}</td>
                      <td className="py-2">{p.method ?? "—"}</td>
                      <td className="py-2 text-ink-muted48">
                        {p.status === "REFUNDED" ? "Đã hoàn" : p.status === "PARTIALLY_REFUNDED" ? `Hoàn ${formatVnd(refunded)}` : "—"}
                      </td>
                      <td className="py-2">
                        {canManageFinance && <RefundButton paymentId={p.id} refundable={p.amount - refunded} />}
                      </td>
                    </tr>
                  );
                })}
                {student.payments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-ink-muted48">
                      Chưa có khoản thanh toán nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          {canEditStudent ? (
            <>
              <StudentEditForm
                studentId={student.id}
                initial={{
                  status: student.status,
                  phone: student.phone ?? "",
                  address: student.address ?? "",
                  leaveReason: student.leaveReason ?? "",
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
                  <dt className="text-ink-muted48">Địa chỉ</dt>
                  <dd className="font-medium">{student.address ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted48">Người giới thiệu</dt>
                  <dd className="font-medium">{student.referredBy ?? "—"}</dd>
                </div>
                {student.schoolExamScores[0] && (
                  <div>
                    <dt className="text-ink-muted48">Điểm học lực ({student.schoolExamScores[0].schoolYear})</dt>
                    <dd className="font-medium">
                      GHKI {student.schoolExamScores[0].midTerm1 ?? "—"} · CHKI {student.schoolExamScores[0].finalTerm1 ?? "—"} · GHKII{" "}
                      {student.schoolExamScores[0].midTerm2 ?? "—"} · CHKII {student.schoolExamScores[0].finalTerm2 ?? "—"}
                    </dd>
                  </div>
                )}
              </dl>
              <p className="text-xs text-ink-muted48">Vai trò của bạn chỉ có quyền xem hồ sơ này.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
