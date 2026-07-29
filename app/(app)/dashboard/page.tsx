import Link from "next/link";
import { prisma } from "@/lib/prisma";

async function getStats() {
  const [activeStudents, totalStudents, activeClasses, openLeads, unpaidCharges] = await Promise.all([
    prisma.student.count({ where: { status: "ACTIVE" } }),
    prisma.student.count(),
    prisma.class.count({ where: { status: "ACTIVE" } }),
    prisma.lead.count({ where: { status: { notIn: ["ENROLLED", "LOST"] } } }),
    prisma.charge.aggregate({ _sum: { totalAmount: true } }),
  ]);

  const paid = await prisma.paymentAllocation.aggregate({ _sum: { amount: true } });
  const outstanding = (unpaidCharges._sum.totalAmount ?? 0) - (paid._sum.amount ?? 0);

  return { activeStudents, totalStudents, activeClasses, openLeads, outstanding };
}

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function StatCard({
  label,
  value,
  sub,
  icon,
  href,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  href?: string;
  accent?: boolean;
}) {
  const content = (
    <div className={accent ? "stat-card-accent" : "stat-card"}>
      {/* Icon chip */}
      <div
        className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${
          accent ? "bg-white/20" : "bg-primary/10"
        }`}
      >
        <span className={accent ? "text-white" : "text-primary"}>{icon}</span>
      </div>
      <p className={`text-xs font-semibold uppercase tracking-widest ${accent ? "text-white/70" : "text-ink-muted48"}`}>
        {label}
      </p>
      <p className={`mt-1 font-display text-3xl font-semibold tracking-tight ${accent ? "text-white" : "text-ink"}`}>
        {value}
      </p>
      {sub && (
        <p className={`mt-1 text-xs ${accent ? "text-white/60" : "text-ink-muted48"}`}>{sub}</p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Tổng quan</h1>
          <p className="page-subtitle">Số liệu vận hành theo thời gian thực.</p>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Học viên đang học"
          value={String(stats.activeStudents)}
          sub={`trên tổng ${stats.totalStudents} học viên`}
          href="/students"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          }
        />
        <StatCard
          label="Lớp đang hoạt động"
          value={String(stats.activeClasses)}
          sub="lớp có trạng thái ACTIVE"
          href="/classes"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
        <StatCard
          label="Lead đang xử lý"
          value={String(stats.openLeads)}
          sub="chưa enrolled hoặc lost"
          href="/leads"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
        <StatCard
          label="Công nợ học phí"
          value={formatVnd(stats.outstanding)}
          sub="chưa thu"
          href="/tuition"
          accent
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/students/new" className="card-sm group flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-ink group-hover:text-primary transition-colors">Thêm học viên</p>
            <p className="text-xs text-ink-muted48">Tạo hồ sơ học viên mới</p>
          </div>
        </Link>
        <Link href="/leads/new" className="card-sm group flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-ink group-hover:text-primary transition-colors">Thêm lead</p>
            <p className="text-xs text-ink-muted48">Ghi nhận học viên tiềm năng</p>
          </div>
        </Link>
        <Link href="/classes/new" className="card-sm group flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-ink group-hover:text-primary transition-colors">Thêm lớp học</p>
            <p className="text-xs text-ink-muted48">Mở lớp mới và xếp lịch</p>
          </div>
        </Link>
      </div>

      {/* Status notice */}
      <div className="alert-info flex items-start gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><circle cx="12" cy="16" r="0.5" fill="currentColor" />
        </svg>
        <p>
          Module <strong>Học viên, Lớp & Lịch, Học phí, Kho giáo trình, CRM tuyển sinh</strong> đã kết nối đầy đủ với cơ sở dữ liệu.
          Các module còn lại (<strong>Chấm công, Thu chi, Nhân sự & Lương, Báo cáo, Quản trị</strong>) đang được triển khai lần lượt.
        </p>
      </div>
    </div>
  );
}
