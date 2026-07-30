"use client";

import Link from "next/link";
import { LEAD_STATUS_LABEL } from "@/lib/server/lead-rules";

type Lead = {
  id: string;
  fullName: string;
  phone: string;
  source?: string;
  status: string;
  interestedCourses?: string;
  followUpDate?: string;
  createdAt: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  NEW: { label: LEAD_STATUS_LABEL.NEW, color: "bg-blue-100 text-blue-700 border-blue-200", icon: "✨" },
  CONTACTING: { label: LEAD_STATUS_LABEL.CONTACTING, color: "bg-violet-100 text-violet-700 border-violet-200", icon: "📞" },
  APPOINTED: { label: LEAD_STATUS_LABEL.APPOINTED, color: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200", icon: "🗓️" },
  TESTED: { label: LEAD_STATUS_LABEL.TESTED, color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: "📝" },
  QUALIFIED: { label: LEAD_STATUS_LABEL.QUALIFIED, color: "bg-amber-100 text-amber-700 border-amber-200", icon: "⭐" },
  UNQUALIFIED: { label: LEAD_STATUS_LABEL.UNQUALIFIED, color: "bg-slate-100 text-slate-700 border-slate-200", icon: "↺" },
  ENROLLED: { label: LEAD_STATUS_LABEL.ENROLLED, color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "✅" },
  LOST: { label: LEAD_STATUS_LABEL.LOST, color: "bg-red-100 text-red-700 border-red-200", icon: "❌" },
};

export default function LeadCard({ lead }: { lead: Lead }) {
  const status = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.NEW;
  const isOverdue = lead.followUpDate && new Date(lead.followUpDate) < new Date();

  return (
    <Link
      href={`/leads/${lead.id}`}
      className="group card transition-all duration-200 hover:scale-[1.02] hover:border-primary/30 hover:shadow-xl"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg shadow-violet-500/30 transition-shadow group-hover:shadow-violet-500/50">
            <span className="text-lg font-bold text-white">{lead.fullName.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-ink transition-colors group-hover:text-primary">{lead.fullName}</h3>
            {lead.source ? (
              <span className="text-xs text-ink-muted48">
                Nguồn: <span className="font-semibold">{lead.source}</span>
              </span>
            ) : null}
          </div>
        </div>

        <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold ${status.color}`}>
          <span>{status.icon}</span>
          {status.label}
        </span>
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>
          <span className="text-sm font-mono text-ink-muted64">{lead.phone}</span>
        </div>
      </div>

      {lead.interestedCourses ? (
        <div className="mb-3 rounded-lg border border-[#e8edf5] bg-[#fafbff] p-3">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <div>
              <p className="mb-0.5 text-xs font-semibold text-ink-muted64">Quan tâm:</p>
              <p className="line-clamp-1 text-xs text-ink">{lead.interestedCourses}</p>
            </div>
          </div>
        </div>
      ) : null}

      {lead.followUpDate ? (
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${isOverdue ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isOverdue ? "#dc2626" : "#059669"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div className="flex-1">
            <p className={`text-xs font-semibold ${isOverdue ? "text-red-700" : "text-emerald-700"}`}>
              {isOverdue ? "⚠️ Quá hạn theo dõi" : "📅 Theo dõi tiếp"}
            </p>
            <p className={`text-xs ${isOverdue ? "text-red-600" : "text-emerald-600"}`}>
              {new Date(lead.followUpDate).toLocaleDateString("vi-VN")}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-3 border-t border-[#e8edf5] pt-3">
        <p className="text-xs text-ink-muted48">Tạo ngày: {new Date(lead.createdAt).toLocaleDateString("vi-VN")}</p>
      </div>

      <div className="mt-3 flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100">
        <span className="flex items-center gap-1 text-xs font-semibold text-primary">
          Xem chi tiết
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
