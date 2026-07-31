"use client";

import Link from "next/link";

type Guardian = {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  relationship?: string;
  notes?: string;
  _count?: {
    students: number;
  };
};

export default function GuardianCard({ guardian }: { guardian: Guardian }) {
  const studentCount = guardian._count?.students ?? 0;

  return (
    <Link
      href={`/guardians/${guardian.id}`}
      className="group card hover:shadow-xl hover:scale-[1.02] transition-all duration-200 hover:border-primary/30"
    >
      {/* Header with avatar and relationship */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-shadow">
            <span className="text-lg font-bold text-white">
              {guardian.fullName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-ink group-hover:text-primary transition-colors">
              {guardian.fullName}
            </h3>
            {guardian.relationship && (
              <span className="inline-flex items-center rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                {guardian.relationship}
              </span>
            )}
          </div>
        </div>

        {/* Student count badge */}
        <div className="flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
          <span className="text-xs font-bold text-violet-700">{studentCount} con</span>
        </div>
      </div>

      {/* Contact info */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </div>
          <span className="text-sm font-mono text-ink-muted64">{guardian.phone}</span>
        </div>

        {guardian.email && (
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <span className="text-sm text-ink-muted64 truncate">{guardian.email}</span>
          </div>
        )}

        {guardian.address && (
          <div className="flex items-start gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 shrink-0 mt-0.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <span className="text-xs text-ink-muted48 line-clamp-2 flex-1">{guardian.address}</span>
          </div>
        )}
      </div>

      {/* Notes preview */}
      {guardian.notes && (
        <div className="rounded-lg border border-[#e8edf5] bg-[#fafbff] p-3">
          <p className="text-xs text-ink-muted48 line-clamp-2">{guardian.notes}</p>
        </div>
      )}

      {/* Hover indicator */}
      <div className="mt-4 flex items-center justify-end">
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
