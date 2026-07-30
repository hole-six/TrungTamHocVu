import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canViewWithOverride } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { parseStandardReportFilters } from "@/lib/reporting-filters";
import {
  buildReportsSummaryLivePayload,
  createReportsSummarySnapshot,
  findReportsSummarySnapshot,
  resolveReportingPeriodKey,
} from "@/lib/server/report-snapshots";

function getNoTuitionPayload() {
  return {
    periodName: null,
    totals: {
      sessionCount: 0,
      materialsAmount: 0,
      openingBalance: 0,
      tuitionAmount: 0,
      billedAmount: 0,
      collectedAmount: 0,
      remainingAmount: 0,
    },
    classes: [],
  };
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { role, override } = await getUserRoleAndOverride(user.id, "tuition");
  const canViewTuition = canViewWithOverride("tuition", role, override);
  const { searchParams } = new URL(req.url);
  const branchId = await getCurrentBranchId(searchParams.get("branchId"));
  const filters = parseStandardReportFilters(searchParams, branchId);

  if (filters.mode === "snapshot" && branchId) {
    const snapshot = await findReportsSummarySnapshot(branchId, filters);
    if (snapshot) {
      const detail = snapshot.detail as Awaited<ReturnType<typeof buildReportsSummaryLivePayload>>;
      return NextResponse.json({
        meta: {
          requestedMode: filters.mode,
          effectiveMode: "snapshot",
          filters,
          snapshotReady: true,
          snapshotId: snapshot.id,
          snapshotAt: snapshot.asOfAt,
          periodKey: snapshot.periodKey,
        },
        dashboard: detail.dashboard,
        reportHs: detail.reportHs,
        reportHp: canViewTuition ? detail.reportHp : null,
      });
    }
  }

  const payload = await buildReportsSummaryLivePayload(branchId, canViewTuition);

  return NextResponse.json({
    meta: {
      requestedMode: filters.mode,
      effectiveMode: "live",
      filters,
      snapshotReady: Boolean(branchId),
      snapshotId: null,
      snapshotAt: null,
      periodKey: resolveReportingPeriodKey(filters),
    },
    dashboard: payload.dashboard,
    reportHs: payload.reportHs,
    reportHp: canViewTuition ? payload.reportHp : getNoTuitionPayload(),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { role, override } = await getUserRoleAndOverride(user.id, "reports");
  if (!canViewWithOverride("reports", role, override)) {
    return NextResponse.json({ error: "Bạn không có quyền tạo snapshot báo cáo." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const branchId = await getCurrentBranchId(searchParams.get("branchId"));
  if (!branchId) {
    return NextResponse.json({ error: "Cần chọn cơ sở để tạo snapshot báo cáo." }, { status: 400 });
  }

  const { role: tuitionRole, override: tuitionOverride } = await getUserRoleAndOverride(user.id, "tuition");
  const canViewTuition = canViewWithOverride("tuition", tuitionRole, tuitionOverride);
  const filters = parseStandardReportFilters(searchParams, branchId);
  const snapshot = await createReportsSummarySnapshot({
    branchId,
    userId: user.id,
    filters: { ...filters, mode: "snapshot" },
    canViewTuition,
  });

  return NextResponse.json({
    ok: true,
    meta: {
      effectiveMode: "snapshot",
      snapshotId: snapshot.id,
      snapshotAt: snapshot.asOfAt,
      periodKey: snapshot.periodKey,
    },
    dashboard: snapshot.payload.dashboard,
    reportHs: snapshot.payload.reportHs,
    reportHp: canViewTuition ? snapshot.payload.reportHp : getNoTuitionPayload(),
  });
}
