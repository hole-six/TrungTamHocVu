import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_ROLE_LABEL, computeContractStatus } from "@/lib/server/payroll-rules";
import TimesheetQuickAddForm from "@/components/payroll/TimesheetQuickAddForm";
import EmployeeProfileEditor from "@/components/payroll/EmployeeProfileEditor";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate, canView, canUpdate } from "@/lib/server/role-matrix";

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}
function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("vi-VN");
}

export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser();
  const role = currentUser ? await getUserRole(currentUser.id) : null;
  const isSelf = currentUser?.employeeId === params.id;
  if (!isSelf && !canView("hr", role)) notFound();

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      sessionAssignments: { include: { session: { include: { class: true } } }, orderBy: { id: "desc" } },
      timesheetEntries: { orderBy: { workDate: "desc" } },
      contracts: { orderBy: { signDate: "desc" }, take: 1 },
    },
  });
  if (!employee) notFound();

  const contractStatus = computeContractStatus(employee.resignDate, employee.contracts[0]?.expiryDate ?? null);

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
        {contractStatus === "Đã hết hạn HĐ" && <span className="badge-red mt-2 inline-flex">Đã hết hạn HĐ</span>}
        {contractStatus === "Sắp hết hạn HĐ" && <span className="badge-amber mt-2 inline-flex">Sắp hết hạn HĐ</span>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card overflow-x-auto">
            <h2 className="font-display text-lg font-semibold tracking-tight">Tất cả buổi dạy/trợ giảng ({employee.sessionAssignments.length})</h2>
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
                {employee.sessionAssignments.map((assignment) => (
                  <tr key={assignment.id} className="border-b border-hairline last:border-0">
                    <td className="py-2">{formatDate(assignment.session.sessionDate)}</td>
                    <td className="py-2 text-ink-muted80">{assignment.session.class.className}</td>
                    <td className="py-2 text-ink-muted80">{SESSION_ROLE_LABEL[assignment.role] ?? assignment.role}</td>
                    <td className="py-2 text-ink-muted80">{assignment.hours}</td>
                    <td className="py-2 font-medium">{formatVnd(assignment.amount ?? 0)}</td>
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
            <h2 className="font-display text-lg font-semibold tracking-tight">Tất cả chấm công ngày ({employee.timesheetEntries.length})</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                <tr>
                  <th className="py-2 font-medium">Ngày</th>
                  <th className="py-2 font-medium">Giờ</th>
                  <th className="py-2 font-medium">Công</th>
                </tr>
              </thead>
              <tbody>
                {employee.timesheetEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-hairline last:border-0">
                    <td className="py-2">{formatDate(entry.workDate)}</td>
                    <td className="py-2 text-ink-muted80">{entry.hours}</td>
                    <td className="py-2 font-medium">{entry.days}</td>
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

        <div className="space-y-6">
          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Công việc & Lương</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between border-b border-hairline/60 py-1">
                <dt className="text-ink-muted48">Trạng thái làm việc</dt>
                <dd>
                  <span className={`badge ${employee.workStatus === "ACTIVE" ? "bg-primary/10 text-primary" : "bg-ink/5 text-ink-muted48"}`}>
                    {employee.workStatus === "ACTIVE" ? "Đang làm" : "Đã nghỉ"}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between border-b border-hairline/60 py-1">
                <dt className="text-ink-muted48">Ngày ký HĐ</dt>
                <dd className="font-medium">{employee.contracts[0]?.signDate ? formatDate(employee.contracts[0].signDate) : "—"}</dd>
              </div>
              <div className="flex justify-between border-b border-hairline/60 py-1">
                <dt className="text-ink-muted48">Hạn HĐ</dt>
                <dd className="font-medium">{employee.contracts[0]?.expiryDate ? formatDate(employee.contracts[0].expiryDate) : "—"}</dd>
              </div>
              <div className="flex justify-between border-b border-hairline/60 py-1">
                <dt className="text-ink-muted48">Hình thức lương</dt>
                <dd className="font-medium">{employee.payMode === "SESSION" ? "Theo ca" : "Theo giờ"}</dd>
              </div>
              <div className="flex justify-between border-b border-hairline/60 py-1">
                <dt className="text-ink-muted48">Lương/giờ dạy</dt>
                <dd className="font-medium">{employee.teachingHourlyRate != null ? formatVnd(employee.teachingHourlyRate) : "—"}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-ink-muted48">Lương/giờ trợ giảng</dt>
                <dd className="font-medium">{employee.assistantHourlyRate != null ? formatVnd(employee.assistantHourlyRate) : "—"}</dd>
              </div>
            </dl>
          </div>

          <EmployeeProfileEditor
            employee={{
              id: employee.id,
              dob: employee.dob ? employee.dob.toISOString() : null,
              phone: employee.phone,
              email: employee.email,
              hometown: employee.hometown,
              permanentAddress: employee.permanentAddress,
              idNumber: employee.idNumber,
              idIssueDate: employee.idIssueDate ? employee.idIssueDate.toISOString() : null,
              idIssuePlace: employee.idIssuePlace,
              resignDate: employee.resignDate ? employee.resignDate.toISOString() : null,
            }}
            canEdit={canUpdate("hr", role)}
          />

          {canCreate("timesheet", role) && (isSelf || canUpdate("hr", role)) && <TimesheetQuickAddForm employeeId={employee.id} />}
        </div>
      </div>
    </div>
  );
}
