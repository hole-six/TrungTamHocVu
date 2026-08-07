import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { ASSET_STATUS_LABEL, computeAssetTotalValue, computeNextMaintenanceDue, computeMaintenanceStatus } from "@/lib/server/asset-rules";
import NewAssetForm from "@/components/assets/NewAssetForm";
import AssetEditForm from "@/components/assets/AssetEditForm";
import DeleteAssetButton from "@/components/assets/DeleteAssetButton";
import QuickMaintenanceButton from "@/components/assets/QuickMaintenanceButton";
import AssetMaintenanceCell from "@/components/assets/AssetMaintenanceCell";
import PageGuide from "@/components/ui/PageGuide";
import { getUserRole } from "@/lib/permissions";
import { canCreate, canUpdate, canDelete } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";

const ASSETS_PAGE_GUIDE_SECTIONS = [
  {
    title: "Màn này để làm gì?",
    items: [
      "Đây là màn quản lý tài sản và thiết bị của cơ sở.",
      "Người vận hành nhìn ở đây để biết tài sản nào đang có, ở đâu, giá gốc bao nhiêu, đã đổ thêm bao nhiêu tiền bảo dưỡng.",
      "Từ đây có thể thêm mới, sửa thông tin, bảo dưỡng nhanh hoặc đi sâu vào chi tiết từng tài sản.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách đọc số liệu",
    items: [
      "Giá gốc là giá trị ban đầu theo số lượng và đơn giá.",
      "Bảo dưỡng là tổng tiền đã chi thêm cho tài sản trong quá trình sử dụng.",
      "Tổng giá trị là giá gốc cộng toàn bộ tiền bảo dưỡng đã ghi nhận.",
      "Trạng thái cho biết tài sản đang dùng, đang bảo trì hay đã hỏng/thanh lý.",
    ],
    tone: "success" as const,
  },
  {
    title: "Điểm cần tránh",
    items: [
      "Không dùng sửa thông tin để thay thế luồng bảo dưỡng.",
      "Không ghi nhận bảo dưỡng khi tiền chưa chi thực tế.",
      "Không gộp nhiều loại tài sản khác nhau vào cùng một dòng vì sẽ rất khó đối chiếu về sau.",
    ],
    tone: "warning" as const,
  },
];

const PAGE_SIZE = 20;

function formatVnd(amount: number) {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

function normalizeUnit(unitName: string | null) {
  const trimmed = unitName?.trim();
  return trimmed || "cái";
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  const activeBranchId = await getCurrentBranchId();

  const q = searchParams.q?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = PAGE_SIZE;

  const branchWhere = activeBranchId ? { branchId: activeBranchId } : {};
  const where = {
    ...branchWhere,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { assetCode: { contains: q } },
            { category: { contains: q } },
            { room: { contains: q } },
          ],
        }
      : {}),
  };

  const [assets, total, assetsForTotals] = await Promise.all([
    prisma.asset.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        transactions: {
          select: { id: true, type: true, quantity: true, amount: true, txnDate: true, notes: true, voidedAt: true, voidReason: true },
        },
      },
    }),
    prisma.asset.count({ where }),
    // Tổng số lượng/giá trị/số thiết bị quá hạn phải tính trên TOÀN BỘ danh sách đã
    // lọc, không chỉ trang hiện tại — dùng truy vấn riêng không phân trang cho việc này.
    prisma.asset.findMany({
      where,
      select: {
        status: true,
        unitValue: true,
        maintenanceIntervalMonths: true,
        createdAt: true,
        transactions: { select: { type: true, quantity: true, amount: true, txnDate: true, voidedAt: true } },
      },
    }),
  ]);

  const rows = assets.map((asset) => {
    const quantity = asset.transactions.reduce((sum, transaction) => sum + transaction.quantity, 0);
    const unitName = normalizeUnit(asset.unitName);
    const baseValue = quantity * (asset.unitValue ?? 0);
    const maintenanceTxns = asset.transactions.filter((transaction) => transaction.type === "MAINTENANCE");
    // Đã hủy (voided) thì không tính tiền/không dùng làm mốc tính hạn kế tiếp, nhưng vẫn
    // hiện trong lịch sử để giữ dấu vết — lọc riêng maintenanceValue/anchor, không lọc history.
    const maintenanceValue = maintenanceTxns.filter((t) => !t.voidedAt).reduce((sum, transaction) => sum + transaction.amount, 0);
    const maintenanceHistory = maintenanceTxns
      .slice()
      .sort((a, b) => b.txnDate.getTime() - a.txnDate.getTime())
      .map((t) => ({ id: t.id, txnDate: t.txnDate.toISOString(), amount: t.amount, notes: t.notes, voidedAt: t.voidedAt ? t.voidedAt.toISOString() : null, voidReason: t.voidReason }));
    const lastMaintenanceDate = maintenanceTxns.filter((t) => !t.voidedAt).reduce<Date | null>(
      (latest, t) => (!latest || t.txnDate.getTime() > latest.getTime() ? t.txnDate : latest),
      null,
    );
    const nextMaintenanceDue = computeNextMaintenanceDue(asset.maintenanceIntervalMonths, lastMaintenanceDate, asset.createdAt);
    const maintenanceStatus = computeMaintenanceStatus(nextMaintenanceDue);

    return {
      ...asset,
      quantity,
      unitName,
      baseValue,
      maintenanceValue,
      maintenanceHistory,
      nextMaintenanceDue,
      maintenanceStatus,
      totalValue: computeAssetTotalValue(asset.unitValue, quantity, asset.transactions),
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const summaryRows = assetsForTotals.map((asset) => {
    const quantity = asset.transactions.reduce((sum, transaction) => sum + transaction.quantity, 0);
    const baseValue = quantity * (asset.unitValue ?? 0);
    const maintenanceTxns = asset.transactions.filter((transaction) => transaction.type === "MAINTENANCE" && !transaction.voidedAt);
    const maintenanceValue = maintenanceTxns.reduce((sum, transaction) => sum + transaction.amount, 0);
    const lastMaintenanceDate = maintenanceTxns.reduce<Date | null>(
      (latest, t) => (!latest || t.txnDate.getTime() > latest.getTime() ? t.txnDate : latest),
      null,
    );
    const nextMaintenanceDue = computeNextMaintenanceDue(asset.maintenanceIntervalMonths, lastMaintenanceDate, asset.createdAt);
    return {
      status: asset.status,
      quantity,
      baseValue,
      maintenanceValue,
      maintenanceStatus: computeMaintenanceStatus(nextMaintenanceDue),
      totalValue: computeAssetTotalValue(asset.unitValue, quantity, asset.transactions),
    };
  });
  const totalQuantity = summaryRows.reduce((sum, row) => sum + row.quantity, 0);
  const totalBaseValue = summaryRows.reduce((sum, row) => sum + row.baseValue, 0);
  const totalMaintenanceValue = summaryRows.reduce((sum, row) => sum + row.maintenanceValue, 0);
  const totalValue = summaryRows.reduce((sum, row) => sum + row.totalValue, 0);
  const maintenanceCount = summaryRows.filter((row) => row.status === "MAINTENANCE").length;
  const brokenCount = summaryRows.filter((row) => row.status === "BROKEN").length;
  const overdueMaintenanceCount = summaryRows.filter((row) => row.maintenanceStatus === "OVERDUE").length;
  const dueSoonMaintenanceCount = summaryRows.filter((row) => row.maintenanceStatus === "DUE_SOON").length;
  const canManageAssets = canUpdate("assets", role);
  const canRemoveAssets = canDelete("assets", role);

  return (
    <div className="space-y-6">
      <PageGuide
        title="Guide vận hành tài sản"
        summary="Đây là màn tổng quản tài sản của cơ sở. Người mới chỉ cần nhớ: thêm đúng tài sản, bảo dưỡng đi đúng luồng, và đọc rõ chênh lệch giữa giá gốc - bảo dưỡng - tổng giá trị."
        sections={ASSETS_PAGE_GUIDE_SECTIONS}
        buttonLabel="Guide tài sản"
      />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="page-title">Tài sản & thiết bị</h1>
          <p className="page-subtitle">Theo dõi giá trị gốc, chi phí bảo dưỡng và tổng giá trị sử dụng của từng tài sản.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">{canCreate("assets", role) ? <NewAssetForm /> : null}</div>
      </div>

      <div className="card">
        <form className="flex flex-wrap items-center gap-3">
          <input type="text" name="q" defaultValue={q} placeholder="Tìm tên, mã tài sản, phòng..." className="input min-w-[220px] flex-1" />
          <span className="rounded-full border border-[#dbe7ff] bg-white px-3 py-2 text-xs font-semibold text-ink">Tài sản {total}</span>
          <span className="rounded-full border border-[#dbe7ff] bg-white px-3 py-2 text-xs font-semibold text-sky-700">Số lượng {totalQuantity}</span>
          <span className="rounded-full border border-[#dbe7ff] bg-white px-3 py-2 text-xs font-semibold text-indigo-700">Giá gốc {formatVnd(totalBaseValue)}</span>
          <span className="rounded-full border border-[#fde7d8] bg-[#fff8f2] px-3 py-2 text-xs font-semibold text-amber-700">Bảo dưỡng {formatVnd(totalMaintenanceValue)}</span>
          <span className="rounded-full border border-[#e4ddff] bg-[#f7f5ff] px-3 py-2 text-xs font-semibold text-violet-700">Tổng giá trị {formatVnd(totalValue)}</span>
          <span className="rounded-full border border-[#fde7d8] bg-[#fff8f2] px-3 py-2 text-xs font-semibold text-amber-700">Đang bảo trì {maintenanceCount}</span>
          <span className="rounded-full border border-[#ffe0e0] bg-[#fff7f7] px-3 py-2 text-xs font-semibold text-rose-700">Hỏng {brokenCount}</span>
          <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Quá hạn bảo dưỡng {overdueMaintenanceCount}</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Sắp đến hạn {dueSoonMaintenanceCount}</span>
        </form>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Danh sách tài sản</h2>
            <p className="mt-1 text-sm text-ink-muted48">Đối chiếu nhanh giá gốc, bảo dưỡng và tổng giá trị ngay trên từng dòng.</p>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tài sản</th>
                  <th>Nhóm</th>
                  <th>Phòng</th>
                  <th>SL</th>
                  <th>ĐVT</th>
                  <th>Đơn giá</th>
                  <th>Giá gốc</th>
                  <th>Bảo dưỡng</th>
                  <th>Tổng giá trị</th>
                  <th>Trạng thái</th>
                  <th>Lịch bảo dưỡng</th>
                  {(canManageAssets || canRemoveAssets) && <th>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <Link href={`/assets/${asset.id}`} className="font-medium text-primary hover:underline">
                        {asset.name}
                      </Link>
                      <p className="mt-1 text-xs text-ink-muted48">{asset.assetCode ?? "Chưa có mã"}</p>
                    </td>
                    <td>{asset.category ?? "Chưa phân nhóm"}</td>
                    <td>{asset.room ?? "Chưa gắn phòng"}</td>
                    <td>{asset.quantity}</td>
                    <td>{asset.unitName}</td>
                    <td>{asset.unitValue != null ? formatVnd(asset.unitValue) : "—"}</td>
                    <td className="font-medium text-slate-700">{formatVnd(asset.baseValue)}</td>
                    <td className={asset.maintenanceValue > 0 ? "font-medium text-amber-700" : "text-ink-muted48"}>{formatVnd(asset.maintenanceValue)}</td>
                    <td className="font-medium">{formatVnd(asset.totalValue)}</td>
                    <td>
                      <span className={asset.status === "ACTIVE" ? "badge-green" : asset.status === "MAINTENANCE" ? "badge-amber" : asset.status === "BROKEN" ? "badge-red" : "badge-gray"}>
                        {ASSET_STATUS_LABEL[asset.status] ?? asset.status}
                      </span>
                    </td>
                    <td>
                      <AssetMaintenanceCell
                        assetId={asset.id}
                        assetName={asset.name}
                        intervalMonths={asset.maintenanceIntervalMonths}
                        status={asset.maintenanceStatus}
                        nextDue={asset.nextMaintenanceDue ? asset.nextMaintenanceDue.toISOString() : null}
                        history={asset.maintenanceHistory}
                        canVoid={canManageAssets}
                      />
                    </td>
                    {(canManageAssets || canRemoveAssets) && (
                      <td>
                        <div className="flex flex-wrap items-center gap-2">
                          {canManageAssets && <QuickMaintenanceButton assetId={asset.id} assetName={asset.name} compact />}
                          {canManageAssets && (
                            <AssetEditForm
                              assetId={asset.id}
                              compact
                              initial={{
                                status: asset.status,
                                name: asset.name,
                                category: asset.category ?? "",
                                room: asset.room ?? "",
                                unitName: asset.unitName,
                                unitValue: asset.unitValue?.toString() ?? "",
                                maintenanceIntervalMonths: asset.maintenanceIntervalMonths?.toString() ?? "",
                                notes: asset.notes ?? "",
                              }}
                            />
                          )}
                          {canRemoveAssets && <DeleteAssetButton assetId={asset.id} assetName={asset.name} compact />}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr className="table-empty">
                    <td colSpan={12}>Không có tài sản nào khớp bộ lọc.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="space-y-3 lg:hidden">
          {rows.map((asset) => (
            <div key={asset.id} className="rounded-lg border border-hairline bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <Link href={`/assets/${asset.id}`} className="block font-semibold text-primary hover:underline">
                    {asset.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-muted48">{asset.assetCode ?? "Chưa có mã"}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="text-xs text-ink-muted80">{asset.category ?? "Chưa phân nhóm"}</span>
                    {asset.room && (
                      <>
                        <span className="text-xs text-ink-muted48">•</span>
                        <span className="text-xs text-ink-muted80">{asset.room}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className={asset.status === "ACTIVE" ? "badge-green" : asset.status === "MAINTENANCE" ? "badge-amber" : asset.status === "BROKEN" ? "badge-red" : "badge-gray"}>
                  {ASSET_STATUS_LABEL[asset.status] ?? asset.status}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-hairline pt-3 text-xs">
                <div>
                  <span className="text-ink-muted48">Số lượng:</span>
                  <span className="ml-1 font-medium">{asset.quantity} {asset.unitName}</span>
                </div>
                <div className="text-right">
                  <span className="text-ink-muted48">Đơn giá:</span>
                  <span className="ml-1 font-medium">{asset.unitValue != null ? formatVnd(asset.unitValue) : "—"}</span>
                </div>
                <div>
                  <span className="text-ink-muted48">Giá gốc:</span>
                  <span className="ml-1 font-semibold text-slate-700">{formatVnd(asset.baseValue)}</span>
                </div>
                <div className="text-right">
                  <span className="text-ink-muted48">Bảo dưỡng:</span>
                  <span className={asset.maintenanceValue > 0 ? "ml-1 font-semibold text-amber-700" : "ml-1 text-ink-muted48"}>{formatVnd(asset.maintenanceValue)}</span>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2">
                <span className="text-xs text-ink-muted48">Tổng giá trị:</span>
                <span className="text-sm font-semibold">{formatVnd(asset.totalValue)}</span>
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2">
                <span className="text-xs text-ink-muted48">Lịch bảo dưỡng:</span>
                <AssetMaintenanceCell
                  assetId={asset.id}
                  assetName={asset.name}
                  intervalMonths={asset.maintenanceIntervalMonths}
                  status={asset.maintenanceStatus}
                  nextDue={asset.nextMaintenanceDue ? asset.nextMaintenanceDue.toISOString() : null}
                  history={asset.maintenanceHistory}
                  canVoid={canManageAssets}
                />
              </div>

              {(canManageAssets || canRemoveAssets) && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-hairline pt-3">
                  {canManageAssets && <QuickMaintenanceButton assetId={asset.id} assetName={asset.name} compact />}
                  {canManageAssets && (
                    <AssetEditForm
                      assetId={asset.id}
                      compact
                      initial={{
                        status: asset.status,
                        name: asset.name,
                        category: asset.category ?? "",
                        room: asset.room ?? "",
                        unitName: asset.unitName,
                        unitValue: asset.unitValue?.toString() ?? "",
                        maintenanceIntervalMonths: asset.maintenanceIntervalMonths?.toString() ?? "",
                        notes: asset.notes ?? "",
                      }}
                    />
                  )}
                  {canRemoveAssets && <DeleteAssetButton assetId={asset.id} assetName={asset.name} compact />}
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 ? (
            <div className="rounded-lg border border-hairline bg-white p-8 text-center text-sm text-ink-muted48">
              Không có tài sản nào khớp bộ lọc.
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-[#e6eefc] pt-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-ink-muted48">
            Hiển thị {rows.length} trên tổng {total} tài sản
          </p>
          <div className="pagination">
            <Link
              href={`/assets?q=${encodeURIComponent(q)}&page=${Math.max(1, page - 1)}`}
              className={page <= 1 ? "pagination-item pointer-events-none opacity-50" : "pagination-item"}
            >
              Trước
            </Link>
            <span className="pagination-item-active">{page}</span>
            <Link
              href={`/assets?q=${encodeURIComponent(q)}&page=${Math.min(totalPages, page + 1)}`}
              className={page >= totalPages ? "pagination-item pointer-events-none opacity-50" : "pagination-item"}
            >
              Sau
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
