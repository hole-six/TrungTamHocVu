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
      const currentEnrollment = sg.student.enrollments.find((e) => e.status === "ACTIVE") ?? sg.student.enrollments[0] ?? null;
      const outstanding = await computeOutstandingBalance(sg.student.id);
      return { ...sg, currentEnrollment, outstanding };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/guardians" className="text-sm text-primary">
          ← Quay lại Phụ huynh
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{guardian.fullName}</h1>
        <p className="mt-1 text-sm text-ink-muted48">
          {guardian.phone ?? "Chưa có SĐT"}
          {guardian.user ? (
            <span>
              {" · "}Portal: <strong>{guardian.user.email}</strong>
            </span>
          ) : null}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Tổng quan vận hành</h2>
            <dl className="mt-3 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              <div>
                <dt className="text-ink-muted48">Portal phụ huynh</dt>
                <dd className="mt-1 font-medium">{guardian.user?.email ?? "Chưa cấp tài khoản"}</dd>
                <p className="mt-1 text-xs text-ink-muted48">
                  {guardian.user ? (guardian.user.isActive ? "Đang hoạt động" : "Đã thu hồi") : "Nên cấp để xem nhật ký lớp và nhận reminder."}
                </p>
              </div>
              <div>
                <dt className="text-ink-muted48">Vai trò kinh doanh</dt>
                <dd className="mt-1 font-medium">Đầu mối nhận hóa đơn, nhắc học phí và theo dõi học tập cho con.</dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Lead liên quan</h2>
            <div className="mt-3 space-y-2">
              {guardian.leads.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2 text-sm">
                  <Link href={`/leads/${l.id}`} className="text-primary">
                    {l.fullName} · {l.leadCode}
                  </Link>
                  <span className="badge bg-ink/5 text-ink-muted80">{LEAD_STATUS_LABEL[l.status as keyof typeof LEAD_STATUS_LABEL] ?? l.status}</span>
                </div>
              ))}
              {guardian.leads.length === 0 && <p className="text-sm text-ink-muted48">Chưa có lead nào.</p>}
            </div>
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Học viên liên quan</h2>
            <div className="mt-3 space-y-2">
              {studentSummaries.map((sg) => (
                <div key={sg.id} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2 text-sm">
                  <div>
                    <Link href={`/students/${sg.student.id}`} className="text-primary">
                      {sg.student.fullName}
                    </Link>
                    <p className="mt-1 text-xs text-ink-muted48">
                      {sg.student.lead?.leadCode ?? "Không gắn lead"} · {sg.currentEnrollment?.class?.className ?? "Chưa có lớp"} · Công nợ{" "}
                      {sg.outstanding.toLocaleString("vi-VN")}đ
                    </p>
                  </div>
                  <span className="text-ink-muted48">{sg.relation ?? (sg.isPrimary ? "Chính" : "Phụ")}</span>
                </div>
              ))}
              {studentSummaries.length === 0 && <p className="text-sm text-ink-muted48">Chưa liên kết học viên nào.</p>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <GuardianEditForm
            guardianId={guardian.id}
            initial={{
              fullName: guardian.fullName,
              phone: guardian.phone ?? "",
              address: guardian.address ?? "",
              notes: guardian.notes ?? "",
            }}
          />
          {canManageAccount && (
            <GuardianAccountPanel
              guardianId={guardian.id}
              account={guardian.user ? { email: guardian.user.email, isActive: guardian.user.isActive } : null}
              defaultEmail=""
            />
          )}
        </div>
      </div>
    </div>
  );
}
