import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAccessibleBranches } from "@/lib/branch-filter";
import BranchCard from "@/components/branches/BranchCard";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Quản lý cơ sở",
};

export default async function BranchesPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/login");
  }

  // Kiểm tra quyền admin
  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const branches = await getAccessibleBranches();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Quản lý cơ sở
          </h1>
          <p className="text-sm text-ink-muted48 mt-1">
            Quản lý các chi nhánh / cơ sở trong hệ thống
          </p>
        </div>
        <Link href="/admin/branches/new" className="btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Thêm cơ sở mới
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              </svg>
            </div>
            <div>
              <p className="text-xs text-ink-muted48">Tổng cơ sở</p>
              <p className="text-2xl font-bold text-ink">{branches.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <p className="text-xs text-ink-muted48">Đang hoạt động</p>
              <p className="text-2xl font-bold text-ink">
                {branches.filter(b => b.isActive).length}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg shadow-violet-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              </svg>
            </div>
            <div>
              <p className="text-xs text-ink-muted48">Tổng học viên</p>
              <p className="text-2xl font-bold text-ink">
                {branches.reduce((sum, b) => sum + (b._count?.students || 0), 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <p className="text-xs text-ink-muted48">Tổng nhân viên</p>
              <p className="text-2xl font-bold text-ink">
                {branches.reduce((sum, b) => sum + (b._count?.employees || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Branch List */}
      {branches.length === 0 ? (
        <div className="card text-center py-12">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              </svg>
            </div>
          </div>
          <h3 className="font-display text-lg font-bold text-ink mb-2">
            Chưa có cơ sở nào
          </h3>
          <p className="text-sm text-ink-muted48 mb-4">
            Tạo cơ sở đầu tiên để bắt đầu quản lý hệ thống
          </p>
          <Link href="/admin/branches/new" className="btn-primary inline-flex">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Thêm cơ sở mới
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <BranchCard key={branch.id} branch={branch} />
          ))}
        </div>
      )}
    </div>
  );
}
