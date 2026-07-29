import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LeadStatusPanel from "@/components/leads/LeadStatusPanel";
import LeadActivityForms from "@/components/leads/LeadActivityForms";
import { LEAD_STATUS_LABEL, calculateAge, suggestGradeLevel } from "@/lib/server/lead-rules";

const INTERACTION_LABEL: Record<string, string> = {
  CALL: "Gọi điện",
  MEET: "Gặp trực tiếp",
  MESSAGE: "Nhắn tin",
  EMAIL: "Email",
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
      guardian: true,
      interactions: { orderBy: { occurredAt: "desc" } },
      appointments: { orderBy: { scheduledAt: "desc" } },
      placementTests: { orderBy: { testDate: "desc" } },
      student: true,
    },
  });
  if (!lead) notFound();

  const age = calculateAge(lead.dob);
  const suggested = suggestGradeLevel(age);

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
            <h2 className="font-display text-lg font-semibold tracking-tight">Thông tin liên hệ</h2>
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
                  <span>{formatDateTime(a.scheduledAt)}</span>
                  <span className="badge bg-ink/5 text-ink-muted80">{a.status}</span>
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
          <LeadStatusPanel leadId={lead.id} status={lead.status} hasStudent={!!lead.student} />
          <LeadActivityForms leadId={lead.id} />
        </div>
      </div>
    </div>
  );
}
