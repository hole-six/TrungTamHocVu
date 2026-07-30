import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { BILLING_PERIOD_STATUS_LABEL } from "@/lib/server/tuition-rules";
import NewPeriodForm from "@/components/tuition/NewPeriodForm";

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

export default async function TuitionPage() {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;

  const periods = await prisma.billingPeriod.findMany({
    where: user?.branchId ? { branchId: user.branchId } : {},
    orderBy: { periodName: "desc" },
    include: { charges: { include: { allocations: true } } },
  });

  const totalBilled = periods.reduce((s, p) => s + p.charges.reduce((cs, c) => cs + c.totalAmount, 0), 0);
  const totalPaid = periods.reduce(
    (s, p) => s + p.charges.reduce((cs, c) => cs + c.allocations.reduce((as, a) => as + a.amount, 0), 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Học phí</h1>
          <p className="page-subtitle">{periods.length} kỳ thu</p>
        </div>
        {canUpdate("tuition", role) && <NewPeriodForm />}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Tổng phải thu</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{formatVnd(totalBilled)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Đã thu</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-emerald-600">{formatVnd(totalPaid)}</p>
        </div>
        <div className="stat-card-accent">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Còn nợ</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">{formatVnd(totalBilled - totalPaid)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Kỳ</th>
              <th>Số khoản thu</th>
              <th>Tổng phải thu</th>
              <th>Đã thu</th>
              <th>Còn nợ</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => {
              const total = p.charges.reduce((s, c) => s + c.totalAmount, 0);
              const paid = p.charges.reduce((s, c) => s + c.allocations.reduce((sa, a) => sa + a.amount, 0), 0);
              const debt = total - paid;
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={`/tuition/${p.id}`} className="font-medium text-primary hover:underline">
                      {p.periodName}
                    </Link>
                  </td>
                  <td className="text-ink-muted80">{p.charges.length}</td>
                  <td className="text-ink-muted80">{formatVnd(total)}</td>
                  <td className="text-emerald-600 font-medium">{formatVnd(paid)}</td>
                  <td className={`font-medium ${debt > 0 ? "text-red-600" : "text-ink-muted80"}`}>{formatVnd(debt)}</td>
                  <td>
                    <span className="badge-gray">{BILLING_PERIOD_STATUS_LABEL[p.status] ?? p.status}</span>
                  </td>
                </tr>
              );
            })}
            {periods.length === 0 && (
              <tr className="table-empty">
                <td colSpan={6}>
                  <div className="empty-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted48/40">
                      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    <p className="empty-state-title">Chưa có kỳ thu nào</p>
                    <p className="empty-state-desc">Bấm &quot;+ Tạo kỳ thu&quot; để bắt đầu.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
