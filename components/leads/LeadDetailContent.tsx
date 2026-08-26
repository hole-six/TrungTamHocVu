"use client";

import { useState } from "react";
import Link from "next/link";
import LeadStatusPanel from "@/components/leads/LeadStatusPanel";
import LeadActivityForms from "@/components/leads/LeadActivityForms";
import AppointmentStatusButtons from "@/components/leads/AppointmentStatusButtons";
import { LEAD_STATUS_LABEL, calculateAge, suggestGradeLevel } from "@/lib/server/lead-rules";

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

function formatDateTime(d: string | null) {
  return d ? new Date(d).toLocaleString("vi-VN") : "—";
}

function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("vi-VN") : "—";
}

function formatMoney(amount: number | null) {
  return amount === null ? "Chưa phát sinh" : `${amount.toLocaleString("vi-VN")}đ`;
}

function InfoItem({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#e8eef8] bg-white px-3 py-3 sm:px-4 sm:py-4">
      <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-[#8aa0ba]">{label}</p>
      <div className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-semibold text-[#12304a] break-words">{value}</div>
      {hint ? <div className="mt-1 text-[10px] sm:text-xs text-[#6e7f93]">{hint}</div> : null}
    </div>
  );
}

export type LeadDetailData = {
  lead: {
    id: string;
    leadCode: string;
    fullName: string;
    status: string;
    dob: string | null;
    phone: string | null;
    address: string | null;
    source: string | null;
    facebookParentName: string | null;
    facebookLink: string | null;
    initialAssessment: string | null;
    notes: string | null;
    meetDate: string | null;
    expectedStartDate: string | null;
    guardian: { id: string; fullName: string; phone: string | null; user: { email: string | null; isActive: boolean } | null } | null;
    interestedClass: { className: string; classCode: string } | null;
    interactions: { id: string; type: string; content: string | null; occurredAt: string }[];
    appointments: { id: string; status: string; notes: string | null; scheduledAt: string }[];
    placementTests: { id: string; testDate: string | null; suggestedClass: string | null; result: string | null; notes: string | null }[];
    student: { id: string; fullName: string } | null;
  };
  editable: boolean;
  currentEnrollment: { class: { className: string; tuitionPerSession: number | null; totalSessions: number | null } } | null;
  linkedGuardian: { id: string; fullName: string; phone: string | null; user: { email: string | null; isActive: boolean } | null } | null;
  outstanding: number | null;
};

type TabKey = "profile" | "schedule" | "interactions";

export default function LeadDetailContent({ data, onChanged }: { data: LeadDetailData; onChanged?: () => void }) {
  const { lead, editable, currentEnrollment, linkedGuardian, outstanding } = data;
  const [tab, setTab] = useState<TabKey>("profile");

  const age = calculateAge(lead.dob ? new Date(lead.dob) : null);
  const suggested = suggestGradeLevel(age);
  const currentClassTuition =
    currentEnrollment?.class.tuitionPerSession && currentEnrollment.class.totalSessions
      ? currentEnrollment.class.tuitionPerSession * currentEnrollment.class.totalSessions
      : null;
  const latestAppointment = lead.appointments[0] ?? null;
  const latestInteraction = lead.interactions[0] ?? null;
  const latestPlacement = lead.placementTests[0] ?? null;

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "profile", label: "Hồ sơ" },
    { key: "schedule", label: "Lịch hẹn & Test", count: lead.appointments.length + lead.placementTests.length },
    { key: "interactions", label: "Tương tác", count: lead.interactions.length },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-[22px] border border-[#dbe7ff] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-[#cfe2ff] bg-[#f3f8ff] px-3 py-1.5 text-sm font-semibold text-[#1f5fa8]">Mã lead {lead.leadCode}</span>
          <span className="rounded-lg border border-[#dbe7ff] bg-[#f8fbff] px-3 py-1.5 text-sm font-semibold text-[#12304a]">
            {LEAD_STATUS_LABEL[lead.status as keyof typeof LEAD_STATUS_LABEL] ?? lead.status}
          </span>
          {age !== null ? <span className="rounded-lg border border-[#dbe7ff] bg-white px-3 py-1.5 text-sm font-medium text-[#50657b]">{age} tuổi</span> : null}
          {suggested ? <span className="rounded-lg border border-[#e9d5ff] bg-[#faf5ff] px-3 py-1.5 text-sm font-medium text-[#7c3aed]">Gợi ý {suggested}</span> : null}
          {editable ? (
            <Link href={`/leads/${lead.id}/edit`} className="btn-ghost-sm ml-auto">
              Sửa thông tin
            </Link>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-[#d8e7fb] bg-[#fcfdff] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8aa0ba]">Lịch hẹn</p>
            <p className="mt-1.5 text-xl font-black text-[#12304a]">{lead.appointments.length}</p>
            <p className="mt-1 text-xs text-[#6b7a8c] truncate">{latestAppointment ? formatDateTime(latestAppointment.scheduledAt) : "Chưa có lịch"}</p>
          </div>
          <div className="rounded-xl border border-[#d8e7fb] bg-[#fcfdff] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8aa0ba]">Tương tác</p>
            <p className="mt-1.5 text-xl font-black text-[#12304a]">{lead.interactions.length}</p>
            <p className="mt-1 text-xs text-[#6b7a8c] truncate">{latestInteraction ? formatDateTime(latestInteraction.occurredAt) : "Chưa ghi nhận"}</p>
          </div>
          <div className="rounded-xl border border-[#d8e7fb] bg-[#fcfdff] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8aa0ba]">Test đầu vào</p>
            <p className="mt-1.5 text-xl font-black text-[#12304a]">{lead.placementTests.length}</p>
            <p className="mt-1 text-xs text-[#6b7a8c] truncate">{latestPlacement ? formatDate(latestPlacement.testDate) : "Chưa test"}</p>
          </div>
          <div className="rounded-xl border border-[#d8e7fb] bg-[#fcfdff] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8aa0ba]">Công nợ hiện tại</p>
            <p className="mt-1.5 text-xl font-black text-[#12304a]">{outstanding !== null ? `${outstanding.toLocaleString("vi-VN")}đ` : "0đ"}</p>
            <p className="mt-1 text-xs text-[#6b7a8c] truncate">{lead.student ? "Đã có hồ sơ học viên" : "Chưa chuyển đổi"}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1.7fr)_340px]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                  tab === t.key ? "bg-primary text-white shadow-sm" : "border border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#d1d5db]"
                }`}
              >
                {t.label}
                {t.count !== undefined ? ` (${t.count})` : ""}
              </button>
            ))}
          </div>

          {tab === "profile" ? (
            <div className="space-y-4">
              <section className="rounded-[22px] border border-[#dbe7ff] bg-white p-4 sm:p-5">
                <h2 className="text-base font-bold tracking-tight text-[#12304a]">Thông tin hồ sơ</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                  <div className="mt-3 rounded-xl border border-[#e8eef8] bg-[#f8fbff] px-3 py-3 sm:px-4 sm:py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8aa0ba]">Ghi chú CRM</p>
                    <p className="mt-1.5 text-xs sm:text-sm leading-6 text-[#51657a]">{lead.notes}</p>
                  </div>
                ) : null}
              </section>

              <section className="rounded-[22px] border border-[#dbe7ff] bg-white p-4 sm:p-5">
                <h2 className="text-base font-bold tracking-tight text-[#12304a]">Liên kết vận hành</h2>
                <p className="mt-1 text-xs text-[#6b7a8c]">Phụ huynh, portal, học viên và lớp hiện tại nếu lead đã chuyển đổi.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
            </div>
          ) : null}

          {tab === "schedule" ? (
            <div className="space-y-4">
              <section className="rounded-[22px] border border-[#dbe7ff] bg-white p-4 sm:p-5">
                <h2 className="text-base font-bold tracking-tight text-[#12304a]">Lịch hẹn</h2>
                <div className="mt-3 space-y-2">
                  {lead.appointments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#dbe7ff] px-4 py-8 text-center text-sm text-[#7b8ea5]">Chưa có lịch hẹn nào.</div>
                  ) : (
                    lead.appointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="flex flex-col gap-2 rounded-[18px] border border-[#e8eef8] bg-[#fcfdff] px-3 py-3 sm:px-4 sm:py-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#12304a]">{formatDateTime(appointment.scheduledAt)}</p>
                          {appointment.notes ? <p className="mt-1 text-xs text-[#6b7a8c] truncate">{appointment.notes}</p> : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${APPOINTMENT_STATUS_COLOR[appointment.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {APPOINTMENT_STATUS_LABEL[appointment.status] ?? appointment.status}
                          </span>
                          {editable ? <AppointmentStatusButtons appointmentId={appointment.id} status={appointment.status} onSuccess={onChanged} /> : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[22px] border border-[#dbe7ff] bg-white p-4 sm:p-5">
                <h2 className="text-base font-bold tracking-tight text-[#12304a]">Test đầu vào</h2>
                <div className="mt-3 space-y-2">
                  {lead.placementTests.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#dbe7ff] px-4 py-8 text-center text-sm text-[#7b8ea5]">Chưa có kết quả test đầu vào.</div>
                  ) : (
                    lead.placementTests.map((test) => (
                      <div key={test.id} className="rounded-[18px] border border-[#e8eef8] bg-[#fcfdff] px-3 py-3 sm:px-4 sm:py-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[#12304a]">{formatDate(test.testDate)}</p>
                            <p className="mt-1 text-xs text-[#6b7a8c]">{test.suggestedClass ?? "Chưa gợi ý lớp"}</p>
                          </div>
                          {test.result ? (
                            <span className="rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-2.5 py-1 text-xs font-medium text-[#235f9d]">{test.result}</span>
                          ) : null}
                        </div>
                        {test.notes ? <p className="mt-2 text-xs leading-6 text-[#51657a]">{test.notes}</p> : null}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {tab === "interactions" ? (
            <section className="rounded-[22px] border border-[#dbe7ff] bg-white p-4 sm:p-5">
              <h2 className="text-base font-bold tracking-tight text-[#12304a]">Lịch sử tương tác</h2>
              <div className="mt-3 space-y-2">
                {lead.interactions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#dbe7ff] px-4 py-8 text-center text-sm text-[#7b8ea5]">Chưa có tương tác nào.</div>
                ) : (
                  lead.interactions.map((interaction) => (
                    <div key={interaction.id} className="rounded-[18px] border border-[#e8eef8] bg-[#fcfdff] px-3 py-3 sm:px-4 sm:py-4">
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                        <p className="text-sm font-semibold text-[#12304a]">{INTERACTION_LABEL[interaction.type] ?? interaction.type}</p>
                        <p className="text-xs text-[#7b8ea5] whitespace-nowrap">{formatDateTime(interaction.occurredAt)}</p>
                      </div>
                      {interaction.content ? <p className="mt-1.5 text-xs leading-6 text-[#51657a]">{interaction.content}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          {editable ? (
            <>
              <LeadStatusPanel leadId={lead.id} status={lead.status} hasStudent={!!lead.student} onSuccess={onChanged} />
              <LeadActivityForms leadId={lead.id} onSuccess={onChanged} />
            </>
          ) : (
            <section className="rounded-[22px] border border-[#dbe7ff] bg-white p-4 sm:p-5">
              <p className="text-sm leading-6 text-[#6b7a8c]">Vai trò hiện tại chỉ được xem chi tiết lead này. Không thể đổi trạng thái hoặc thêm hoạt động mới.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
