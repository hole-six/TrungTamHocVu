import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { PAYROLL_RUN_STATUS_LABEL } from "@/lib/server/payroll-rules";
import NewEmployeeForm from "@/components/payroll/NewEmployeeForm";
import NewPayrollRunForm from "@/components/payroll/NewPayrollRunForm";

export default async function PayrollPage() {
  const user = await getCurrentUser();

  const [employees, runs] = await Promise.all([
    prisma.employee.findMany({ where: user?.branchId ? { branchId: user.branchId } : {}, orderBy: { fullName: "asc" } }),
    prisma.payrollRun.findMany({
      where: user?.branchId ? { branchId: user.branchId } : {},
      orderBy: { periodName: "desc" },
      include: { _count: { select: { lines: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nhân sự & Lương</h1>
          <p className="mt-1 text-sm text-ink-muted48">{employees.length} nhân viên</p>
        </div>
        <NewEmployeeForm />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="px-4 py-3 font-medium">Mã NV</th>
              <th className="px-4 py-3 font-medium">Họ tên</th>
              <th className="px-4 py-3 font-medium">Tên ngắn</th>
              <th className="px-4 py-3 font-medium">Vị trí</th>
              <th className="px-4 py-3 font-medium">Lương/giờ dạy</th>
              <th className="px-4 py-3 font-medium">Lương/giờ TG</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-b border-hairline last:border-0 hover:bg-canvas-parchment/40">
                <td className="px-4 py-3">
                  <Link href={`/payroll/employees/${e.id}`} className="text-primary">
                    {e.employeeCode}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium">{e.fullName}</td>
                <td className="px-4 py-3 text-ink-muted80">{e.shortName}</td>
                <td className="px-4 py-3 text-ink-muted80">{e.position ?? "—"}</td>
                <td className="px-4 py-3 text-ink-muted80">{e.teachingHourlyRate?.toLocaleString("vi-VN") ?? "—"}</td>
                <td className="px-4 py-3 text-ink-muted80">{e.assistantHourlyRate?.toLocaleString("vi-VN") ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${e.workStatus === "ACTIVE" ? "bg-primary/10 text-primary" : "bg-ink/5 text-ink-muted48"}`}>
                    {e.workStatus === "ACTIVE" ? "Đang làm" : "Đã nghỉ"}
                  </span>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-ink-muted48">
                  Chưa có nhân viên nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">Kỳ lương</h2>
        <NewPayrollRunForm />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="px-4 py-3 font-medium">Kỳ</th>
              <th className="px-4 py-3 font-medium">Số dòng lương</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-hairline last:border-0 hover:bg-canvas-parchment/40">
                <td className="px-4 py-3">
                  <Link href={`/payroll/${r.id}`} className="font-medium text-primary">
                    {r.periodName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-muted80">{r._count.lines}</td>
                <td className="px-4 py-3">
                  <span className="badge bg-ink/5 text-ink-muted80">{PAYROLL_RUN_STATUS_LABEL[r.status] ?? r.status}</span>
                </td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-ink-muted48">
                  Chưa có kỳ lương nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
