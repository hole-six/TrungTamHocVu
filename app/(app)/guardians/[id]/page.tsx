import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import GuardianEditForm from "@/components/guardians/GuardianEditForm";
import GuardianAccountPanel from "@/components/guardians/GuardianAccountPanel";
import DeleteGuardianButton from "@/components/guardians/DeleteGuardianButton";
import { LEAD_STATUS_LABEL } from "@/lib/server/lead-rules";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canDelete, canUpdate } from "@/lib/server/role-matrix";
import { computeOutstandingBalance } from "@/lib/server/balance";

function formatVnd(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

export default async function GuardianDetailPage({ params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser();
  const role = currentUser ? await getUserRole(currentUser.id) : null;
  const canManageAccount = canUpdate("students", role);
  const canDeleteGuardian = canDelete("students", role);

  const guardian = await prisma.guardian.findUnique({
    where: { id: params.id },
    include: {
      leads: { orderBy: { createdAt: "desc" } },
      students: {
        include: {
          student: {
            include: {
              lead: true,
              enrollments: { include: { class: true }, orderBy: { enrollDate: "desc" } },
            },
          },
        },
      },
      user: true,
    },
  });
  if (!guardian) notFound();

  const studentSummaries = await Promise.all(
    guardian.students.map(async (sg) => {
      const activeEnrollment = sg.student.enrollments.find((e) => e.status === "ACTIVE") ?? sg.student.enrollments[0] ?? null;
      const outstanding = await computeOutstandingBalance(sg.student.id);
      return { ...sg, activeEnrollment, outstanding };
    }),
  );
  const totalOutstanding = studentSummaries.reduce((sum, item) => sum + item.outstanding, 0);
  const activeStudentCount = studentSummaries.filter((item) => item.activeEnrollment?.status === "ACTIVE").length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-3 sm:space-y-4">
        <Link href="/guardians" className="text-xs sm:text-sm text-primary">
          ← Quay lại Phụ huynh
        </Link>
        <div className="flex flex-col gap-3 sm:gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2 sm:space-y-3">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">{guardian.fullName}</h1>
              <p className="mt-1 text-xs sm:text-sm text-ink-muted48">
                {guardian.phone ?? "Chưa có SĐT"}
                {guardian.user ? (
                  <span className="hidden sm:inline">
                    {" · "}Portal <strong>{guardian.user.email}</strong>
                  </span>
                ) : null}
              </p>
              {guardian.user ? (
                <p className="mt-1 text-xs text-ink-muted48 sm:hidden">
                  Portal: <strong>{guardian.user.email}</strong>
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 sm:px-3 py-1 font-medium text-sky-700">
                <span className="sm:hidden">HV</span>
                <span className="hidden sm:inline">Học viên</span> {studentSummaries.length}
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 sm:px-3 py-1 font-medium text-emerald-700">
                <span className="sm:hidden">Học</span>
                <span className="hidden sm:inline">Đang học</span> {activeStudentCount}
              </span>
              <span className={`rounded-full border px-2.5 sm:px-3 py-1 font-medium ${totalOutstanding > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                <span className="sm:hidden">Nợ</span>
                <span className="hidden sm:inline">Công nợ</span> {formatVnd(totalOutstanding)}
              </span>
              <span className={`rounded-full border px-2.5 sm:px-3 py-1 font-medium ${guardian.user?.isActive ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
                {guardian.user ? (guardian.user.isActive ? <><span className="sm:hidden">Portal OK</span><span className="hidden sm:inline">Portal hoạt động</span></> : <><span className="sm:hidden">Portal off</span><span className="hidden sm:inline">Portal tắt</span></>) : <><span className="sm:hidden">Chưa portal</span><span className="hidden sm:inline">Chưa có portal</span></>}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/guardians" className="btn-ghost text-xs sm:text-sm px-3 sm:px-4 py-2">
              <span className="sm:hidden">PH</span>
              <span className="hidden sm:inline">Danh sách PH</span>
            </Link>
            <Link href="/students" className="btn-ghost text-xs sm:text-sm px-3 sm:px-4 py-2">
              <span className="sm:hidden">HV</span>
              <span className="hidden sm:inline">Học viên</span>
            </Link>
            <Link href="/tuition" className="btn-ghost text-xs sm:text-sm px-3 sm:px-4 py-2">
              <span className="sm:hidden">Phí</span>
              <span className="hidden sm:inline">Học phí</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1.5fr)_380px]">
        <div className="space-y-4 sm:space-y-6">
          <div className="card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base sm:text-lg md:text-xl font-semibold tracking-tight">Học viên liên kết</h2>
                <p className="mt-1 text-xs sm:text-sm text-ink-muted48">
                  <span className="hidden sm:inline">Mỗi dòng là một lối tắt để mở đúng hồ sơ học viên hoặc lớp hiện tại.</span>
                  <span className="sm:hidden">Lối tắt đến hồ sơ học viên</span>
                </p>
              </div>
              <span className="badge bg-ink/5 text-ink-muted80 text-[10px] sm:text-xs">
                {studentSummaries.length} <span className="hidden sm:inline">học viên</span><span className="sm:hidden">HV</span>
              </span>
            </div>

            <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
              {studentSummaries.map((sg) => (
                <div key={sg.id} className="rounded-2xl sm:rounded-3xl border border-hairline bg-canvas-parchment/40 p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <Link href={`/students/${sg.student.id}`} className="text-base sm:text-lg font-semibold text-primary">
                          {sg.student.fullName}
                        </Link>
                        <span className="badge bg-ink/5 text-ink-muted80 text-[10px] sm:text-xs">
                          {sg.relation ?? (sg.isPrimary ? <><span className="sm:hidden">PH chính</span><span className="hidden sm:inline">Phụ huynh chính</span></> : <><span className="sm:hidden">PH phụ</span><span className="hidden sm:inline">Phụ huynh liên kết</span></>)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-ink-muted48">
                        {sg.student.studentCode}
                        {sg.student.lead?.leadCode ? ` · Lead ${sg.student.lead.leadCode}` : ""}
                      </p>
                      <p className="text-xs sm:text-sm text-ink-muted48">
                        <span className="hidden sm:inline">Lớp hiện tại</span>
                        <span className="sm:hidden">Lớp</span> <strong>{sg.activeEnrollment?.class?.className ?? "Chưa ghi danh"}</strong>
                      </p>
                    </div>

                    <div className="grid min-w-full sm:min-w-[280px] grid-cols-2 gap-2 sm:gap-3">
                      <div className="rounded-xl sm:rounded-2xl border border-white/70 bg-white/90 p-2.5 sm:p-3">
                        <p className="text-[10px] sm:text-xs text-ink-muted48">Công nợ</p>
                        <p className={`mt-1 text-sm sm:text-base font-semibold ${sg.outstanding > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                          {formatVnd(sg.outstanding)}
                        </p>
                      </div>
                      <div className="rounded-xl sm:rounded-2xl border border-white/70 bg-white/90 p-2.5 sm:p-3">
                        <p className="text-[10px] sm:text-xs text-ink-muted48">Trạng thái</p>
                        <p className="mt-1 text-sm sm:text-base font-semibold text-ink">
                          {sg.activeEnrollment?.status === "ACTIVE" ? "Đang học" : sg.activeEnrollment?.status ?? "Chưa có"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
                    <Link href={`/students/${sg.student.id}`} className="btn-primary text-xs sm:text-sm px-3 sm:px-4 py-2">
                      <span className="sm:hidden">Mở HV</span>
                      <span className="hidden sm:inline">Mở hồ sơ học viên</span>
                    </Link>
                    {sg.activeEnrollment?.classId ? (
                      <Link href={`/classes/${sg.activeEnrollment.classId}`} className="btn-ghost text-xs sm:text-sm px-3 sm:px-4 py-2">
                        Mở lớp
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}

              {studentSummaries.length === 0 ? (
                <div className="rounded-2xl sm:rounded-3xl border border-dashed border-hairline bg-canvas-parchment/30 p-4 sm:p-6 text-xs sm:text-sm text-ink-muted48">
                  Phụ huynh này chưa liên kết với học viên nào.
                </div>
              ) : null}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base sm:text-lg md:text-xl font-semibold tracking-tight">Lead liên quan</h2>
              <span className="badge bg-ink/5 text-ink-muted80 text-[10px] sm:text-xs">{guardian.leads.length} lead</span>
            </div>
            <div className="mt-3 space-y-2">
              {guardian.leads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-hairline px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm">
                  <Link href={`/leads/${lead.id}`} className="text-primary truncate mr-2">
                    {lead.fullName} · {lead.leadCode}
                  </Link>
                  <span className="badge bg-ink/5 text-ink-muted80 text-[10px] sm:text-xs whitespace-nowrap">
                    {LEAD_STATUS_LABEL[lead.status as keyof typeof LEAD_STATUS_LABEL] ?? lead.status}
                  </span>
                </div>
              ))}
              {guardian.leads.length === 0 ? <p className="text-xs sm:text-sm text-ink-muted48">Chưa có lead nào liên quan.</p> : null}
            </div>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="card">
            <h2 className="font-display text-base sm:text-lg md:text-xl font-semibold tracking-tight">Thông tin liên hệ</h2>
            <dl className="mt-3 sm:mt-4 space-y-2.5 sm:space-y-3 text-xs sm:text-sm">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <dt className="text-ink-muted48">Số điện thoại</dt>
                <dd className="text-right font-medium">{guardian.phone ?? "Chưa có"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <dt className="text-ink-muted48">Portal</dt>
                <dd className="text-right font-medium break-all">{guardian.user?.email ?? "Chưa cấp"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <dt className="text-ink-muted48">Tài khoản</dt>
                <dd className="text-right font-medium">
                  {guardian.user ? (guardian.user.isActive ? <><span className="sm:hidden">Hoạt động</span><span className="hidden sm:inline">Đang hoạt động</span></> : "Đã thu hồi") : "Chưa có portal"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <dt className="text-ink-muted48">Địa chỉ</dt>
                <dd className="text-right font-medium">{guardian.address ?? "Chưa có"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <dt className="text-ink-muted48">Ghi chú</dt>
                <dd className="text-right font-medium">{guardian.notes ?? "Không có"}</dd>
              </div>
            </dl>
          </div>

          <GuardianEditForm
            guardianId={guardian.id}
            initial={{
              fullName: guardian.fullName,
              phone: guardian.phone ?? "",
              address: guardian.address ?? "",
              notes: guardian.notes ?? "",
            }}
          />

          {canManageAccount ? (
            <GuardianAccountPanel
              guardianId={guardian.id}
              account={guardian.user ? { email: guardian.user.email, isActive: guardian.user.isActive } : null}
              defaultEmail=""
            />
          ) : null}

          {canDeleteGuardian ? (
            <div className="card">
              <DeleteGuardianButton
                guardianId={guardian.id}
                guardianName={guardian.fullName}
                disabled={guardian.leads.length > 0 || guardian.students.length > 0 || Boolean(guardian.user)}
                disabledReason={
                  guardian.leads.length > 0 || guardian.students.length > 0
                    ? "Còn liên kết lead/học viên, cần gỡ liên kết trước khi xóa."
                    : guardian.user
                      ? "Còn tài khoản portal, cần thu hồi trước khi xóa."
                      : undefined
                }
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
