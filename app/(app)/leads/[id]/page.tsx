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
  SCHEDULED: "bg-blue-100 text-blue-700",
  DONE: "bg-emerald-100 text-emerald-700",
  MISSED: "bg-red-100 text-red-700",
  CANCELLED: "bg-ink/5 text-ink-muted48",
};

function formatDateTime(d: Date | null) {
  return d ? new Date(d).toLocaleString("vi-VN") : "—";
}

function formatDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("vi-VN") : "—";
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

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leads" className="text-sm text-primary">
          ← Quay lại CRM tuyển sinh
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{lead.fullName}</h1>
            <p className="mt-1 text-sm text-ink-muted48">
              Mã lead: <strong>{lead.leadCode}</strong>
              {age !== null && <> · {age} tuổi</>}
              {suggested && <> · Gợi ý: {suggested}</>}
            </p>
          </div>
          <span className="badge bg-ink/5 text-ink-muted80">
            {LEAD_STATUS_LABEL[lead.status as keyof typeof LEAD_STATUS_LABEL] ?? lead.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold tracking-tight">Thông tin liên hệ</h2>
              {editable && (
                <Link href={`/leads/${lead.id}/edit`} className="btn-ghost text-sm">
                  Sửa thông tin
                </Link>
              )}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-ink-muted48">Phụ huynh</dt>
                <dd className="font-medium">{lead.guardian?.fullName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted48">Số điện thoại</dt>
                <dd className="font-medium">{lead.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted48">Địa chỉ</dt>
                <dd className="font-medium">{lead.address ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted48">Ngày gặp</dt>
                <dd className="font-medium">{formatDate(lead.meetDate)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted48">Nguồn</dt>
                <dd className="font-medium">{lead.source ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted48">Ngày dự kiến đi học</dt>
                <dd className="font-medium">{formatDate(lead.expectedStartDate)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted48">Facebook bố mẹ</dt>
                <dd className="font-medium">{lead.facebookParentName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted48">Link facebook</dt>
                <dd className="font-medium">
                  {lead.facebookLink ? (
                    <a href={lead.facebookLink} target="_blank" rel="noreferrer" className="text-primary">
                      {lead.facebookLink}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted48">Đánh giá học lực ban đầu</dt>
                <dd className="font-medium">{lead.initialAssessment ?? "—"}</dd>
              </div>
            </dl>
            {lead.notes && <p className="mt-3 text-sm text-ink-muted80">Ghi chú: {lead.notes}</p>}
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Liên kết vận hành</h2>
            <dl className="mt-3 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              <div>
                <dt className="text-ink-muted48">Phụ huynh chủ hồ sơ</dt>
                <dd className="mt-1 font-medium">
                  {linkedGuardian ? (
                    <Link href={`/guardians/${linkedGuardian.id}`} className="text-primary">
                      {linkedGuardian.fullName}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
                <p className="mt-1 text-xs text-ink-muted48">{linkedGuardian?.phone ?? "Chưa có số điện thoại"}</p>
              </div>
              <div>
                <dt className="text-ink-muted48">Portal phụ huynh</dt>
                <dd className="mt-1 font-medium">{linkedGuardian?.user ? linkedGuardian.user.email : "Chưa cấp tài khoản"}</dd>
                <p className="mt-1 text-xs text-ink-muted48">
                  {linkedGuardian?.user ? (linkedGuardian.user.isActive ? "Đang hoạt động" : "Đã thu hồi") : "Nên cấp ngay khi chính thức nhập học"}
                </p>
              </div>
              <div>
                <dt className="text-ink-muted48">Lớp quan tâm / xếp thử</dt>
                <dd className="mt-1 font-medium">{lead.interestedClass?.className ?? "Chưa gắn lớp quan tâm"}</dd>
                <p className="mt-1 text-xs text-ink-muted48">{lead.interestedClass?.classCode ?? lead.notes2 ?? "Dùng cho tuyển sinh và giáo vụ xếp lớp"}</p>
              </div>
              <div>
                <dt className="text-ink-muted48">Kết quả chuyển đổi</dt>
                <dd className="mt-1 font-medium">
                  {lead.student ? (
                    <Link href={`/students/${lead.student.id}`} className="text-primary">
                      {lead.student.fullName}
                    </Link>
                  ) : (
                    "Chưa chuyển thành học viên"
                  )}
                </dd>
                <p className="mt-1 text-xs text-ink-muted48">
                  {currentEnrollment?.class ? `Đang học lớp ${currentEnrollment.class.className}` : "Chưa có enrollment"}
                </p>
              </div>
              <div>
                <dt className="text-ink-muted48">Mã lead gốc</dt>
                <dd className="mt-1 font-medium">{lead.leadCode}</dd>
                <p className="mt-1 text-xs text-ink-muted48">Mã này phải theo xuyên suốt từ CRM → học viên → báo cáo.</p>
              </div>
              <div>
                <dt className="text-ink-muted48">Công nợ hiện tại</dt>
                <dd className="mt-1 font-medium">{outstanding !== null ? `${outstanding.toLocaleString("vi-VN")}đ` : "Chưa phát sinh"}</dd>
                <p className="mt-1 text-xs text-ink-muted48">
                  {lead.student ? "Hiện trên hồ sơ học viên và portal phụ huynh." : "Sẽ có sau khi nhập học và sinh học phí."}
                </p>
              </div>
            </dl>
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Test đầu vào</h2>
            <div className="mt-3 space-y-2">
              {lead.placementTests.map((t) => (
                <div key={t.id} className="rounded-lg border border-hairline px-3 py-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{formatDate(t.testDate)}</span>
                    <span className="text-ink-muted48">{t.suggestedClass}</span>
                  </div>
                  {t.result && <p className="mt-1 text-ink-muted80">Kết quả: {t.result}</p>}
                  {t.notes && <p className="text-ink-muted48">{t.notes}</p>}
                </div>
              ))}
              {lead.placementTests.length === 0 && <p className="text-sm text-ink-muted48">Chưa có kết quả test.</p>}
            </div>
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Lịch hẹn</h2>
            <div className="mt-3 space-y-2">
              {lead.appointments.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2 text-sm">
                  <div>
                    <span>{formatDateTime(a.scheduledAt)}</span>
                    {a.notes && <p className="text-xs text-ink-muted48">{a.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge ${APPOINTMENT_STATUS_COLOR[a.status] ?? "bg-ink/5 text-ink-muted80"}`}>
                      {APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}
                    </span>
                    {editable && <AppointmentStatusButtons appointmentId={a.id} status={a.status} />}
                  </div>
                </div>
              ))}
              {lead.appointments.length === 0 && <p className="text-sm text-ink-muted48">Chưa có lịch hẹn.</p>}
            </div>
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Lịch sử tương tác</h2>
            <div className="mt-3 space-y-2">
              {lead.interactions.map((i) => (
                <div key={i.id} className="rounded-lg border border-hairline px-3 py-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{INTERACTION_LABEL[i.type] ?? i.type}</span>
                    <span className="text-ink-muted48">{formatDateTime(i.occurredAt)}</span>
                  </div>
                  {i.content && <p className="mt-1 text-ink-muted80">{i.content}</p>}
                </div>
              ))}
              {lead.interactions.length === 0 && <p className="text-sm text-ink-muted48">Chưa có tương tác nào.</p>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {editable ? (
            <>
              <LeadStatusPanel leadId={lead.id} status={lead.status} hasStudent={!!lead.student} />
              <LeadActivityForms leadId={lead.id} />
            </>
          ) : (
            <div className="card">
              <p className="text-sm text-ink-muted48">
                Vai trò của bạn chỉ có quyền xem lead này — không thể đổi trạng thái hoặc ghi nhận hoạt động mới.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
