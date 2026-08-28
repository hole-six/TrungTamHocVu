import { notFound } from "next/navigation";
import BackButton from "@/components/ui/BackButton";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate, canView } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import { computeOutstandingBalance } from "@/lib/server/balance";
import PageGuide from "@/components/ui/PageGuide";
import LeadDetailContent, { type LeadDetailData } from "@/components/leads/LeadDetailContent";

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
      "Tab \"Lịch hẹn & Test\" và \"Tương tác\" cho biết việc mới nhất đã diễn ra là gì.",
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

  const currentEnrollment = lead.student?.enrollments.find((e) => e.status === "ACTIVE") ?? lead.student?.enrollments[0] ?? null;
  const linkedGuardian = lead.student?.guardians[0]?.guardian ?? lead.guardian ?? null;
  const outstanding = lead.student ? await computeOutstandingBalance(lead.student.id) : null;

  // LeadDetailContent là client component dùng chung với LeadDetailDrawer (mở từ danh
  // sách lead) — cùng 1 nội dung/định dạng dữ liệu cho cả 2 nơi, tránh lặp lại JSX.
  const data: LeadDetailData = {
    lead: {
      id: lead.id,
      leadCode: lead.leadCode,
      fullName: lead.fullName,
      status: lead.status,
      dob: lead.dob ? lead.dob.toISOString() : null,
      phone: lead.phone,
      address: lead.address,
      source: lead.source,
      facebookParentName: lead.facebookParentName,
      facebookLink: lead.facebookLink,
      initialAssessment: lead.initialAssessment,
      notes: lead.notes,
      meetDate: lead.meetDate ? lead.meetDate.toISOString() : null,
      expectedStartDate: lead.expectedStartDate ? lead.expectedStartDate.toISOString() : null,
      guardian: lead.guardian
        ? {
            id: lead.guardian.id,
            fullName: lead.guardian.fullName,
            phone: lead.guardian.phone,
            user: lead.guardian.user ? { email: lead.guardian.user.email, isActive: lead.guardian.user.isActive } : null,
          }
        : null,
      interestedClass: lead.interestedClass ? { className: lead.interestedClass.className, classCode: lead.interestedClass.classCode } : null,
      interactions: lead.interactions.map((i) => ({ id: i.id, type: i.type, content: i.content, occurredAt: i.occurredAt.toISOString() })),
      appointments: lead.appointments.map((a) => ({ id: a.id, status: a.status, notes: a.notes, scheduledAt: a.scheduledAt.toISOString() })),
      placementTests: lead.placementTests.map((t) => ({
        id: t.id,
        testDate: t.testDate ? t.testDate.toISOString() : null,
        suggestedClass: t.suggestedClass,
        result: t.result,
        notes: t.notes,
      })),
      student: lead.student ? { id: lead.student.id, fullName: lead.student.fullName } : null,
    },
    editable,
    currentEnrollment: currentEnrollment
      ? { class: { className: currentEnrollment.class.className, tuitionPerSession: currentEnrollment.class.tuitionPerSession, totalSessions: currentEnrollment.class.totalSessions } }
      : null,
    linkedGuardian: linkedGuardian
      ? {
          id: linkedGuardian.id,
          fullName: linkedGuardian.fullName,
          phone: linkedGuardian.phone,
          user: linkedGuardian.user ? { email: linkedGuardian.user.email, isActive: linkedGuardian.user.isActive } : null,
        }
      : null,
    outstanding,
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-6 sm:pb-8">
      <PageGuide
        title="Guide chi tiết lead"
        summary="Giải thích nhanh cách đọc hành trình CRM của một lead và bước tiếp theo cần xử lý."
        sections={LEAD_DETAIL_GUIDE_SECTIONS}
        buttonLabel="Guide lead"
      />

      <BackButton href="/leads" className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-[#3b82f6] hover:underline">
        ← <span className="sm:hidden">CRM</span><span className="hidden sm:inline">Về CRM tuyển sinh</span>
      </BackButton>

      <LeadDetailContent data={data} />
    </div>
  );
}
