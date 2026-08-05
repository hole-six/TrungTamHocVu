"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getAppShellConfig } from "@/lib/app-shell";
import MobileBottomNav from "./MobileBottomNav";

type NavItem = {
  href: string;
  label: string;
  status: "live" | "planned";
};

type NavBadgeMap = Partial<Record<string, number>>;

const Icon = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
    </svg>
  ),
  leads: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  students: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
  classes: (
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
  tuition: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
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
  assets: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  menu: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  close: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
} as const;

const NAV_ICONS: Record<string, React.ReactNode> = {
  "/dashboard": Icon.dashboard,
  "/leads": Icon.leads,
  "/students": Icon.students,
  "/guardians": Icon.guardians,
  "/classes": Icon.classes,
  "/calendar": Icon.calendar,
  "/timesheets": Icon.timesheets,
  "/tuition": Icon.tuition,
  "/inventory": Icon.inventory,
  "/assets": Icon.assets,
  "/cashbook": Icon.cashbook,
  "/payroll": Icon.payroll,
  "/reports": Icon.reports,
  "/admin": Icon.admin,
};

function SidebarContent({
  pathname,
  onClose,
  navItems,
  navBadges,
  userRole,
  collapsed = false,
}: {
  pathname: string;
  onClose?: () => void;
  navItems: NavItem[];
  navBadges?: NavBadgeMap;
  userRole?: string;
  collapsed?: boolean;
}) {
  const itemsByHref = Object.fromEntries(navItems.map((item) => [item.href, item]));
  const shellConfig = getAppShellConfig(userRole);

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-white to-[#fafafa]">
      {/* Header */}
      <div className={`flex h-20 items-center ${collapsed ? "justify-center px-3" : "justify-between px-6"} border-b border-[#f1f5f9]`}>
        <Link href="/dashboard" className="flex items-center gap-3 group" onClick={onClose}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center transition-all">
            <Image
              src="/img/logoTACH.png"
              alt="TACH Logo"
              width={44}
              height={44}
              className="object-contain"
              priority
            />
          </div>
          {collapsed ? null : (
            <div>
              <span className="font-display text-xl font-black tracking-tight text-[#0f172a]">TACH</span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">ERP System</p>
            </div>
          )}
        </Link>
        {onClose ? (
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[#f1f5f9] transition-colors md:hidden">
            {Icon.close}
          </button>
        ) : null}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {shellConfig.navGroups.map((group) => {
          const items = group.hrefs.map((href) => itemsByHref[href]).filter(Boolean);
          if (items.length === 0) return null;

          return (
            <div key={group.label} className="mb-6">
              {collapsed ? (
                <div className="mx-auto mb-3 h-px w-8 bg-gradient-to-r from-transparent via-[#e2e8f0] to-transparent" />
              ) : (
                <p className="mb-3 px-3 text-[11px] font-black uppercase tracking-[0.12em] text-[#94a3b8]">{group.label}</p>
              )}
              <div className="space-y-1.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const badge = navBadges?.[item.href];
                  
                  if (collapsed) {
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        title={item.label}
                        className={`group relative flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200 ${
                          active 
                            ? "bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white shadow-lg shadow-primary/30" 
                            : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#f97316]"
                        }`}
                      >
                        {NAV_ICONS[item.href]}
                        {badge && badge > 0 ? (
                          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#ef4444] text-[9px] font-black text-white ring-2 ring-white">
                            {badge > 9 ? "9+" : badge}
                          </span>
                        ) : null}
                      </Link>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
                        active
                          ? "bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white shadow-md"
                          : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#f97316]"
                      }`}
                    >
                      <span className={`shrink-0 transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-110"}`}>
                        {NAV_ICONS[item.href]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{item.label}</span>
                      {badge && badge > 0 ? (
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black transition-colors ${
                            active ? "bg-white/25 text-white" : "bg-[#fff7ed] text-[#f97316]"
                          }`}
                        >
                          {badge > 99 ? "99+" : badge}
                        </span>
                      ) : null}
                      {item.status === "planned" ? (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            active ? "bg-white/20 text-white/80" : "bg-[#f1f5f9] text-[#94a3b8]"
                          }`}
                        >
                          Beta
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      {collapsed ? null : (
        <div className="border-t border-[#f1f5f9] px-6 py-4 bg-gradient-to-b from-transparent to-[#fafafa]">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-1 w-1 rounded-full bg-[#10b981] animate-pulse" />
            <p className="text-xs font-bold text-[#0f172a]">TACH ERP</p>
            <span className="ml-auto rounded-md bg-[#fff7ed] px-2 py-0.5 text-[9px] font-black text-[#f97316]">v0.1</span>
          </div>
          {userRole ? (
            <p className="text-[10px] font-semibold text-[#94a3b8]">Role: <span className="text-[#64748b]">{userRole}</span></p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  navItems,
  navBadges,
  userRole,
}: {
  navItems: NavItem[];
  navBadges?: NavBadgeMap;
  userRole?: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [peek, setPeek] = useState(false);

  return (
    <>
      {/* Mobile Header */}
      <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#f1f5f9] bg-white/95 backdrop-blur-xl px-5 shadow-sm md:hidden">
        <button 
          onClick={() => setMobileOpen(true)} 
          className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[#f8fafc] active:scale-95 transition-all" 
          aria-label="Mở menu"
        >
          {Icon.menu}
        </button>
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center transition-all">
            <Image
              src="/img/logoTACH.png"
              alt="TACH Logo"
              width={36}
              height={36}
              className="object-contain"
            />
          </div>
          <span className="font-display text-lg font-black text-[#0f172a]">TACH</span>
        </Link>
        <div className="w-11" />
      </div>

      {/* Mobile Overlay + Sidebar */}
      {mobileOpen ? (
        <>
          <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-80 shadow-2xl md:hidden animate-[slideIn_0.3s_ease-out]">
            <SidebarContent pathname={pathname} onClose={() => setMobileOpen(false)} navItems={navItems} navBadges={navBadges} userRole={userRole} />
          </div>
        </>
      ) : null}

      {/* Desktop Sidebar */}
      <aside
        onMouseEnter={() => setPeek(true)}
        onMouseLeave={() => setPeek(false)}
        className={`fixed inset-y-0 left-0 z-40 hidden border-r border-[#f1f5f9] bg-white transition-[width] duration-300 ease-in-out md:block ${
          peek ? "w-[280px] shadow-xl" : "w-20 shadow-sm"
        }`}
      >
        <SidebarContent pathname={pathname} navItems={navItems} navBadges={navBadges} userRole={userRole} collapsed={!peek} />
      </aside>

      {/* New Mobile Bottom Navigation */}
      <MobileBottomNav />
    </>
  );
}
