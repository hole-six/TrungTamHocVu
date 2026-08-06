import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BILLING_PERIOD_STATUS_LABEL, chargePaymentStatus, PAYMENT_STATUS_LABEL, canEditCharges } from "@/lib/server/tuition-rules";
import BillingPeriodActions from "@/components/tuition/BillingPeriodActions";
import BillingPeriodExceptionQueue from "@/components/tuition/BillingPeriodExceptionQueue";
import QuickPaymentButton from "@/components/tuition/QuickPaymentButton";
import ChargeDeductionEditor from "@/components/tuition/ChargeDeductionEditor";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

export default async function BillingPeriodDetailPage({ params }: { params: { id: string } }) {
  const period = await prisma.billingPeriod.findUnique({
    where: { id: params.id },
    include: {
      charges: {
        include: {
          student: {
            include: {
              lead: true,
              guardians: {
                include: { guardian: { include: { user: true } } },
                orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
              },
            },
          },
          class: true,
          allocations: {
            where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!period) notFound();

  const currentUser = await getCurrentUser();
  const role = currentUser ? await getUserRole(currentUser.id) : null;
  const canManageTuition = canUpdate("tuition", role);
  const editable = canEditCharges(period.status) && canManageTuition;
  const totalReceivable = period.charges.reduce((s, c) => s + c.totalAmount, 0);
  const totalCollected = period.charges.reduce((s, c) => s + c.allocations.reduce((sa, a) => sa + a.amount, 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/tuition" className="text-sm text-primary">
          ← Quay lại Học phí
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Kỳ thu {period.periodName}</h1>
            <p className="mt-1 text-sm text-ink-muted48">{period.charges.length} khoản phải thu</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/invoices/batch/${period.id}`} target="_blank" className="btn-ghost">
              Xuất phiếu hàng loạt
            </Link>
            <span className="badge bg-ink/5 text-ink-muted80">{BILLING_PERIOD_STATUS_LABEL[period.status] ?? period.status}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Tổng phải thu</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatVnd(totalReceivable)}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Đã thu</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatVnd(totalCollected)}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Còn nợ</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatVnd(totalReceivable - totalCollected)}</p>
        </div>
      </div>

      {canManageTuition && <BillingPeriodActions periodId={period.id} status={period.status} />}
      {canManageTuition && <BillingPeriodExceptionQueue periodId={period.id} />}

      {/* Desktop: Full table */}
      <div className="hidden lg:block card overflow-x-auto p-0">{renderChargesTable()}</div>

      {/* Mobile & Tablet: Card view */}
      <div className="lg:hidden space-y-3">
        {period.charges.map((c) => {
          const paid = c.allocations.reduce((s, a) => s + a.amount, 0);
          const status = chargePaymentStatus(c.totalAmount, paid);
          const primaryGuardian = c.student.guardians.find((item) => item.isPrimary)?.guardian ?? c.student.guardians[0]?.guardian ?? null;
          
          return (
            <div key={c.id} className="card space-y-3">
              {/* Student info */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <Link href={`/students/${c.studentId}`} className="text-base font-semibold text-primary">
                    {c.student.fullName}
                  </Link>
                  <p className="text-xs text-ink-muted48 mt-1">
                    {c.student.studentCode}
                    {c.student.lead?.leadCode ? ` · Lead: ${c.student.lead.leadCode}` : ""}
                  </p>
                </div>
                <span
                  className={`badge shrink-0 ${status === "PAID" ? "bg-primary/10 text-primary" : status === "UNPAID" ? "bg-red-100 text-red-700" : "bg-ink/5 text-ink-muted80"}`}
                >
                  {PAYMENT_STATUS_LABEL[status]}
                </span>
              </div>

              {/* Guardian & Class */}
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-canvas-parchment p-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted48">Phụ huynh</p>
                  <p className="text-sm font-medium text-ink mt-1">{primaryGuardian?.fullName ?? "Chưa gắn"}</p>
                  <p className="text-xs text-ink-muted48">{primaryGuardian?.phone ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted48">Lớp</p>
                  <p className="text-sm font-medium text-ink mt-1">{c.class.className}</p>
                </div>
              </div>

              {/* Sessions & Pricing */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-ink-muted48">Buổi học</p>
                  <p className="font-semibold text-ink mt-0.5">{c.sessionCount}</p>
                </div>
                <div>
                  <p className="text-ink-muted48">Nghỉ</p>
                  <p className="font-semibold text-ink mt-0.5">{c.absentCount}</p>
                </div>
                <div>
                  <p className="text-ink-muted48">Trừ</p>
                  <p className="font-semibold text-ink mt-0.5">
                    {editable ? <ChargeDeductionEditor chargeId={c.id} deductedCount={c.deductedCount} /> : c.deductedCount}
                  </p>
                </div>
              </div>

              {/* Financial summary */}
              <div className="space-y-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-muted80">Đơn giá:</span>
                  <span className="font-semibold">{formatVnd(c.unitPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted80">Giáo trình:</span>
                  <span className="font-semibold">{formatVnd(c.materialsAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted80">Đầu kỳ:</span>
                  <span className="font-semibold">{formatVnd(c.openingBalance)}</span>
                </div>
                <div className="flex justify-between border-t border-amber-300 pt-2">
                  <span className="font-bold">Tổng:</span>
                  <span className="font-bold text-lg">{formatVnd(c.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-700">Đã thu:</span>
                  <span className="font-semibold text-emerald-700">{formatVnd(paid)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-hairline">
                {canManageTuition && <QuickPaymentButton studentId={c.studentId} suggestedAmount={c.totalAmount - paid} />}
                <a href={`/api/invoices/${c.id}/pdf`} className="btn-ghost-sm">
                  Tải phiếu
                </a>
              </div>
            </div>
          );
        })}
        
        {period.charges.length === 0 && (
          <div className="card py-12 text-center">
            <p className="text-ink-muted48">Chưa có khoản thu nào — dùng nút "Sinh học phí" phía trên.</p>
          </div>
        )}
      </div>
    </div>
  );
  
  function renderChargesTable() {
    if (!period) return null;
    return (
      <table className="w-full text-left text-sm">
        <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
          <tr>
            <th className="px-4 py-3 font-medium">Học viên</th>
            <th className="px-4 py-3 font-medium">Phụ huynh chính</th>
            <th className="px-4 py-3 font-medium">Lớp</th>
            <th className="px-4 py-3 font-medium">Số buổi</th>
            <th className="px-4 py-3 font-medium">Nghỉ</th>
            <th className="px-4 py-3 font-medium">Trừ</th>
            <th className="px-4 py-3 font-medium">Đơn giá</th>
            <th className="px-4 py-3 font-medium">Giáo trình</th>
            <th className="px-4 py-3 font-medium">Đầu kỳ</th>
            <th className="px-4 py-3 font-medium">Tổng</th>
            <th className="px-4 py-3 font-medium">Đã thu</th>
            <th className="px-4 py-3 font-medium">Trạng thái</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {period.charges.map((c) => {
            const paid = c.allocations.reduce((s, a) => s + a.amount, 0);
            const status = chargePaymentStatus(c.totalAmount, paid);
            const primaryGuardian = c.student.guardians.find((item) => item.isPrimary)?.guardian ?? c.student.guardians[0]?.guardian ?? null;
            return (
              <tr key={c.id} className="border-b border-hairline last:border-0 hover:bg-canvas-parchment/40">
                <td className="px-4 py-3">
                  <Link href={`/students/${c.studentId}`} className="font-medium text-primary">
                    {c.student.fullName} <span className="text-ink-muted48">({c.student.studentCode})</span>
                  </Link>
                  {c.student.lead?.leadCode ? <p className="mt-1 text-xs text-ink-muted48">Lead: {c.student.lead.leadCode}</p> : null}
                </td>
                <td className="px-4 py-3 text-ink-muted80">
                  <div>{primaryGuardian?.fullName ?? "Chưa gắn phụ huynh"}</div>
                  <div className="text-xs text-ink-muted48">
                    {primaryGuardian?.phone ?? "Chưa có SĐT"}
                    {primaryGuardian?.user?.email ? ` · ${primaryGuardian.user.email}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-muted80">{c.class.className}</td>
                <td className="px-4 py-3 text-ink-muted80">{c.sessionCount}</td>
                <td className="px-4 py-3 text-ink-muted80">{c.absentCount}</td>
                <td className="px-4 py-3 text-ink-muted80">
                  {editable ? <ChargeDeductionEditor chargeId={c.id} deductedCount={c.deductedCount} /> : c.deductedCount}
                </td>
                <td className="px-4 py-3 text-ink-muted80">{formatVnd(c.unitPrice)}</td>
                <td className="px-4 py-3 text-ink-muted80">{formatVnd(c.materialsAmount)}</td>
                <td className="px-4 py-3 text-ink-muted80">{formatVnd(c.openingBalance)}</td>
                <td className="px-4 py-3 font-medium">{formatVnd(c.totalAmount)}</td>
                <td className="px-4 py-3 text-ink-muted80">{formatVnd(paid)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`badge ${status === "PAID" ? "bg-primary/10 text-primary" : status === "UNPAID" ? "bg-red-100 text-red-700" : "bg-ink/5 text-ink-muted80"}`}
                  >
                    {PAYMENT_STATUS_LABEL[status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {canManageTuition && <QuickPaymentButton studentId={c.studentId} suggestedAmount={c.totalAmount - paid} />}
                    <a href={`/api/invoices/${c.id}/pdf`} className="text-xs text-ink-muted48 hover:text-primary">
                      Tải phiếu
                    </a>
                  </div>
                </td>
              </tr>
            );
          })}
          {period.charges.length === 0 && (
            <tr>
              <td colSpan={13} className="px-4 py-10 text-center text-ink-muted48">
                Chưa có khoản thu nào — dùng nút &quot;Sinh học phí&quot; phía trên.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  }
}
