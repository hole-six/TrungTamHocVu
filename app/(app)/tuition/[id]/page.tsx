import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BILLING_PERIOD_STATUS_LABEL, chargePaymentStatus, PAYMENT_STATUS_LABEL, canEditCharges } from "@/lib/server/tuition-rules";
import BillingPeriodActions from "@/components/tuition/BillingPeriodActions";
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
        include: { student: true, class: true, allocations: true },
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
          <span className="badge bg-ink/5 text-ink-muted80">{BILLING_PERIOD_STATUS_LABEL[period.status] ?? period.status}</span>
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

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="px-4 py-3 font-medium">Học viên</th>
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
              return (
                <tr key={c.id} className="border-b border-hairline last:border-0 hover:bg-canvas-parchment/40">
                  <td className="px-4 py-3">
                    <Link href={`/students/${c.studentId}`} className="font-medium text-primary">
                      {c.student.fullName}
                    </Link>
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
                      <Link href={`/invoices/${c.id}`} target="_blank" className="text-xs text-ink-muted48">
                        Hóa đơn
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {period.charges.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-ink-muted48">
                  Chưa có khoản thu nào — dùng nút &quot;Sinh học phí&quot; phía trên.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
