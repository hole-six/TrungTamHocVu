import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { ASSET_STATUS_LABEL, computeAssetTotalValue } from "@/lib/server/asset-rules";
import NewAssetForm from "@/components/assets/NewAssetForm";
import AssetEditForm from "@/components/assets/AssetEditForm";
import DeleteAssetButton from "@/components/assets/DeleteAssetButton";
import QuickMaintenanceButton from "@/components/assets/QuickMaintenanceButton";
import { getUserRole } from "@/lib/permissions";
import { canCreate, canUpdate, canDelete } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";

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

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        transactions: {
          select: { type: true, quantity: true, amount: true },
        },
      },
    }),
    prisma.asset.count({ where }),
  ]);

  const rows = assets.map((asset) => {
    const quantity = asset.transactions.reduce((sum, transaction) => sum + transaction.quantity, 0);
    const unitName = normalizeUnit(asset.unitName);
    const baseValue = quantity * (asset.unitValue ?? 0);
    const maintenanceValue = asset.transactions
      .filter((transaction) => transaction.type === "MAINTENANCE")
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      ...asset,
      quantity,
      unitName,
      baseValue,
      maintenanceValue,
      totalValue: computeAssetTotalValue(asset.unitValue, quantity, asset.transactions),
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const totalBaseValue = rows.reduce((sum, row) => sum + row.baseValue, 0);
  const totalMaintenanceValue = rows.reduce((sum, row) => sum + row.maintenanceValue, 0);
  const totalValue = rows.reduce((sum, row) => sum + row.totalValue, 0);
  const maintenanceCount = rows.filter((row) => row.status === "MAINTENANCE").length;
  const brokenCount = rows.filter((row) => row.status === "BROKEN").length;
  const canManageAssets = canUpdate("assets", role);
  const canRemoveAssets = canDelete("assets", role);

  return (
    <div className="space-y-6">
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
        </form>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Danh sách tài sản</h2>
            <p className="mt-1 text-sm text-ink-muted48">Đối chiếu nhanh giá gốc, bảo dưỡng và tổng giá trị ngay trên từng dòng.</p>
          </div>
        </div>

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
                  <td colSpan={11}>Không có tài sản nào khớp bộ lọc.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
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
