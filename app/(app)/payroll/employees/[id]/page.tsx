import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_ROLE_LABEL } from "@/lib/server/payroll-rules";
import TimesheetQuickAddForm from "@/components/payroll/TimesheetQuickAddForm";

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}
function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("vi-VN");
}

export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      sessionAssignments: { include: { session: { include: { class: true } } }, orderBy: { id: "desc" }, take: 20 },
      timesheetEntries: { orderBy: { workDate: "desc" }, take: 30 },
    },
  });
  if (!employee) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/payroll" className="text-sm text-primary">
          ← Quay lại Nhân sự & Lương
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{employee.fullName}</h1>
        <p className="mt-1 text-sm text-ink-muted48">
          Mã NV: {employee.employeeCode} · Tên ngắn: {employee.shortName} · {employee.position ?? "—"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card overflow-x-auto">
            <h2 className="font-display text-lg font-semibold tracking-tight">Buổi dạy/trợ giảng gần đây</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                <tr>
                  <th className="py-2 font-medium">Ngày</th>
                  <th className="py-2 font-medium">Lớp</th>
                  <th className="py-2 font-medium">Vai trò</th>
                  <th className="py-2 font-medium">Giờ</th>
                  <th className="py-2 font-medium">Tiền</th>
                </tr>
              </thead>
              <tbody>
                {employee.sessionAssignments.map((a) => (
                  <tr key={a.id} className="border-b border-hairline last:border-0">
                    <td className="py-2">{formatDate(a.session.sessionDate)}</td>
                    <td className="py-2 text-ink-muted80">{a.session.class.className}</td>
                    <td className="py-2 text-ink-muted80">{SESSION_ROLE_LABEL[a.role] ?? a.role}</td>
                    <td className="py-2 text-ink-muted80">{a.hours}</td>
                    <td className="py-2 font-medium">{formatVnd(a.amount ?? 0)}</td>
                  </tr>
                ))}
                {employee.sessionAssignments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-ink-muted48">
                      Chưa được phân công buổi dạy nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card overflow-x-auto">
            <h2 className="font-display text-lg font-semibold tracking-tight">Chấm công gần đây</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                <tr>
                  <th className="py-2 font-medium">Ngày</th>
                  <th className="py-2 font-medium">Giờ</th>
                  <th className="py-2 font-medium">Công</th>
                </tr>
              </thead>
              <tbody>
                {employee.timesheetEntries.map((t) => (
                  <tr key={t.id} className="border-b border-hairline last:border-0">
                    <td className="py-2">{formatDate(t.workDate)}</td>
                    <td className="py-2 text-ink-muted80">{t.hours}</td>
                    <td className="py-2 font-medium">{t.days}</td>
                  </tr>
                ))}
                {employee.timesheetEntries.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-ink-muted48">
                      Chưa có chấm công nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <TimesheetQuickAddForm employeeId={employee.id} />
      </div>
    </div>
  );
}
