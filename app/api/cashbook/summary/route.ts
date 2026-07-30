import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canViewWithOverride, canUpdateWithOverride } from "@/lib/server/role-matrix";
import { parseStandardReportFilters } from "@/lib/reporting-filters";
import {
  buildCashbookOverviewLivePayload,
  createCashbookOverviewSnapshot,
  findCashbookOverviewSnapshot,
  resolveCashbookPeriodKey,
} from "@/lib/server/cashbook-snapshots";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { role, override } = await getUserRoleAndOverride(user.id, "cashbook");
  if (!canViewWithOverride("cashbook", role, override)) {
    return NextResponse.json({ error: "Bạn không có quyền xem thu chi." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const branchId = await getCurrentBranchId(searchParams.get("branchId"));
  const filters = parseStandardReportFilters(searchParams, branchId);

  if (filters.mode === "snapshot" && branchId) {
    const snapshot = await findCashbookOverviewSnapshot(branchId, filters);
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

  const payload = await buildCashbookOverviewLivePayload(branchId, filters.status);
  return NextResponse.json({
    meta: {
      requestedMode: filters.mode,
      effectiveMode: "live",
      filters,
      snapshotReady: Boolean(branchId),
      snapshotId: null,
      snapshotAt: null,
      periodKey: resolveCashbookPeriodKey(filters),
    },
    ...payload,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { role, override } = await getUserRoleAndOverride(user.id, "cashbook");
  if (!canUpdateWithOverride("cashbook", role, override)) {
    return NextResponse.json({ error: "Bạn không có quyền chốt dữ liệu thu chi." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const branchId = await getCurrentBranchId(searchParams.get("branchId"));
  if (!branchId) {
    return NextResponse.json({ error: "Cần chọn cơ sở để chốt dữ liệu thu chi." }, { status: 400 });
  }

  const filters = parseStandardReportFilters(searchParams, branchId);
  const snapshot = await createCashbookOverviewSnapshot({
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
