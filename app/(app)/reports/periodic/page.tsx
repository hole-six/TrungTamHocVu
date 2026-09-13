import NoPermission from "@/components/ui/NoPermission";
import PeriodicReportView from "@/components/reports/PeriodicReportView";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { buildPeriodicReport, resolveReportRange, type ReportKind } from "@/lib/server/periodic-report";

export const dynamic = "force-dynamic";

// Báo cáo tuần / tháng theo đúng mẫu trung tâm đang nộp (xem lib/server/periodic-report.ts).
// ?kind=week&at=YYYY-MM-DD (ngày bất kỳ trong tuần) | ?kind=month&at=YYYY-MM
export default async function PeriodicReportPage({ searchParams }: { searchParams: { kind?: string; at?: string } }) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!canView("reports", role)) return <NoPermission module="Báo cáo" />;

  const kind: ReportKind = searchParams.kind === "month" ? "month" : "week";
  const range = resolveReportRange(kind, searchParams.at);
  const branchId = await getCurrentBranchId();
  const report = await buildPeriodicReport({ branchId, range });

  return <PeriodicReportView report={report} />;
}
