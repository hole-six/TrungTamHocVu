import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("vi-VN");
}

function currentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

export default async function TimesheetsPage() {
  const user = await getCurrentUser();
  const { start, end } = currentMonthRange();

  const employees = await prisma.employee.findMany({
    where: user?.branchId ? { branchId: user.branchId } : {},
    include: { timesheetEntries: { where: { workDate: { gte: start, lte: end } }, orderBy: { workDate: "desc" } } },
    orderBy: { fullName: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chấm công</h1>
        <p className="mt-1 text-sm text-ink-muted48">
          Tháng {start.getUTCMonth() + 1}/{start.getUTCFullYear()} · Chấm công theo ngày được thêm ở trang chi tiết từng nhân viên.
        </p>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="px-4 py-3 font-medium">Nhân viên</th>
              <th className="px-4 py-3 font-medium">Số ngày đã chấm</th>
              <th className="px-4 py-3 font-medium">Tổng công</th>
              <th className="px-4 py-3 font-medium">Lần chấm gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const totalDays = e.timesheetEntries.reduce((s, t) => s + (t.days ?? 0), 0);
              return (
                <tr key={e.id} className="border-b border-hairline last:border-0 hover:bg-canvas-parchment/40">
                  <td className="px-4 py-3">
                    <Link href={`/payroll/employees/${e.id}`} className="font-medium text-primary">
                      {e.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted80">{e.timesheetEntries.length}</td>
                  <td className="px-4 py-3 font-medium">{totalDays}</td>
                  <td className="px-4 py-3 text-ink-muted80">
                    {e.timesheetEntries[0] ? formatDate(e.timesheetEntries[0].workDate) : "—"}
                  </td>
                </tr>
              );
            })}
            {employees.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-ink-muted48">
                  Chưa có nhân viên nào — thêm ở trang{" "}
                  <Link href="/payroll" className="text-primary">
                    Nhân sự & Lương
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
