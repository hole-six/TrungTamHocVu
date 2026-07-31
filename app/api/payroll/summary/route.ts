import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canViewWithOverride, canUpdateWithOverride } from "@/lib/server/role-matrix";
import { parseStandardReportFilters } from "@/lib/reporting-filters";
import {
  buildPayrollOverviewLivePayload,
  createPayrollOverviewSnapshot,
  findPayrollOverviewSnapshot,
  resolvePayrollPeriodKey,
} from "@/lib/server/payroll-snapshots";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canViewWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Bạn không có quyền xem nhân sự & lương." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const branchId = await getCurrentBranchId(searchParams.get("branchId"));
  const filters = parseStandardReportFilters(searchParams, branchId);

  if (filters.mode === "snapshot" && branchId) {
    const snapshot = await findPayrollOverviewSnapshot(branchId, filters);
    if (snapshot) {
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
        ...snapshot.detail,
      });
    }
  }

  const payload = await buildPayrollOverviewLivePayload(branchId, filters);
  return NextResponse.json({
    meta: {
      requestedMode: filters.mode,
      effectiveMode: "live",
      filters,
      snapshotReady: Boolean(branchId),
      snapshotId: null,
      snapshotAt: null,
      periodKey: resolvePayrollPeriodKey(filters),
    },
    ...payload,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canUpdateWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Bạn không có quyền chốt dữ liệu kỳ lương." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const branchId = await getCurrentBranchId(searchParams.get("branchId"));
  if (!branchId) {
    return NextResponse.json({ error: "Cần chọn cơ sở để chốt dữ liệu kỳ lương." }, { status: 400 });
  }

  const filters = parseStandardReportFilters(searchParams, branchId);
  const snapshot = await createPayrollOverviewSnapshot({
    branchId,
    userId: user.id,
    filters: { ...filters, mode: "snapshot" },
  });

  return NextResponse.json({
    ok: true,
    meta: {
      effectiveMode: "snapshot",
      snapshotId: snapshot.id,
      snapshotAt: snapshot.asOfAt,
      periodKey: snapshot.periodKey,
    },
    ...snapshot.payload,
  });
}
