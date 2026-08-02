"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BranchCard from "./BranchCard";
import BranchDrawer from "./BranchDrawer";

type Branch = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
  _count?: {
    users: number;
    employees: number;
    students: number;
    classes: number;
  };
};

type Props = {
  branches: Branch[];
  totalStudents: number;
  totalEmployees: number;
  activeBranches: number;
  organizationId: string;
  initialCreateOpen?: boolean;
  initialEditBranch?: Branch;
};

export default function BranchesPageClient({
  branches,
  totalStudents,
  totalEmployees,
  activeBranches,
  organizationId,
  initialCreateOpen = false,
  initialEditBranch,
}: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(initialCreateOpen);
  const [editBranch, setEditBranch] = useState<Branch | undefined>(initialEditBranch);

  function handleCreateClick() {
    setCreateOpen(true);
    router.push("/admin/branches?create=1", { scroll: false });
  }

  function handleEditClick(branch: Branch) {
    setEditBranch(branch);
    router.push(`/admin/branches?edit=${branch.id}`, { scroll: false });
  }

  function handleCloseDrawer() {
    setCreateOpen(false);
    setEditBranch(undefined);
    router.push("/admin/branches", { scroll: false });
  }

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Quản lý cơ sở</h1>
            <p className="mt-1 text-sm text-ink-muted48">Danh sách chi nhánh và địa điểm</p>
          </div>
          <button onClick={handleCreateClick} className="btn-primary">
            + Thêm cơ sở
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border-2 border-[#e5e7eb] bg-white px-4 py-3">
            <p className="text-xs text-[#9ca3af]">Tổng cơ sở</p>
            <p className="mt-1 text-2xl font-bold text-[#111827]">{branches.length}</p>
          </div>

          <div className="rounded-xl border-2 border-[#e5e7eb] bg-white px-4 py-3">
            <p className="text-xs text-[#9ca3af]">Hoạt động</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{activeBranches}</p>
          </div>

          <div className="rounded-xl border-2 border-[#e5e7eb] bg-white px-4 py-3">
            <p className="text-xs text-[#9ca3af]">Học viên</p>
            <p className="mt-1 text-2xl font-bold text-violet-600">{totalStudents}</p>
          </div>

          <div className="rounded-xl border-2 border-[#e5e7eb] bg-white px-4 py-3">
            <p className="text-xs text-[#9ca3af]">Nhân viên</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{totalEmployees}</p>
          </div>
        </div>

        {/* Branch List */}
        {branches.length === 0 ? (
          <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white px-6 py-12 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-100">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
              </div>
            </div>
            <h3 className="mb-2 text-lg font-bold text-ink">Chưa có cơ sở nào</h3>
            <p className="mb-6 text-sm text-ink-muted48">Tạo cơ sở đầu tiên để bắt đầu</p>
            <button onClick={handleCreateClick} className="btn-primary inline-flex">
              + Thêm cơ sở
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {branches.map((branch) => (
              <div key={branch.id} onClick={() => handleEditClick(branch)} className="cursor-pointer">
                <BranchCard branch={branch} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drawers */}
      <BranchDrawer
        mode="create"
        isOpen={createOpen}
        onClose={handleCloseDrawer}
        organizationId={organizationId}
      />

      {editBranch && (
        <BranchDrawer
          mode="edit"
          branch={{
            id: editBranch.id,
            code: editBranch.code,
            name: editBranch.name,
            address: editBranch.address ?? "",
            phone: editBranch.phone ?? "",
            isActive: editBranch.isActive,
          }}
          isOpen={!!editBranch}
          onClose={handleCloseDrawer}
        />
      )}
    </>
  );
}
