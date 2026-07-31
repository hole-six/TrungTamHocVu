import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import BranchForm from "@/components/branches/BranchForm";

export const metadata: Metadata = {
  title: "Thêm cơ sở mới",
};

export default async function NewBranchPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  // Lấy organization đầu tiên (hoặc tạo mới nếu chưa có)
  let organization = await prisma.organization.findFirst();
  
  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: "Tổ chức mặc định",
      },
    });
  }

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
            Thêm cơ sở mới
          </h1>
          <p className="text-sm text-ink-muted48">
            Tạo chi nhánh / cơ sở mới trong hệ thống
          </p>
        </div>
      </div>

      <BranchForm organizationId={organization.id} mode="create" />
    </div>
  );
}
