import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PAYROLL_RUN_STATUS_LABEL, canEditPayroll } from "@/lib/server/payroll-rules";
import PayrollRunActions from "@/components/payroll/PayrollRunActions";
import PayrollLineEditor from "@/components/payroll/PayrollLineEditor";

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

export default async function PayrollRunDetailPage({ params }: { params: { id: string } }) {
  const run = await prisma.payrollRun.findUnique({
    where: { id: params.id },
    include: { lines: { include: { employee: true }, orderBy: { employee: { fullName: "asc" } } } },
  });
  if (!run) notFound();

  const editable = canEditPayroll(run.status);
  const totalPayroll = run.lines.reduce((s, l) => s + l.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/payroll" className="text-sm text-primary">
          ← Quay lại Nhân sự & Lương
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Kỳ lương {run.periodName}</h1>
            <p className="mt-1 text-sm text-ink-muted48">{run.lines.length} nhân viên · Tổng {formatVnd(totalPayroll)}</p>
          </div>
          <span className="badge bg-ink/5 text-ink-muted80">{PAYROLL_RUN_STATUS_LABEL[run.status] ?? run.status}</span>
        </div>
      </div>

      <PayrollRunActions runId={run.id} status={run.status} />

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="px-4 py-3 font-medium">Nhân viên</th>
              <th className="px-4 py-3 font-medium">Giờ dạy</th>
              <th className="px-4 py-3 font-medium">Tiền dạy</th>
              <th className="px-4 py-3 font-medium">Giờ TG</th>
              <th className="px-4 py-3 font-medium">Tiền TG</th>
              <th className="px-4 py-3 font-medium">Công NV</th>
              <th className="px-4 py-3 font-medium">Thưởng</th>
              <th className="px-4 py-3 font-medium">Phạt</th>
              <th className="px-4 py-3 font-medium">Tổng</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {run.lines.map((l) => (
              <tr key={l.id} className="border-b border-hairline last:border-0 hover:bg-canvas-parchment/40">
                <td className="px-4 py-3">
                  <Link href={`/payroll/employees/${l.employeeId}`} className="font-medium text-primary">
                    {l.employee.fullName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-muted80">{l.teachingHours}</td>
                <td className="px-4 py-3 text-ink-muted80">{formatVnd(l.teachingAmount)}</td>
                <td className="px-4 py-3 text-ink-muted80">{l.assistantHours}</td>
                <td className="px-4 py-3 text-ink-muted80">{formatVnd(l.assistantAmount)}</td>
                <td className="px-4 py-3 text-ink-muted80">{l.staffDays}</td>
                <td className="px-4 py-3 text-ink-muted80">{formatVnd(l.bonus)}</td>
                <td className="px-4 py-3 text-ink-muted80">{formatVnd(l.penalty)}</td>
                <td className="px-4 py-3 font-medium">{formatVnd(l.totalAmount)}</td>
                <td className="px-4 py-3">{editable && <PayrollLineEditor lineId={l.id} bonus={l.bonus} penalty={l.penalty} />}</td>
              </tr>
            ))}
            {run.lines.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-ink-muted48">
                  Chưa có dòng lương nào — dùng nút &quot;Tính lương&quot; phía trên.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
