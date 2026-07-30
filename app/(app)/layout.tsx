import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranches } from "@/lib/branch-filter";
import { getFilteredNavItems, getUserRole } from "@/lib/permissions";
import { NAV_ITEMS } from "@/lib/nav";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { branch: true, roleRef: true },
  });

  // Lấy danh sách branches cho selector
  const branches = await getAccessibleBranches();

  // Lấy role và filter nav items
  const userRole = await getUserRole(session.userId);
  const allowedRoutes = await getFilteredNavItems(session.userId);
  
  // Filter NAV_ITEMS based on user permissions
  const filteredNavItems = allowedRoutes === null 
    ? NAV_ITEMS 
    : NAV_ITEMS.filter(item => allowedRoutes.includes(item.href));

  return (
    <div className="min-h-screen">
      <Sidebar navItems={filteredNavItems} userRole={userRole || undefined} />
      <div className="md:pl-64">
        <Topbar 
          fullName={session.fullName} 
          branchName={user?.branch?.name}
          branches={branches}
        />
        <main className="mx-auto max-w-7xl px-6 py-8 pb-28 md:pb-8">{children}</main>
      </div>
    </div>
  );
}
