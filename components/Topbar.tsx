"use client";

import LogoutButton from "./LogoutButton";
import BranchSelector from "./branches/BranchSelector";
import NotificationBell from "./NotificationBell";

type Branch = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

export default function Topbar({
  fullName,
  branchName,
  branches = [],
  currentBranchId,
}: {
  fullName: string;
  branchName?: string;
  branches?: Branch[];
  currentBranchId?: string;
}) {
  const initials = fullName
    .split(" ")
    .slice(-2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 hidden md:flex h-16 items-center justify-between
                       border-b border-[#eef1f8] bg-white/90 px-6 backdrop-blur-md shadow-sm">
      {/* Branch selector (if multiple branches available) */}
      <div className="flex items-center gap-2">
        {branches.length > 1 ? (
          <BranchSelector 
            branches={branches} 
            currentBranchId={currentBranchId}
          />
        ) : branchName ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e8f0]
                           bg-[#f8fafc] px-3 py-1.5 text-xs font-semibold text-ink-muted80 shadow-sm">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            {branchName}
          </span>
        ) : (
          <span className="text-xs text-ink-muted48">—</span>
        )}
      </div>

      {/* Right: notifications + user + logout */}
      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="h-5 w-px bg-[#e2e8f0]" />
        {/* Avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full
                        bg-gradient-to-br from-primary to-primary-focus
                        text-[11px] font-bold text-white shadow-sm">
          {initials}
        </div>
        <div className="hidden sm:block">
          <p className="text-xs text-ink-muted48 leading-none">Xin chào</p>
          <p className="text-sm font-semibold text-ink leading-tight mt-0.5">{fullName}</p>
        </div>
        <div className="h-5 w-px bg-[#e2e8f0]" />
        <LogoutButton />
      </div>
    </header>
  );
}
