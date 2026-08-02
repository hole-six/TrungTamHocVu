import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LeadStatusPanel from "@/components/leads/LeadStatusPanel";
import LeadActivityForms from "@/components/leads/LeadActivityForms";
import AppointmentStatusButtons from "@/components/leads/AppointmentStatusButtons";
import { LEAD_STATUS_LABEL, calculateAge, suggestGradeLevel } from "@/lib/server/lead-rules";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { computeOutstandingBalance } from "@/lib/server/balance";

const INTERACTION_LABEL: Record<string, string> = {
  CALL: "Gọi điện",
  MEET: "Gặp trực tiếp",
  MESSAGE: "Nhắn tin",
  EMAIL: "Email",
};

const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Đã hẹn",
  DONE: "Đã đến",
  MISSED: "Vắng",
  CANCELLED: "Đã hủy",
};

const APPOINTMENT_STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200",
  DONE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MISSED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

function formatDateTime(d: Date | null) {
  return d ? new Date(d).toLocaleString("vi-VN") : "—";
}

function formatDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("vi-VN") : "—";
}

function formatMoney(amount: number | null) {
  return amount === null ? "Chưa phát sinh" : `${amount.toLocaleString("vi-VN")}đ`;
}

function InfoItem({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#e8eef8] bg-white px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8aa0ba]">{label}</p>
      <div className="mt-2 text-sm font-semibold text-[#12304a]">{value}</div>
      {hint ? <div className="mt-1 text-xs text-[#6e7f93]">{hint}</div> : null}
    </div>
  );
}

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      guardian: { include: { user: true } },
      interestedClass: true,
      interactions: { orderBy: { occurredAt: "desc" } },
      appointments: { orderBy: { scheduledAt: "desc" } },
      placementTests: { orderBy: { testDate: "desc" } },
      student: {
        include: {
          guardians: {
            where: { isPrimary: true },
            include: { guardian: { include: { user: true } } },
          },
          enrollments: { include: { class: true }, orderBy: { enrollDate: "desc" } },
        },
      },
    },
  });
  if (!lead) notFound();

  const currentUser = await getCurrentUser();
  const role = currentUser ? await getUserRole(currentUser.id) : null;
  const editable = canUpdate("leads", role);

  const age = calculateAge(lead.dob);
  const suggested = suggestGradeLevel(age);
  const currentEnrollment = lead.student?.enrollments.find((e) => e.status === "ACTIVE") ?? lead.student?.enrollments[0] ?? null;
  const linkedGuardian = lead.student?.guardians[0]?.guardian ?? lead.guardian ?? null;
  const outstanding = lead.student ? await computeOutstandingBalance(lead.student.id) : null;
  const currentClassTuition =
    currentEnrollment?.class.tuitionPerSession && currentEnrollment.class.totalSessions
      ? currentEnrollment.class.tuitionPerSession * currentEnrollment.class.totalSessions
      : null;

  const latestAppointment = lead.appointments[0] ?? null;
  const latestInteraction = lead.interactions[0] ?? null;
  const latestPlacement = lead.placementTests[0] ?? null;

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-[32px] border border-[#dbe7ff] bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.06)] md:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <Link href="/leads" className="inline-flex items-center gap-2 text-sm font-medium text-[#3b82f6] hover:underline">
              ← Về CRM tuyển sinh
            </Link>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#3da3ff]">Lead detail</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[#12304a] md:text-[40px]">{lead.fullName}</h1>
              <p className="mt-2 text-sm text-[#607186] md:text-base">
                Chi tiết hồ sơ tuyển sinh, phụ huynh, lịch hẹn, test đầu vào và trạng thái chuyển đổi được gom lại trên một màn dễ vận hành hơn.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[#cfe2ff] bg-[#f3f8ff] px-3 py-1 text-sm font-medium text-[#1f5fa8]">
                Mã lead {lead.leadCode}
              </span>
              {age !== null ? (
                <span className="rounded-full border border-[#dbe7ff] bg-white px-3 py-1 text-sm font-medium text-[#50657b]">
                  {age} tuổi
                </span>
              ) : null}
              {suggested ? (
                <span className="rounded-full border border-[#e9d5ff] bg-[#faf5ff] px-3 py-1 text-sm font-medium text-[#7c3aed]">
                  Gợi ý {suggested}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <span className="rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-4 py-2 text-sm font-semibold text-[#12304a]">
              {LEAD_STATUS_LABEL[lead.status as keyof typeof LEAD_STATUS_LABEL] ?? lead.status}
            </span>
            {editable ? (
              <Link href={`/leads/${lead.id}/edit`} className="btn-ghost">
                Sửa thông tin
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-[#d8e7fb] bg-white px-5 py-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#8aa0ba]">Lịch hẹn</p>
          <p className="mt-2 text-3xl font-black text-[#12304a]">{lead.appointments.length}</p>
          <p className="mt-1 text-sm text-[#6b7a8c]">{latestAppointment ? formatDateTime(latestAppointment.scheduledAt) : "Chưa có lịch"}</p>
        </div>
        <div className="rounded-[24px] border border-[#d8e7fb] bg-white px-5 py-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#8aa0ba]">Tương tác</p>
          <p className="mt-2 text-3xl font-black text-[#12304a]">{lead.interactions.length}</p>
          <p className="mt-1 text-sm text-[#6b7a8c]">{latestInteraction ? formatDateTime(latestInteraction.occurredAt) : "Chưa ghi nhận"}</p>
        </div>
        <div className="rounded-[24px] border border-[#d8e7fb] bg-white px-5 py-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#8aa0ba]">Test đầu vào</p>
          <p className="mt-2 text-3xl font-black text-[#12304a]">{lead.placementTests.length}</p>
          <p className="mt-1 text-sm text-[#6b7a8c]">{latestPlacement ? formatDate(latestPlacement.testDate) : "Chưa test"}</p>
        </div>
        <div className="rounded-[24px] border border-[#d8e7fb] bg-white px-5 py-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#8aa0ba]">Công nợ hiện tại</p>
          <p className="mt-2 text-3xl font-black text-[#12304a]">{outstanding !== null ? `${outstanding.toLocaleString("vi-VN")}đ` : "0đ"}</p>
          <p className="mt-1 text-sm text-[#6b7a8c]">{lead.student ? "Đã có hồ sơ học viên" : "Chưa chuyển đổi"}</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.75fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-[#dbe7ff] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[#12304a]">Thông tin hồ sơ</h2>
                <p className="mt-1 text-sm text-[#6b7a8c]">Gom lại phần liên hệ, nguồn lead và ghi chú ban đầu.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <InfoItem label="Phụ huynh" value={lead.guardian?.fullName ?? "Chưa có"} hint={lead.phone ?? "Chưa có số điện thoại"} />
              <InfoItem label="Ngày gặp" value={formatDate(lead.meetDate)} hint={`Ngày dự kiến học: ${formatDate(lead.expectedStartDate)}`} />
              <InfoItem label="Nguồn lead" value={lead.source ?? "Chưa ghi"} />
              <InfoItem label="Địa chỉ" value={lead.address ?? "Chưa ghi"} />
              <InfoItem label="Facebook phụ huynh" value={lead.facebookParentName ?? "Chưa ghi"} />
              <InfoItem
                label="Link Facebook"
                value={
                  lead.facebookLink ? (
                    <a href={lead.facebookLink} target="_blank" rel="noreferrer" className="text-[#2563eb] hover:underline">
                      {lead.facebookLink}
                    </a>
                  ) : (
                    "Chưa có"
                  )
                }
              />
              <InfoItem label="Đánh giá đầu vào" value={lead.initialAssessment ?? "Chưa ghi"} />
              <InfoItem label="Lớp quan tâm" value={lead.interestedClass?.className ?? "Chưa gắn"} hint={lead.interestedClass?.classCode ?? undefined} />
            </div>

            {lead.notes ? (
              <div className="mt-4 rounded-2xl border border-[#e8eef8] bg-[#f8fbff] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8aa0ba]">Ghi chú CRM</p>
                <p className="mt-2 text-sm leading-6 text-[#51657a]">{lead.notes}</p>
              </div>
            ) : null}
          </section>

          <section className="rounded-[28px] border border-[#dbe7ff] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <h2 className="text-xl font-bold tracking-tight text-[#12304a]">Liên kết vận hành</h2>
            <p className="mt-1 text-sm text-[#6b7a8c]">Phụ huynh, portal, học viên và lớp hiện tại nếu lead đã chuyển đổi.</p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <InfoItem
                label="Phụ huynh chính"
                value={
                  linkedGuardian ? (
                    <Link href={`/guardians/${linkedGuardian.id}`} className="text-[#2563eb] hover:underline">
                      {linkedGuardian.fullName}
                    </Link>
                  ) : (
                    "Chưa gắn"
                  )
                }
                hint={linkedGuardian?.phone ?? "Chưa có số điện thoại"}
              />
              <InfoItem
                label="Portal phụ huynh"
                value={linkedGuardian?.user?.email ?? "Chưa cấp tài khoản"}
                hint={linkedGuardian?.user ? (linkedGuardian.user.isActive ? "Đang hoạt động" : "Đã thu hồi") : "Nên cấp khi nhập học"}
              />
              <InfoItem
                label="Học viên"
                value={
                  lead.student ? (
                    <Link href={`/students/${lead.student.id}`} className="text-[#2563eb] hover:underline">
                      {lead.student.fullName}
                    </Link>
                  ) : (
                    "Chưa chuyển thành học viên"
                  )
                }
                hint={currentEnrollment?.class ? `Đang học ${currentEnrollment.class.className}` : "Chưa có enrollment"}
              />
              <InfoItem
                label="Học phí / công nợ"
                value={formatMoney(outstanding)}
                hint={
                  currentClassTuition
                    ? `Tạm tính toàn khóa ${currentClassTuition.toLocaleString("vi-VN")}đ`
                    : currentEnrollment?.class.tuitionPerSession
                      ? `${currentEnrollment.class.tuitionPerSession.toLocaleString("vi-VN")}đ / buổi`
                      : "Chưa có cấu hình học phí"
                }
              />
            </div>
          </section>

          <section className="rounded-[28px] border border-[#dbe7ff] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <h2 className="text-xl font-bold tracking-tight text-[#12304a]">Test đầu vào</h2>
            <div className="mt-4 space-y-3">
              {lead.placementTests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#dbe7ff] px-4 py-10 text-center text-sm text-[#7b8ea5]">
                  Chưa có kết quả test đầu vào.
                </div>
              ) : (
                lead.placementTests.map((test) => (
                  <div key={test.id} className="rounded-[22px] border border-[#e8eef8] bg-[#fcfdff] px-4 py-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-semibold text-[#12304a]">{formatDate(test.testDate)}</p>
                        <p className="mt-1 text-sm text-[#6b7a8c]">{test.suggestedClass ?? "Chưa gợi ý lớp"}</p>
                      </div>
                      {test.result ? (
                        <span className="rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-3 py-1 text-sm font-medium text-[#235f9d]">
                          {test.result}
                        </span>
                      ) : null}
                    </div>
                    {test.notes ? <p className="mt-3 text-sm leading-6 text-[#51657a]">{test.notes}</p> : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-[#dbe7ff] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <h2 className="text-xl font-bold tracking-tight text-[#12304a]">Lịch hẹn</h2>
            <div className="mt-4 space-y-3">
              {lead.appointments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#dbe7ff] px-4 py-10 text-center text-sm text-[#7b8ea5]">
                  Chưa có lịch hẹn nào.
                </div>
              ) : (
                lead.appointments.map((appointment) => (
                  <div key={appointment.id} className="flex flex-col gap-3 rounded-[22px] border border-[#e8eef8] bg-[#fcfdff] px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-[#12304a]">{formatDateTime(appointment.scheduledAt)}</p>
                      {appointment.notes ? <p className="mt-1 text-sm text-[#6b7a8c]">{appointment.notes}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`rounded-full border px-3 py-1 text-sm font-medium ${APPOINTMENT_STATUS_COLOR[appointment.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {APPOINTMENT_STATUS_LABEL[appointment.status] ?? appointment.status}
                      </span>
                      {editable ? <AppointmentStatusButtons appointmentId={appointment.id} status={appointment.status} /> : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-[#dbe7ff] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <h2 className="text-xl font-bold tracking-tight text-[#12304a]">Lịch sử tương tác</h2>
            <div className="mt-4 space-y-3">
              {lead.interactions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#dbe7ff] px-4 py-10 text-center text-sm text-[#7b8ea5]">
                  Chưa có tương tác nào.
                </div>
              ) : (
                lead.interactions.map((interaction) => (
                  <div key={interaction.id} className="rounded-[22px] border border-[#e8eef8] bg-[#fcfdff] px-4 py-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <p className="font-semibold text-[#12304a]">{INTERACTION_LABEL[interaction.type] ?? interaction.type}</p>
                      <p className="text-sm text-[#7b8ea5]">{formatDateTime(interaction.occurredAt)}</p>
                    </div>
                    {interaction.content ? <p className="mt-2 text-sm leading-6 text-[#51657a]">{interaction.content}</p> : null}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[28px] border border-[#dbe7ff] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <h2 className="text-xl font-bold tracking-tight text-[#12304a]">Tóm tắt nhanh</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-[#e8eef8] bg-[#f8fbff] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8aa0ba]">Học viên hiện tại</p>
                <p className="mt-2 text-sm font-semibold text-[#12304a]">
                  {lead.student ? lead.student.fullName : "Chưa chuyển đổi"}
                </p>
              </div>
              <div className="rounded-2xl border border-[#e8eef8] bg-white px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8aa0ba]">Lớp hiện tại</p>
                <p className="mt-2 text-sm font-semibold text-[#12304a]">
                  {currentEnrollment?.class?.className ?? lead.interestedClass?.className ?? "Chưa gắn lớp"}
                </p>
              </div>
              <div className="rounded-2xl border border-[#e8eef8] bg-white px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8aa0ba]">Portal phụ huynh</p>
                <p className="mt-2 text-sm font-semibold text-[#12304a]">
                  {linkedGuardian?.user?.email ?? "Chưa cấp"}
                </p>
              </div>
            </div>
          </section>

          {editable ? (
            <>
              <LeadStatusPanel leadId={lead.id} status={lead.status} hasStudent={!!lead.student} />
              <LeadActivityForms leadId={lead.id} />
            </>
          ) : (
            <section className="rounded-[28px] border border-[#dbe7ff] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
              <p className="text-sm leading-6 text-[#6b7a8c]">
                Vai trò hiện tại chỉ được xem chi tiết lead này. Không thể đổi trạng thái hoặc thêm hoạt động mới.
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
