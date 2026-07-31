import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import GuardianEditForm from "@/components/guardians/GuardianEditForm";
import GuardianAccountPanel from "@/components/guardians/GuardianAccountPanel";
import { LEAD_STATUS_LABEL } from "@/lib/server/lead-rules";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { computeOutstandingBalance } from "@/lib/server/balance";

function formatVnd(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

export default async function GuardianDetailPage({ params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser();
  const role = currentUser ? await getUserRole(currentUser.id) : null;
  const canManageAccount = canUpdate("students", role);

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

  return (
    <div className="space-y-6">
      <div>
        <Link href="/guardians" className="text-sm text-primary">
          ← Quay lại Phụ huynh
        </Link>
        <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{guardian.fullName}</h1>
            <p className="mt-1 text-sm text-ink-muted48">
              {guardian.phone ?? "Chưa có SĐT"}
              {guardian.user ? (
                <span>
                  {" · "}Portal: <strong>{guardian.user.email}</strong>
                </span>
              ) : null}
            </p>
            <p className="mt-2 text-sm text-ink-muted48">
              Trang này chỉ giữ vai trò đầu mối liên hệ và quản lý portal. Toàn bộ học phí, nhật ký lớp, sách phát sinh và vận hành học tập nên xem trực tiếp trong hồ sơ 360 của từng học viên.
            </p>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            Đã rút gọn vai trò phụ huynh: xem nhanh con đang học lớp nào, đang nợ bao nhiêu và mở thẳng đúng hồ sơ học viên.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_380px]">
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">Học viên liên kết</h2>
                <p className="mt-1 text-sm text-ink-muted48">
                  Mỗi dòng là một lối tắt để mở đúng hồ sơ 360, nơi đã có sẵn phụ huynh, lớp, công nợ và nhật ký học tập.
                </p>
              </div>
              <span className="badge bg-ink/5 text-ink-muted80">{studentSummaries.length} học viên</span>
            </div>

            <div className="mt-4 space-y-3">
              {studentSummaries.map((sg) => (
                <div key={sg.id} className="rounded-3xl border border-hairline bg-canvas-parchment/40 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/students/${sg.student.id}`} className="text-lg font-semibold text-primary">
                          {sg.student.fullName}
                        </Link>
                        <span className="badge bg-ink/5 text-ink-muted80">{sg.relation ?? (sg.isPrimary ? "Phụ huynh chính" : "Phụ huynh liên kết")}</span>
                      </div>
                      <p className="text-sm text-ink-muted48">
                        {sg.student.studentDisplayId ?? sg.student.studentCode}
                        {sg.student.lead?.leadCode ? ` · Lead ${sg.student.lead.leadCode}` : ""}
                      </p>
                      <p className="text-sm text-ink-muted48">
                        Lớp hiện tại: <strong>{sg.activeEnrollment?.class?.className ?? "Chưa ghi danh"}</strong>
                      </p>
                    </div>

                    <div className="grid min-w-[280px] grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/70 bg-white/90 p-3">
                        <p className="text-xs text-ink-muted48">Công nợ hiện tại</p>
                        <p className={`mt-1 text-base font-semibold ${sg.outstanding > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                          {formatVnd(sg.outstanding)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white/90 p-3">
                        <p className="text-xs text-ink-muted48">Tình trạng lớp</p>
                        <p className="mt-1 text-base font-semibold text-ink">
                          {sg.activeEnrollment?.status === "ACTIVE" ? "Đang học" : sg.activeEnrollment?.status ?? "Chưa có"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Link href={`/students/${sg.student.id}`} className="btn-primary">
                      Mở hồ sơ 360 học viên
                    </Link>
                    {sg.activeEnrollment?.classId ? (
                      <Link href={`/classes/${sg.activeEnrollment.classId}`} className="btn-ghost">
                        Mở lớp hiện tại
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}

              {studentSummaries.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-hairline bg-canvas-parchment/30 p-6 text-sm text-ink-muted48">
                  Phụ huynh này chưa liên kết với học viên nào.
                </div>
              ) : null}
            </div>
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Lead liên quan</h2>
            <div className="mt-3 space-y-2">
              {guardian.leads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between rounded-2xl border border-hairline px-4 py-3 text-sm">
                  <Link href={`/leads/${lead.id}`} className="text-primary">
                    {lead.fullName} · {lead.leadCode}
                  </Link>
                  <span className="badge bg-ink/5 text-ink-muted80">
                    {LEAD_STATUS_LABEL[lead.status as keyof typeof LEAD_STATUS_LABEL] ?? lead.status}
                  </span>
                </div>
              ))}
              {guardian.leads.length === 0 ? <p className="text-sm text-ink-muted48">Chưa có lead nào liên quan.</p> : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Đầu mối liên hệ</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-ink-muted48">Số điện thoại</dt>
                <dd className="text-right font-medium">{guardian.phone ?? "Chưa có"}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-ink-muted48">Portal</dt>
                <dd className="text-right font-medium">{guardian.user?.email ?? "Chưa cấp"}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-ink-muted48">Trạng thái tài khoản</dt>
                <dd className="text-right font-medium">
                  {guardian.user ? (guardian.user.isActive ? "Đang hoạt động" : "Đã thu hồi") : "Chưa có portal"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-ink-muted48">Địa chỉ</dt>
                <dd className="text-right font-medium">{guardian.address ?? "Chưa có"}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
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
        </div>
      </div>
    </div>
  );
}
