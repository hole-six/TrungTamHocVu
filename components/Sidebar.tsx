"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getAppShellConfig } from "@/lib/app-shell";

type NavItem = {
  href: string;
  label: string;
  status: "live" | "planned";
};

const Icon = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  leads: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  students: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
  classes: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  timesheets: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  tuition: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  inventory: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  cashbook: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  payroll: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  reports: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  admin: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 0-14.14 0M4.93 19.07a10 10 0 0 0 14.14 0" />
    </svg>
  ),
  guardians: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  calendar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <circle cx="8" cy="14" r="1" fill="currentColor" />
      <circle cx="12" cy="14" r="1" fill="currentColor" />
    </svg>
  ),
  assets: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  menu: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  close: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  userRole,
}: {
  pathname: string;
  onClose?: () => void;
  navItems: NavItem[];
  userRole?: string;
}) {
  const itemsByHref = Object.fromEntries(navItems.map((item) => [item.href, item]));
  const shellConfig = getAppShellConfig(userRole);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-[#eef1f8] px-5">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary shadow-sm shadow-primary/30">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <span className="font-display text-[15px] font-bold tracking-tight text-ink">TACH</span>
        </Link>
        {onClose ? (
          <button onClick={onClose} className="btn-icon md:hidden">
            {Icon.close}
          </button>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3">
        {shellConfig.navGroups.map((group) => {
          const items = group.hrefs.map((href) => itemsByHref[href]).filter(Boolean);
          if (items.length === 0) return null;

          return (
            <div key={group.label}>
              <p className="nav-group-label">{group.label}</p>
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={active ? "nav-item-active" : "nav-item-inactive"}
                  >
                    <span className={`shrink-0 ${active ? "opacity-100" : "opacity-60"}`}>{NAV_ICONS[item.href]}</span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.status === "planned" ? (
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
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
          );
        })}
      </nav>

      <div className="border-t border-[#eef1f8] px-4 py-3">
        <p className="text-xs font-medium text-[#94a3b8]">TACH ERP · v0.1 alpha</p>
        {userRole ? <p className="mt-1 text-[10px] text-[#cbd5e1]">Role: {userRole}</p> : null}
      </div>
    </div>
  );
}

function MobilePrimaryNav({
  pathname,
  navItems,
  userRole,
}: {
  pathname: string;
  navItems: NavItem[];
  userRole?: string;
}) {
  const shellConfig = getAppShellConfig(userRole);
  const itemsByHref = Object.fromEntries(navItems.map((item) => [item.href, item]));
  const mobileItems = shellConfig.mobilePrimaryRoutes.map((href) => itemsByHref[href]).filter(Boolean);

  if (mobileItems.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8eef9] bg-white/95 px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0px)] shadow-[0_-12px_32px_-24px_rgba(15,23,42,0.45)] backdrop-blur md:hidden">
      <div className="grid grid-cols-5 gap-1">
        {mobileItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center transition ${
                active ? "bg-primary/10 text-primary" : "text-ink-muted48"
              }`}
            >
              <span className={active ? "opacity-100" : "opacity-70"}>{NAV_ICONS[item.href]}</span>
              <span className="text-[10px] font-semibold leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function Sidebar({
  navItems,
  userRole,
}: {
  navItems: NavItem[];
  userRole?: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#eef1f8] bg-white px-4 shadow-sm md:hidden">
        <button onClick={() => setMobileOpen(true)} className="btn-icon" aria-label="Mở menu">
          {Icon.menu}
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            </svg>
          </div>
          <span className="font-display text-sm font-bold text-ink">TACH</span>
        </Link>
        <div className="w-9" />
      </div>

      {mobileOpen ? (
        <>
          <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl md:hidden">
            <SidebarContent pathname={pathname} onClose={() => setMobileOpen(false)} navItems={navItems} userRole={userRole} />
          </div>
        </>
      ) : null}

      <aside className="fixed inset-y-0 left-0 hidden w-[260px] border-r border-[#eef1f8] bg-white shadow-sm md:block">
        <SidebarContent pathname={pathname} navItems={navItems} userRole={userRole} />
      </aside>

      <MobilePrimaryNav pathname={pathname} navItems={navItems} userRole={userRole} />
    </>
  );
}
