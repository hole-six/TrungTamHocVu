import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import BranchForm from "@/components/branches/BranchForm";

export const metadata: Metadata = {
  title: "Sửa cơ sở",
};

export default async function EditBranchPage({ params }: { params: { id: string } }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const branch = await prisma.branch.findUnique({ where: { id: params.id } });
  if (!branch) notFound();

  return (
    <div className="page-shell page-shell-form">
      <div className="flex items-center gap-3">
        <a
          href="/admin/branches"
          className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#e8edf5] bg-white transition-all hover:border-primary/50 hover:shadow-md"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </a>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Sửa cơ sở
          </h1>
          <p className="text-sm text-ink-muted48">
            {branch.name} · {branch.code}
          </p>
        </div>
      </div>

      <BranchForm
        organizationId={branch.organizationId}
        mode="edit"
        branch={{
          id: branch.id,
          code: branch.code,
          name: branch.name,
          address: branch.address ?? "",
          phone: branch.phone ?? "",
          isActive: branch.isActive,
        }}
      />
    </div>
  );
}
