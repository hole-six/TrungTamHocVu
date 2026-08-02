import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBranchId } from "@/lib/branch-filter";
import LeadForm from "@/components/leads/LeadForm";

export default async function NewLeadPage({ searchParams }: { searchParams: { returnTo?: string } }) {
  const returnTo = searchParams.returnTo && searchParams.returnTo.startsWith("/") ? searchParams.returnTo : null;
  const activeBranchId = await getCurrentBranchId();
  const classes = await prisma.class.findMany({
    where: { ...(activeBranchId ? { branchId: activeBranchId } : {}), status: "ACTIVE" },
    orderBy: [{ className: "asc" }],
    select: { id: true, classCode: true, className: true },
  });
  return (
    <div className="page-shell page-shell-form">
      <div className="flex items-center gap-4">
        <Link
          href={returnTo ?? "/leads"}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-[#e8edf5] hover:bg-[#f8fafc] transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ink"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Thêm lead mới</h1>
          <p className="page-subtitle">Tạo hồ sơ học viên tiềm năng vào hệ thống CRM</p>
        </div>
      </div>

      <div className="card">
        <LeadForm redirectTo={returnTo ?? undefined} classes={classes} />
      </div>
    </div>
  );
}
