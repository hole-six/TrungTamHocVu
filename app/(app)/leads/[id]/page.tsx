import { notFound } from "next/navigation";
import BackButton from "@/components/ui/BackButton";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canDelete, canUpdate, canView } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import { getCurrentBranchId } from "@/lib/branch-filter";
import LeadDetailContent, { type LeadDetailData } from "@/components/leads/LeadDetailContent";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser();
  const role = currentUser ? await getUserRole(currentUser.id) : null;
  if (!currentUser || !canView("leads", role)) notFound();

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      guardian: true,
      interestedClass: true,
      interactions: { orderBy: { occurredAt: "desc" }, take: 10 },
      placementTests: { orderBy: { createdAt: "desc" } },
      student: { select: { id: true, fullName: true } },
    },
  });
  if (!lead) notFound();
  if (!(await canAccessBranch(lead.branchId))) notFound();

  const activeBranchId = await getCurrentBranchId();
  const classOptions = await prisma.class.findMany({
    where: { ...(activeBranchId ? { branchId: activeBranchId } : {}), status: "ACTIVE" },
    select: { id: true, className: true },
    orderBy: { className: "asc" },
  });

  // LeadDetailContent dùng chung với LeadDetailDrawer (mở từ danh sách lead) — cùng 1
  // nội dung/định dạng dữ liệu cho cả 2 nơi, tránh lặp lại JSX.
  const data: LeadDetailData = {
    lead: {
      id: lead.id,
      leadCode: lead.leadCode,
      fullName: lead.fullName,
      status: lead.status,
      gender: lead.gender,
      dob: lead.dob ? lead.dob.toISOString() : null,
      currentSchoolGrade: lead.currentSchoolGrade,
      phone: lead.phone,
      secondaryPhone: lead.secondaryPhone,
      zaloContact: lead.zaloContact,
      address: lead.address,
      source: lead.source,
      facebookParentName: lead.facebookParentName,
      facebookLink: lead.facebookLink,
      initialAssessment: lead.initialAssessment,
      pendingRemedialSessions: lead.pendingRemedialSessions,
      notes: lead.notes,
      meetDate: lead.meetDate ? lead.meetDate.toISOString() : null,
      expectedStartDate: lead.expectedStartDate ? lead.expectedStartDate.toISOString() : null,
      actualEnrollDate: lead.actualEnrollDate ? lead.actualEnrollDate.toISOString() : null,
      interestedClassId: lead.interestedClassId,
      guardian: lead.guardian ? { id: lead.guardian.id, fullName: lead.guardian.fullName, phone: lead.guardian.phone } : null,
      interestedClass: lead.interestedClass ? { className: lead.interestedClass.className, classCode: lead.interestedClass.classCode } : null,
      interactions: lead.interactions.map((i) => ({ id: i.id, type: i.type, content: i.content, occurredAt: i.occurredAt.toISOString() })),
      placementTests: lead.placementTests.map((t) => ({
        id: t.id,
        scheduledDate: t.scheduledDate ? t.scheduledDate.toISOString() : null,
        testDate: t.testDate ? t.testDate.toISOString() : null,
        status: t.status,
        result: t.result,
      })),
      student: lead.student ? { id: lead.student.id, fullName: lead.student.fullName } : null,
    },
    editable: canUpdate("leads", role),
    deletable: canDelete("leads", role),
  };

  return (
    <div className="space-y-4 pb-8">
      <BackButton href="/leads" className="inline-flex items-center gap-2 text-sm font-medium text-[#3b82f6] hover:underline">
        ← Về CRM tuyển sinh
      </BackButton>
      <h1 className="text-xl font-black tracking-tight text-[#0f1729]">{lead.fullName}</h1>
      <LeadDetailContent data={data} classOptions={classOptions} />
    </div>
  );
}
