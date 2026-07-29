"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Branch = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

export default function BranchSelector({ 
  branches, 
  currentBranchId 
}: { 
  branches: Branch[];
  currentBranchId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  
  const currentBranch = branches.find(b => b.id === currentBranchId) || branches[0];
  const activeBranches = branches.filter(b => b.isActive);

  function selectBranch(branchId: string) {
    const params = new URLSearchParams(searchParams);
    params.set("branchId", branchId);
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-branch-selector]")) {
        setOpen(false);
      }
    }
    
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  if (branches.length === 0) {
    return null;
  }

  return (
    <div className="relative" data-branch-selector>
      {/* Current selection button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border-2 border-[#e8edf5] bg-white px-4 py-2.5 transition-all hover:border-primary/50 hover:shadow-md"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <div className="text-left">
          <p className="text-xs text-ink-muted48">Cơ sở</p>
          <p className="text-sm font-bold text-ink flex items-center gap-1.5">
            <span className="font-mono text-xs text-primary">[{currentBranch.code}]</span>
            {currentBranch.name}
          </p>
        </div>
        <svg 
          width="14" 
          height="14" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border border-[#e8edf5] bg-white shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="border-b border-[#e8edf5] bg-gradient-to-r from-[#fafbff] to-white px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted48">
              Chọn cơ sở ({activeBranches.length})
            </p>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {activeBranches.map((branch) => {
              const isSelected = branch.id === currentBranch.id;
              
              return (
                <button
                  key={branch.id}
                  onClick={() => selectBranch(branch.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-all hover:bg-primary/5 ${
                    isSelected ? "bg-primary/10" : ""
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${
                    isSelected 
                      ? "bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-md shadow-indigo-500/30"
                      : "bg-gradient-to-br from-gray-200 to-gray-300"
                  }`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isSelected ? "white" : "#64748b"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                  </div>
                  
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-bold ${isSelected ? "text-primary" : "text-ink"}`}>
                      {branch.name}
                    </p>
                    <p className={`text-xs font-mono ${isSelected ? "text-primary/70" : "text-ink-muted48"}`}>
                      {branch.code}
                    </p>
                  </div>

                  {isSelected && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer - View all branches */}
          <div className="border-t border-[#e8edf5] bg-gradient-to-r from-[#fafbff] to-white px-4 py-2">
            <button
              onClick={() => {
                router.push("/admin/branches");
                setOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              Quản lý tất cả cơ sở
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
