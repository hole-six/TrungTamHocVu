import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranches } from "@/lib/branch-filter";
import BranchesPageClient from "@/components/branches/BranchesPageClient";

export const metadata: Metadata = {
  title: "Quản lý cơ sở",
};

export default async function BranchesPage({
  searchParams,
}: {
  searchParams?: { create?: string; edit?: string };
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Kiểm tra quyền admin
  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const branches = await getAccessibleBranches();
  const organization = await prisma.organization.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const totalStudents = branches.reduce((sum, b) => sum + (b._count?.students || 0), 0);
  const totalEmployees = branches.reduce((sum, b) => sum + (b._count?.employees || 0), 0);
  const activeBranches = branches.filter((b) => b.isActive).length;

  const createOpen = searchParams?.create === "1";
  const editId = searchParams?.edit;
  const editBranch = editId ? branches.find((b) => b.id === editId) : undefined;

  return (
    <BranchesPageClient
      branches={branches}
      totalStudents={totalStudents}
      totalEmployees={totalEmployees}
      activeBranches={activeBranches}
      organizationId={organization?.id ?? ""}
      initialCreateOpen={createOpen}
      initialEditBranch={editBranch}
    />
  );
}
