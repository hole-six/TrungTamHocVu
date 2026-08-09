import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LeadStatusPanel from "@/components/leads/LeadStatusPanel";
import LeadActivityForms from "@/components/leads/LeadActivityForms";
import AppointmentStatusButtons from "@/components/leads/AppointmentStatusButtons";
import { LEAD_STATUS_LABEL, calculateAge, suggestGradeLevel } from "@/lib/server/lead-rules";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate, canView } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import { computeOutstandingBalance } from "@/lib/server/balance";
import PageGuide from "@/components/ui/PageGuide";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";

const LEAD_DETAIL_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="lead-header"]',
    title: "Trạng thái pipeline của lead này",
    description: "Đổi trạng thái ở khối \"Trạng thái\" bên phải — mỗi lần đổi nên gắn với một hành động thực tế đã xảy ra, không đổi để làm đẹp dashboard.",
    placement: "bottom",
  },
  {
    target: '[data-tour="lead-kpi"]',
    title: "4 số tổng quan hành trình lead",
    description: "\"Công nợ hiện tại\" chỉ có khi lead đã chuyển thành học viên — trước đó luôn hiện 0đ vì chưa phát sinh học phí.",
    placement: "bottom",
  },
  {
    target: '[data-tour="lead-profile"]',
    title: "Thông tin hồ sơ — liên hệ, nguồn, ghi chú CRM",
    description: "Bấm \"Sửa thông tin\" ở góc trên để chỉnh sửa các trường này.",
    placement: "right",
  },
  {
    target: '[data-tour="lead-links"]',
    title: "Liên kết vận hành — theo dõi sau khi chuyển đổi",
    description: "Sau khi lead chuyển thành học viên, các đường link này dẫn thẳng sang hồ sơ phụ huynh/học viên thật — tránh phải tìm lại thủ công.",
    placement: "right",
  },
  {
    target: '[data-tour="lead-status"]',
    title: "Đổi trạng thái và ghi hoạt động mới",
    description: "Đây là nơi duy nhất thao tác thay đổi được: đổi trạng thái pipeline, thêm lịch hẹn/tương tác/test — mọi thứ khác trên trang chỉ là hiển thị.",
    placement: "left",
  },
];

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
    <div className="rounded-xl sm:rounded-2xl border border-[#e8eef8] bg-white px-3 py-3 sm:px-4 sm:py-4">
      <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-[#8aa0ba]">{label}</p>
      <div className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-semibold text-[#12304a] break-words">{value}</div>
      {hint ? <div className="mt-1 text-[10px] sm:text-xs text-[#6e7f93]">{hint}</div> : null}
    </div>
  );
}

const LEAD_DETAIL_GUIDE_SECTIONS = [
  {
    title: "Mục tiêu trang này",
    items: [
      "Đây là hồ sơ CRM đầy đủ của một lead: liên hệ, lịch hẹn, tương tác, test đầu vào và trạng thái chuyển đổi.",
      "Trang này giúp CSO nhìn toàn bộ hành trình của lead trên một màn hình thay vì phải mở nhiều nơi.",
      "Khi cần biết bước tiếp theo nên làm gì, hãy nhìn theo trạng thái rồi tới hoạt động gần nhất.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách dùng nhanh",
    items: [
      "Xem trạng thái lead trước để biết lead đang ở khâu nào: mới, đang liên hệ, đã test hay đã ghi danh.",
      "Nhìn các khối lịch hẹn, tương tác và test đầu vào để biết việc mới nhất đã diễn ra là gì.",
      "Nếu lead đã chuyển thành học viên, dùng phần liên kết vận hành để đi sang hồ sơ thật của học viên hoặc phụ huynh.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý vận hành",
    items: [
      "Không nên đổi trạng thái chỉ để làm đẹp dashboard; mỗi lần đổi nên gắn với hành động thực tế đã hoàn thành.",
      "Lead đã có học viên liên kết thì phải tránh xử lý trùng giữa CRM và module học viên.",
      "Nếu lịch hẹn, test và ghi chú đang mâu thuẫn nhau, ưu tiên kiểm tra hoạt động mới nhất trước.",
    ],
    tone: "warning" as const,
  },
];

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser();
  const role = currentUser ? await getUserRole(currentUser.id) : null;
  if (!currentUser || !canView("leads", role)) notFound();

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
  if (!(await canAccessBranch(lead.branchId))) notFound();
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
    <div className="space-y-4 sm:space-y-6 pb-6 sm:pb-8">
      <PageGuide
        title="Guide chi tiết lead"
        summary="Giải thích nhanh cách đọc hành trình CRM của một lead và bước tiếp theo cần xử lý."
        sections={LEAD_DETAIL_GUIDE_SECTIONS}
        buttonLabel="Guide lead"
      />
      <section className="rounded-[24px] sm:rounded-[32px] border border-[#dbe7ff] bg-white px-4 py-4 sm:px-6 sm:py-6 md:px-8 shadow-[0_18px_42px_rgba(15,23,42,0.05)] sm:shadow-[0_24px_60px_rgba(15,23,42,0.06)]" data-tour="lead-header">
        <div className="flex flex-col gap-4 sm:gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2 sm:space-y-3">
            <Link href="/leads" className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-[#3b82f6] hover:underline">
              ← <span className="sm:hidden">CRM</span><span className="hidden sm:inline">Về CRM tuyển sinh</span>
            </Link>

            <div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.28em] sm:tracking-[0.32em] text-[#3da3ff]">Lead detail</p>
              <h1 className="mt-1.5 sm:mt-2 text-xl sm:text-2xl md:text-3xl lg:text-[40px] font-black tracking-tight text-[#12304a]">{lead.fullName}</h1>
              <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm md:text-base text-[#607186]">
                <span className="hidden sm:inline">Chi tiết hồ sơ tuyển sinh, phụ huynh, lịch hẹn, test đầu vào và trạng thái chuyển đổi được gom lại trên một màn dễ vận hành hơn.</span>
                <span className="sm:hidden">Hồ sơ CRM đầy đủ: lịch hẹn, test đầu vào và trạng thái</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <span className="rounded-full border border-[#cfe2ff] bg-[#f3f8ff] px-2.5 sm:px-3 py-1 text-[10px] sm:text-sm font-medium text-[#1f5fa8]">
                <span className="sm:hidden">Lead</span><span className="hidden sm:inline">Mã lead</span> {lead.leadCode}
              </span>
              {age !== null ? (
                <span className="rounded-full border border-[#dbe7ff] bg-white px-2.5 sm:px-3 py-1 text-[10px] sm:text-sm font-medium text-[#50657b]">
                  {age} tuổi
                </span>
              ) : null}
              {suggested ? (
                <span className="rounded-full border border-[#e9d5ff] bg-[#faf5ff] px-2.5 sm:px-3 py-1 text-[10px] sm:text-sm font-medium text-[#7c3aed]">
                  Gợi ý {suggested}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <SpotlightTour
              steps={LEAD_DETAIL_TOUR_STEPS.filter((step) => {
                if (!editable && step.target.includes("lead-status")) return false;
                return true;
              })}
            />
            <span className="rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[#12304a]">
              {LEAD_STATUS_LABEL[lead.status as keyof typeof LEAD_STATUS_LABEL] ?? lead.status}
            </span>
            {editable ? (
              <Link href={`/leads/${lead.id}/edit`} className="btn-ghost text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                <span className="sm:hidden">Sửa</span>
                <span className="hidden sm:inline">Sửa thông tin</span>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4" data-tour="lead-kpi">
        <div className="rounded-[20px] sm:rounded-[24px] border border-[#d8e7fb] bg-white px-3 py-3 sm:px-5 sm:py-4 shadow-sm">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.24em] sm:tracking-[0.26em] text-[#8aa0ba]">Lịch hẹn</p>
          <p className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-black text-[#12304a]">{lead.appointments.length}</p>
          <p className="mt-1 text-xs sm:text-sm text-[#6b7a8c] truncate">{latestAppointment ? formatDateTime(latestAppointment.scheduledAt) : "Chưa có lịch"}</p>
        </div>
        <div className="rounded-[20px] sm:rounded-[24px] border border-[#d8e7fb] bg-white px-3 py-3 sm:px-5 sm:py-4 shadow-sm">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.24em] sm:tracking-[0.26em] text-[#8aa0ba]">Tương tác</p>
          <p className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-black text-[#12304a]">{lead.interactions.length}</p>
          <p className="mt-1 text-xs sm:text-sm text-[#6b7a8c] truncate">{latestInteraction ? formatDateTime(latestInteraction.occurredAt) : "Chưa ghi nhận"}</p>
        </div>
        <div className="rounded-[20px] sm:rounded-[24px] border border-[#d8e7fb] bg-white px-3 py-3 sm:px-5 sm:py-4 shadow-sm">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.24em] sm:tracking-[0.26em] text-[#8aa0ba]">Test đầu vào</p>
          <p className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-black text-[#12304a]">{lead.placementTests.length}</p>
          <p className="mt-1 text-xs sm:text-sm text-[#6b7a8c] truncate">{latestPlacement ? formatDate(latestPlacement.testDate) : "Chưa test"}</p>
        </div>
        <div className="rounded-[20px] sm:rounded-[24px] border border-[#d8e7fb] bg-white px-3 py-3 sm:px-5 sm:py-4 shadow-sm">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.24em] sm:tracking-[0.26em] text-[#8aa0ba]"><span className="hidden sm:inline">Công nợ hiện tại</span><span className="sm:hidden">Công nợ</span></p>
          <p className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-black text-[#12304a]">{outstanding !== null ? `${outstanding.toLocaleString("vi-VN")}đ` : "0đ"}</p>
          <p className="mt-1 text-xs sm:text-sm text-[#6b7a8c] truncate">{lead.student ? <><span className="sm:hidden">Có HV</span><span className="hidden sm:inline">Đã có hồ sơ học viên</span></> : "Chưa chuyển đổi"}</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1.75fr)_360px]">
        <div className="space-y-4 sm:space-y-6">
          <section className="rounded-[22px] sm:rounded-[28px] border border-[#dbe7ff] bg-white p-4 sm:p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]" data-tour="lead-profile">
            <div className="flex flex-col gap-2 sm:gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-[#12304a]">Thông tin hồ sơ</h2>
                <p className="mt-1 text-xs sm:text-sm text-[#6b7a8c]">
                  <span className="hidden sm:inline">Gom lại phần liên hệ, nguồn lead và ghi chú ban đầu.</span>
                  <span className="sm:hidden">Liên hệ, nguồn và ghi chú</span>
                </p>
              </div>
            </div>

            <div className="mt-3 sm:mt-4 grid gap-3 sm:gap-4 md:grid-cols-2">
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
              <div className="mt-3 sm:mt-4 rounded-xl sm:rounded-2xl border border-[#e8eef8] bg-[#f8fbff] px-3 py-3 sm:px-4 sm:py-4">
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-[#8aa0ba]">Ghi chú CRM</p>
                <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm leading-5 sm:leading-6 text-[#51657a]">{lead.notes}</p>
              </div>
            ) : null}
          </section>

          <section className="rounded-[22px] sm:rounded-[28px] border border-[#dbe7ff] bg-white p-4 sm:p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]" data-tour="lead-links">
            <h2 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-[#12304a]">Liên kết vận hành</h2>
            <p className="mt-1 text-xs sm:text-sm text-[#6b7a8c]">
              <span className="hidden sm:inline">Phụ huynh, portal, học viên và lớp hiện tại nếu lead đã chuyển đổi.</span>
              <span className="sm:hidden">PH, portal, HV và lớp</span>
            </p>

            <div className="mt-3 sm:mt-4 grid gap-3 sm:gap-4 md:grid-cols-2">
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

          <section className="rounded-[22px] sm:rounded-[28px] border border-[#dbe7ff] bg-white p-4 sm:p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <h2 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-[#12304a]">Test đầu vào</h2>
            <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
              {lead.placementTests.length === 0 ? (
                <div className="rounded-xl sm:rounded-2xl border border-dashed border-[#dbe7ff] px-3 py-8 sm:px-4 sm:py-10 text-center text-xs sm:text-sm text-[#7b8ea5]">
                  Chưa có kết quả test đầu vào.
                </div>
              ) : (
                lead.placementTests.map((test) => (
                  <div key={test.id} className="rounded-[18px] sm:rounded-[22px] border border-[#e8eef8] bg-[#fcfdff] px-3 py-3 sm:px-4 sm:py-4">
                    <div className="flex flex-col gap-2 sm:gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm sm:text-base font-semibold text-[#12304a]">{formatDate(test.testDate)}</p>
                        <p className="mt-1 text-xs sm:text-sm text-[#6b7a8c]">{test.suggestedClass ?? "Chưa gợi ý lớp"}</p>
                      </div>
                      {test.result ? (
                        <span className="rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-medium text-[#235f9d]">
                          {test.result}
                        </span>
                      ) : null}
                    </div>
                    {test.notes ? <p className="mt-2 sm:mt-3 text-xs sm:text-sm leading-5 sm:leading-6 text-[#51657a]">{test.notes}</p> : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[22px] sm:rounded-[28px] border border-[#dbe7ff] bg-white p-4 sm:p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <h2 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-[#12304a]">Lịch hẹn</h2>
            <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
              {lead.appointments.length === 0 ? (
                <div className="rounded-xl sm:rounded-2xl border border-dashed border-[#dbe7ff] px-3 py-8 sm:px-4 sm:py-10 text-center text-xs sm:text-sm text-[#7b8ea5]">
                  Chưa có lịch hẹn nào.
                </div>
              ) : (
                lead.appointments.map((appointment) => (
                  <div key={appointment.id} className="flex flex-col gap-2 sm:gap-3 rounded-[18px] sm:rounded-[22px] border border-[#e8eef8] bg-[#fcfdff] px-3 py-3 sm:px-4 sm:py-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-semibold text-[#12304a]">{formatDateTime(appointment.scheduledAt)}</p>
                      {appointment.notes ? <p className="mt-1 text-xs sm:text-sm text-[#6b7a8c] truncate">{appointment.notes}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className={`rounded-full border px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-medium ${APPOINTMENT_STATUS_COLOR[appointment.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {APPOINTMENT_STATUS_LABEL[appointment.status] ?? appointment.status}
                      </span>
                      {editable ? <AppointmentStatusButtons appointmentId={appointment.id} status={appointment.status} /> : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[22px] sm:rounded-[28px] border border-[#dbe7ff] bg-white p-4 sm:p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <h2 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-[#12304a]">Lịch sử tương tác</h2>
            <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
              {lead.interactions.length === 0 ? (
                <div className="rounded-xl sm:rounded-2xl border border-dashed border-[#dbe7ff] px-3 py-8 sm:px-4 sm:py-10 text-center text-xs sm:text-sm text-[#7b8ea5]">
                  Chưa có tương tác nào.
                </div>
              ) : (
                lead.interactions.map((interaction) => (
                  <div key={interaction.id} className="rounded-[18px] sm:rounded-[22px] border border-[#e8eef8] bg-[#fcfdff] px-3 py-3 sm:px-4 sm:py-4">
                    <div className="flex flex-col gap-1.5 sm:gap-2 md:flex-row md:items-start md:justify-between">
                      <p className="text-sm sm:text-base font-semibold text-[#12304a]">{INTERACTION_LABEL[interaction.type] ?? interaction.type}</p>
                      <p className="text-xs sm:text-sm text-[#7b8ea5] whitespace-nowrap">{formatDateTime(interaction.occurredAt)}</p>
                    </div>
                    {interaction.content ? <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm leading-5 sm:leading-6 text-[#51657a]">{interaction.content}</p> : null}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4 sm:space-y-6">
          <section className="rounded-[22px] sm:rounded-[28px] border border-[#dbe7ff] bg-white p-4 sm:p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <h2 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-[#12304a]">Tóm tắt nhanh</h2>
            <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
              <div className="rounded-xl sm:rounded-2xl border border-[#e8eef8] bg-[#f8fbff] px-3 py-3 sm:px-4 sm:py-4">
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-[#8aa0ba]">Học viên hiện tại</p>
                <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-semibold text-[#12304a] break-words">
                  {lead.student ? lead.student.fullName : "Chưa chuyển đổi"}
                </p>
              </div>
              <div className="rounded-xl sm:rounded-2xl border border-[#e8eef8] bg-white px-3 py-3 sm:px-4 sm:py-4">
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-[#8aa0ba]">Lớp hiện tại</p>
                <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-semibold text-[#12304a] break-words">
                  {currentEnrollment?.class?.className ?? lead.interestedClass?.className ?? "Chưa gắn lớp"}
                </p>
              </div>
              <div className="rounded-xl sm:rounded-2xl border border-[#e8eef8] bg-white px-3 py-3 sm:px-4 sm:py-4">
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-[#8aa0ba]">Portal phụ huynh</p>
                <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-semibold text-[#12304a] break-all">
                  {linkedGuardian?.user?.email ?? "Chưa cấp"}
                </p>
              </div>
            </div>
          </section>

          {editable ? (
            <div data-tour="lead-status" className="space-y-4 sm:space-y-6">
              <LeadStatusPanel leadId={lead.id} status={lead.status} hasStudent={!!lead.student} />
              <LeadActivityForms leadId={lead.id} />
            </div>
          ) : (
            <section className="rounded-[22px] sm:rounded-[28px] border border-[#dbe7ff] bg-white p-4 sm:p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
              <p className="text-xs sm:text-sm leading-5 sm:leading-6 text-[#6b7a8c]">
                Vai trò hiện tại chỉ được xem chi tiết lead này. Không thể đổi trạng thái hoặc thêm hoạt động mới.
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
