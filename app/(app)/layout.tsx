import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranches, getCurrentBranchId } from "@/lib/branch-filter";
import { getFilteredNavItems, getUserRole } from "@/lib/permissions";
import { NAV_ITEMS } from "@/lib/nav";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { AppLayoutClient } from "@/components/layout/AppLayoutClient";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

async function getNavBadges(
  user: { branchId: string | null; employeeId?: string | null } | null,
  role: string | null,
  activeBranchId: string | null,
) {
  const branchWhere = activeBranchId ? { branchId: activeBranchId } : {};
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  const [openLeads, activeStudents, openSessionCredits, branchSessionsToday, mySessionsToday, openBillingPeriods, openPayrollRuns, notSubmittedTeacherTasks] = await Promise.all([
    prisma.lead.count({ where: { ...branchWhere, status: { notIn: ["ENROLLED", "LOST"] } } }),
    role !== "TEACHER" && role !== "TEACHING_ASSISTANT"
      ? prisma.student.findMany({
          where: { ...branchWhere, status: "ACTIVE" },
          select: {
            leadId: true,
            guardians: {
              select: {
                guardian: {
                  select: {
                    user: { select: { isActive: true } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.sessionCredit.count({
      where: {
        status: "AVAILABLE",
        origin: { in: ["ABSENCE", "PAID_CATCHUP"] },
        student: activeBranchId ? { branchId: activeBranchId } : {},
      },
    }),
    prisma.classSession.count({
      where: activeBranchId
        ? { class: { branchId: activeBranchId }, sessionDate: { gte: todayStart, lte: todayEnd } }
        : { sessionDate: { gte: todayStart, lte: todayEnd } },
    }),
    user?.employeeId
      ? prisma.sessionAssignment.count({
          where: {
            employeeId: user.employeeId,
            session: { sessionDate: { gte: todayStart, lte: todayEnd } },
          },
        })
      : Promise.resolve(0),
    prisma.billingPeriod.count({
      where: { ...branchWhere, status: { in: ["DRAFT", "GENERATED", "REVIEWED", "POSTED", "REOPENED"] } },
    }),
    prisma.payrollRun.count({
      where: { ...branchWhere, status: { in: ["DRAFT", "CALCULATED", "REVIEWED", "APPROVED", "REOPENED"] } },
    }),
    prisma.sessionRequirementCheck.count({
      where: { status: "NOT_SUBMITTED", employee: activeBranchId ? { branchId: activeBranchId } : {} },
    }),
  ]);

  const studentsWithoutPortal = activeStudents.filter((student) =>
    !student.guardians.some((item) => item.guardian.user?.isActive)
  ).length;

  const convertedStudentsWithoutPortal = activeStudents.filter(
    (student) => Boolean(student.leadId) && !student.guardians.some((item) => item.guardian.user?.isActive)
  ).length;

  return {
    "/leads": openLeads,
    "/students": studentsWithoutPortal,
    "/session-credits": openSessionCredits,
    "/guardians": convertedStudentsWithoutPortal,
    "/classes": branchSessionsToday,
    "/calendar": role === "TEACHER" || role === "TEACHING_ASSISTANT" ? mySessionsToday : branchSessionsToday,
    "/tuition": openBillingPeriods,
    "/payroll": openPayrollRuns,
    "/teacher-tasks": notSubmittedTeacherTasks,
  };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { branch: true, roleRef: true },
  });

  // Lấy danh sách branches cho selector
  const branches = await getAccessibleBranches();

  // Cơ sở đang xem (khác với cơ sở cố định của tài khoản — admin/quyền "all" có thể
  // đang duyệt tạm 1 cơ sở khác qua BranchSelector) — dùng chung cho Topbar lẫn badge Sidebar.
  const activeBranchId = await getCurrentBranchId();

  // Lấy role và filter nav items
  const userRole = await getUserRole(session.userId);
  const allowedRoutes = await getFilteredNavItems(session.userId);

  // Filter NAV_ITEMS based on user permissions
  const filteredNavItems = allowedRoutes === null
    ? NAV_ITEMS
    : NAV_ITEMS.filter(item => allowedRoutes.includes(item.href));
  const navBadges = await getNavBadges(user, userRole, activeBranchId);

  return (
    <AppLayoutClient>
      <div className="min-h-screen">
        <Sidebar navItems={filteredNavItems} navBadges={navBadges} userRole={userRole || undefined} />
        <div className="md:pl-20">
          <Topbar
            fullName={session.fullName}
            branchName={user?.branch?.name}
            branches={branches}
            currentBranchId={activeBranchId ?? undefined}
          />
          <main className="w-full px-6 py-8 pb-28 md:pb-8">{children}</main>
        </div>
      </div>
    </AppLayoutClient>
  );
}
