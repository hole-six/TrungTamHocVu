"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const Icon = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
    </svg>
  ),
  students: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
  classes: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  tuition: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  leads: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  home: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  close: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  guardians: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  calendar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  timesheets: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  inventory: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  cashbook: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  payroll: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  reports: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  admin: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 0-14.14 0M4.93 19.07a10 10 0 0 0 14.14 0" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: Icon.dashboard, color: "from-blue-500 to-blue-600" },
  { href: "/students", label: "Học viên", icon: Icon.students, color: "from-emerald-500 to-emerald-600" },
  { href: "/classes", label: "Lớp học", icon: Icon.classes, color: "from-violet-500 to-violet-600" },
  { href: "/leads", label: "CRM", icon: Icon.leads, color: "from-sky-500 to-sky-600" },
  { href: "/calendar", label: "Lịch", icon: Icon.calendar, color: "from-pink-500 to-pink-600" },
  { href: "/tuition", label: "Học phí", icon: Icon.tuition, color: "from-amber-500 to-amber-600" },
  { href: "/inventory", label: "Tài liệu", icon: Icon.inventory, color: "from-teal-500 to-teal-600" },
  { href: "/cashbook", label: "Sổ quỹ", icon: Icon.cashbook, color: "from-rose-500 to-rose-600" },
  { href: "/employees", label: "Nhân sự", icon: Icon.payroll, color: "from-indigo-500 to-indigo-600" },
  { href: "/payroll", label: "Lương", icon: Icon.payroll, color: "from-purple-500 to-purple-600" },
  { href: "/timesheets", label: "Chấm công", icon: Icon.timesheets, color: "from-cyan-500 to-cyan-600" },
  { href: "/reports", label: "Báo cáo", icon: Icon.reports, color: "from-orange-500 to-orange-600" },
  { href: "/admin", label: "Admin", icon: Icon.admin, color: "from-slate-600 to-slate-700" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu when route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const primaryItems = [
    { href: "/students", label: "Học viên", icon: Icon.students },
    { href: "/classes", label: "Lớp học", icon: Icon.classes },
    { href: "/tuition", label: "Học phí", icon: Icon.tuition },
    { href: "/leads", label: "CRM", icon: Icon.leads },
  ];

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        {/* Main Nav Bar */}
        <div className="relative bg-white/95 backdrop-blur-xl border-t border-[#e2e8f0] px-3 pt-2 pb-[max(env(safe-area-inset-bottom),8px)] shadow-[0_-8px_32px_-8px_rgba(15,23,42,0.12)]">
          <div className="grid grid-cols-5 items-center gap-1">
            {/* Left Items */}
            {primaryItems.slice(0, 2).map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 transition-all duration-200 active:scale-95 ${
                    active 
                      ? "text-primary" 
                      : "text-[#94a3b8] active:text-primary"
                  }`}
                >
                  <span className={`transition-transform duration-200 ${active ? "scale-110" : ""}`}>
                    {item.icon}
                  </span>
                  <span className={`text-[10px] font-bold leading-tight ${active ? "text-primary" : "text-[#64748b]"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}

            {/* Center Home Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`relative flex h-16 w-16 -mt-8 items-center justify-center rounded-[24px] shadow-[0_8px_32px_-4px_rgba(249,115,22,0.4)] transition-all duration-300 active:scale-95 ${
                menuOpen
                  ? "bg-gradient-to-br from-slate-700 to-slate-800 rotate-0"
                  : "bg-gradient-to-br from-primary to-[#ea580c] hover:shadow-[0_12px_40px_-4px_rgba(249,115,22,0.5)]"
              }`}
            >
              <div className={`transition-all duration-300 ${menuOpen ? "rotate-90 scale-110" : "rotate-0"}`}>
                {menuOpen ? (
                  <span className="text-white">{Icon.close}</span>
                ) : (
                  <span className="text-white">{Icon.home}</span>
                )}
              </div>
              
              {/* Ripple effect when closed */}
              {!menuOpen && (
                <div className="absolute inset-0 rounded-[24px] bg-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
              )}
            </button>

            {/* Right Items */}
            {primaryItems.slice(2, 4).map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 transition-all duration-200 active:scale-95 ${
                    active 
                      ? "text-primary" 
                      : "text-[#94a3b8] active:text-primary"
                  }`}
                >
                  <span className={`transition-transform duration-200 ${active ? "scale-110" : ""}`}>
                    {item.icon}
                  </span>
                  <span className={`text-[10px] font-bold leading-tight ${active ? "text-primary" : "text-[#64748b]"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Full Menu Overlay */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out] md:hidden"
            onClick={() => setMenuOpen(false)}
          />
          
          {/* Menu Content */}
          <div className="fixed inset-x-4 bottom-24 z-50 max-h-[70vh] overflow-y-auto rounded-[32px] bg-gradient-to-br from-white via-white to-[#fafafa] p-6 shadow-[0_24px_80px_-12px_rgba(15,23,42,0.3)] animate-[slideUp_0.3s_ease-out] md:hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-[#0f172a]">Menu điều hướng</h3>
                <p className="mt-1 text-xs font-semibold text-[#94a3b8]">Chọn trang bạn muốn đến</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/5">
                <span className="text-xs font-black text-primary">{NAV_ITEMS.length}</span>
              </div>
            </div>

            {/* Grid of all navigation items */}
            <div className="grid grid-cols-3 gap-3">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative flex flex-col items-center justify-center gap-3 rounded-[20px] border-2 p-4 transition-all duration-200 active:scale-95 ${
                      active
                        ? "border-primary/30 bg-gradient-to-br from-[#fff7ed] to-[#ffedd5] shadow-lg shadow-primary/10"
                        : "border-transparent bg-gradient-to-br from-[#f8fafc] to-white hover:border-primary/20 hover:shadow-md"
                    }`}
                  >
                    {/* Icon with gradient background */}
                    <div className={`flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br transition-transform duration-200 group-active:scale-90 ${
                      active 
                        ? item.color + " text-white shadow-lg" 
                        : "from-[#f1f5f9] to-[#e2e8f0] text-[#64748b] group-hover:from-primary/10 group-hover:to-primary/5 group-hover:text-primary"
                    }`}>
                      {item.icon}
                    </div>
                    
                    {/* Label */}
                    <span className={`text-center text-[11px] font-bold leading-tight transition-colors ${
                      active ? "text-primary" : "text-[#64748b] group-hover:text-[#0f172a]"
                    }`}>
                      {item.label}
                    </span>

                    {/* Active indicator */}
                    {active && (
                      <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#ea580c] shadow-lg">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Footer info */}
            <div className="mt-6 rounded-2xl border border-[#e2e8f0] bg-gradient-to-br from-[#f8fafc] to-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#ea580c]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black text-[#0f172a]">TACH ERP System</p>
                  <p className="text-[10px] font-semibold text-[#94a3b8]">Quản lý trung tâm toàn diện</p>
                </div>
                <span className="rounded-lg bg-gradient-to-br from-[#fff7ed] to-[#ffedd5] px-3 py-1.5 text-[10px] font-black text-primary">v0.1</span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
