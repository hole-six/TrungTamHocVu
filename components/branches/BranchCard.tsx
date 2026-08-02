"use client";

import { Home, Phone, MapPin, Users, GraduationCap, Calendar, UserCircle } from "lucide-react";

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

export default function BranchCard({ branch }: { branch: Branch }) {
  const counts = branch._count;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border-2 bg-white transition-all duration-200 ${
        branch.isActive
          ? "border-[#e5e7eb] hover:border-[#f97316] hover:shadow-lg"
          : "border-[#e5e7eb] opacity-60"
      }`}
    >
      {/* Header with Icon & Name */}
      <div className="flex items-center gap-4 border-b border-[#f3f4f6] px-5 py-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl transition-all ${
            branch.isActive
              ? "bg-gradient-to-br from-[#f97316] to-[#ea580c] group-hover:shadow-lg group-hover:shadow-orange-500/30"
              : "bg-gradient-to-br from-gray-400 to-gray-500"
          }`}
        >
          <Home className="h-6 w-6 text-white" strokeWidth={2.5} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="truncate text-lg font-bold text-[#111827] group-hover:text-[#f97316] transition-colors">
            {branch.name}
          </h3>
          <p className="font-mono text-xs font-bold text-[#6b7280] tracking-wider">
            {branch.code}
          </p>
        </div>

        {/* Status Badge */}
        {branch.isActive ? (
          <div className="flex h-7 items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold text-emerald-700">Hoạt động</span>
          </div>
        ) : (
          <div className="flex h-7 items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-2.5">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-xs font-bold text-red-700">Tạm dừng</span>
          </div>
        )}
      </div>

      {/* Contact Info */}
      {(branch.phone || branch.address) && (
        <div className="space-y-2 border-b border-[#f3f4f6] px-5 py-4">
          {branch.phone && (
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                <Phone className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />
              </div>
              <span className="text-sm font-medium text-[#374151]">{branch.phone}</span>
            </div>
          )}

          {branch.address && (
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                <MapPin className="h-3.5 w-3.5 text-amber-600" strokeWidth={2.5} />
              </div>
              <span className="line-clamp-2 text-sm text-[#6b7280]">{branch.address}</span>
            </div>
          )}
        </div>
      )}

      {/* Stats Grid */}
      {counts && (
        <div className="grid grid-cols-2 gap-3 px-5 py-4">
          <div className="rounded-xl bg-[#f9fafb] px-3 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-3.5 w-3.5 text-blue-600" strokeWidth={2.5} />
              <span className="text-xs text-[#6b7280]">Nhân viên</span>
            </div>
            <p className="text-lg font-bold text-[#111827]">{counts.employees}</p>
          </div>

          <div className="rounded-xl bg-[#f9fafb] px-3 py-3">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="h-3.5 w-3.5 text-violet-600" strokeWidth={2.5} />
              <span className="text-xs text-[#6b7280]">Học viên</span>
            </div>
            <p className="text-lg font-bold text-[#111827]">{counts.students}</p>
          </div>

          <div className="rounded-xl bg-[#f9fafb] px-3 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />
              <span className="text-xs text-[#6b7280]">Lớp học</span>
            </div>
            <p className="text-lg font-bold text-[#111827]">{counts.classes}</p>
          </div>

          <div className="rounded-xl bg-[#f9fafb] px-3 py-3">
            <div className="flex items-center gap-2 mb-1">
              <UserCircle className="h-3.5 w-3.5 text-amber-600" strokeWidth={2.5} />
              <span className="text-xs text-[#6b7280]">Users</span>
            </div>
            <p className="text-lg font-bold text-[#111827]">{counts.users}</p>
          </div>
        </div>
      )}

      {/* Footer - Hover Action */}
      <div className="border-t border-[#f3f4f6] bg-[#fafafa] px-5 py-3 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#f97316]">
          <span>Nhấn để sửa</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </div>
  );
}
