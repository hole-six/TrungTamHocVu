"use client";

import { formatVnd } from "@/lib/export-utils";

type StudentKPICardsProps = {
  dueNowAmount: number;
  nextDueChargePeriod?: string | null;
  totalPaid: number;
  tuitionPaid: number;
  outstanding: number;
  totalCharged: number;
  chargesCount: number;
  learningSnapshot?: {
    completedMainSessions: number;
    entitledMainSessions: number;
    remainingMainSessions: number;
  } | null;
  attendanceStats: {
    present: number;
    absent: number;
    makeup: number;
  };
  portalEmail?: string | null;
  primaryGuardianName?: string | null;
  canViewFinance: boolean;
};

export default function StudentKPICards({
  dueNowAmount,
  nextDueChargePeriod,
  totalPaid,
  tuitionPaid,
  outstanding,
  totalCharged,
  chargesCount,
  learningSnapshot,
  attendanceStats,
  portalEmail,
  primaryGuardianName,
  canViewFinance,
}: StudentKPICardsProps) {
  const kpis = [
    // 1. Cần thu
    ...(canViewFinance ? [{
      key: "due",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
      ),
      iconBg: "bg-[#fef3c7]",
      iconColor: "text-[#f59e0b]",
      label: "Cần thu",
      labelColor: "text-[#92400e]",
      borderColor: "border-[#fbbf24]",
      value: formatVnd(dueNowAmount),
      valueColor: "text-[#111827]",
      subtitle: nextDueChargePeriod ? `Kỳ ${nextDueChargePeriod}` : "Không đến hạn",
      animate: "0ms",
    }] : []),
    
    // 2. Đã thu
    ...(canViewFinance ? [{
      key: "paid",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      ),
      iconBg: "bg-[#d1fae5]",
      iconColor: "text-[#059669]",
      label: "Đã thu",
      labelColor: "text-[#065f46]",
      borderColor: "border-[#10b981]",
      value: formatVnd(totalPaid),
      valueColor: "text-[#111827]",
      subtitle: `HP ${formatVnd(Math.round(tuitionPaid))}`,
      animate: "50ms",
    }] : []),
    
    // 3. Còn nợ
    ...(canViewFinance ? [{
      key: "outstanding",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
      ),
      iconBg: "bg-[#fee2e2]",
      iconColor: "text-[#dc2626]",
      label: "Còn nợ",
      labelColor: "text-[#991b1b]",
      borderColor: "border-[#ef4444]",
      value: formatVnd(outstanding),
      valueColor: outstanding > 0 ? "text-[#ef4444]" : "text-[#10b981]",
      subtitle: totalCharged > 0 ? `Đã lập ${formatVnd(totalCharged)} · ${chargesCount} kỳ` : "Chưa lập",
      animate: "100ms",
    }] : []),
    
    // 4. Tiến độ
    {
      key: "progress",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
      ),
      iconBg: "bg-[#dbeafe]",
      iconColor: "text-[#2563eb]",
      label: "Tiến độ",
      labelColor: "text-[#1e3a8a]",
      borderColor: "border-[#3b82f6]",
      value: learningSnapshot 
        ? `${learningSnapshot.completedMainSessions}/${learningSnapshot.entitledMainSessions}`
        : "—",
      valueColor: "text-[#111827]",
      subtitle: learningSnapshot 
        ? `Còn ${learningSnapshot.remainingMainSessions} buổi`
        : "Chưa có",
      animate: canViewFinance ? "150ms" : "0ms",
    },
    
    // 5. Điểm danh
    {
      key: "attendance",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>
        </svg>
      ),
      iconBg: "bg-[#ede9fe]",
      iconColor: "text-[#7c3aed]",
      label: "Điểm danh",
      labelColor: "text-[#5b21b6]",
      borderColor: "border-[#8b5cf6]",
      value: attendanceStats.present.toString(),
      valueColor: "text-[#111827]",
      subtitle: `Vắng ${attendanceStats.absent} · Bù ${attendanceStats.makeup}`,
      animate: canViewFinance ? "200ms" : "50ms",
    },
    
    // 6. Portal
    {
      key: "portal",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      ),
      iconBg: "bg-[#cffafe]",
      iconColor: "text-[#0891b2]",
      label: "Portal",
      labelColor: "text-[#164e63]",
      borderColor: "border-[#06b6d4]",
      value: portalEmail || "Chưa cấp",
      valueColor: "text-[#111827]",
      subtitle: primaryGuardianName || "Chưa có PH",
      animate: canViewFinance ? "250ms" : "100ms",
    },
  ];

  return (
    <div className="border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-5 sm:px-6">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <div
            key={kpi.key}
            className={`rounded-xl border-2 ${kpi.borderColor} bg-white p-4 shadow-sm`}
            style={{
              animation: `slideUp 400ms ease-out backwards`,
              animationDelay: kpi.animate,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.iconBg}`}>
                <span className={kpi.iconColor}>{kpi.icon}</span>
              </div>
              <span className={`text-xs font-bold uppercase tracking-wide ${kpi.labelColor}`}>
                {kpi.label}
              </span>
            </div>
            <p className={`text-3xl font-black ${kpi.valueColor} truncate`}>
              {kpi.value}
            </p>
            <p className="mt-1 text-sm text-[#6b7280] truncate" title={kpi.subtitle}>
              {kpi.subtitle}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
