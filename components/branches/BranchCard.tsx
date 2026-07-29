"use client";

import Link from "next/link";

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
    <Link
      href={`/admin/branches/${branch.id}`}
      className={`group card hover:shadow-xl hover:scale-[1.02] transition-all duration-200 ${
        branch.isActive 
          ? "hover:border-primary/30" 
          : "opacity-60 hover:opacity-80"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-lg transition-shadow ${
            branch.isActive
              ? "bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-indigo-500/30 group-hover:shadow-indigo-500/50"
              : "bg-gradient-to-br from-gray-400 to-gray-500 shadow-gray-400/30"
          }`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-display text-base font-bold text-ink group-hover:text-primary transition-colors">
                {branch.name}
              </h3>
            </div>
            <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-mono font-bold text-indigo-700">
              {branch.code}
            </span>
          </div>
        </div>

        {/* Status badge */}
        {branch.isActive ? (
          <span className="inline-flex items-center gap-1 rounded-lg border-2 border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
            <span>✅</span>
            Hoạt động
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-lg border-2 border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
            <span>⏸️</span>
            Tạm ngưng
          </span>
        )}
      </div>

      {/* Contact info */}
      <div className="space-y-2 mb-4">
        {branch.phone && (
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <span className="text-sm font-mono text-ink-muted64">{branch.phone}</span>
          </div>
        )}

        {branch.address && (
          <div className="flex items-start gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 shrink-0 mt-0.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <span className="text-xs text-ink-muted48 line-clamp-2 flex-1">{branch.address}</span>
          </div>
        )}
      </div>

      {/* Statistics */}
      {counts && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-lg border border-[#e8edf5] bg-white p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
              <p className="text-xs text-ink-muted48">Nhân viên</p>
            </div>
            <p className="text-sm font-bold text-ink">{counts.employees}</p>
          </div>

          <div className="rounded-lg border border-[#e8edf5] bg-white p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
              <p className="text-xs text-ink-muted48">Học viên</p>
            </div>
            <p className="text-sm font-bold text-ink">{counts.students}</p>
          </div>

          <div className="rounded-lg border border-[#e8edf5] bg-white p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <p className="text-xs text-ink-muted48">Lớp học</p>
            </div>
            <p className="text-sm font-bold text-ink">{counts.classes}</p>
          </div>

          <div className="rounded-lg border border-[#e8edf5] bg-white p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <p className="text-xs text-ink-muted48">Users</p>
            </div>
            <p className="text-sm font-bold text-ink">{counts.users}</p>
          </div>
        </div>
      )}

      {/* Hover indicator */}
      <div className="mt-3 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs font-semibold text-primary flex items-center gap-1">
          Xem chi tiết
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </span>
      </div>
    </Link>
  );
}
