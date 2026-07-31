import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { ASSET_STATUS_LABEL } from "@/lib/server/asset-rules";
import NewAssetForm from "@/components/assets/NewAssetForm";
import AssetEditForm from "@/components/assets/AssetEditForm";
import DeleteAssetButton from "@/components/assets/DeleteAssetButton";
import { getUserRole } from "@/lib/permissions";
import { canCreate, canUpdate, canDelete } from "@/lib/server/role-matrix";

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
  searchParams: { q?: string; category?: string; status?: string; page?: string; pageSize?: string };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;

  const q = searchParams.q?.trim() ?? "";
  const selectedCategory = searchParams.category?.trim() ?? "";
  const selectedStatus = searchParams.status?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.pageSize ?? PAGE_SIZE)));

  const branchWhere = user?.branchId ? { branchId: user.branchId } : {};
  const where = {
    ...branchWhere,
    ...(selectedCategory ? { category: selectedCategory } : {}),
    ...(selectedStatus ? { status: selectedStatus } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { assetCode: { contains: q } }, { category: { contains: q } }, { room: { contains: q } }] } : {}),
  };

  const [assets, total, categoryRows] = await Promise.all([
    prisma.asset.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { transactions: { select: { quantity: true } } },
    }),
    prisma.asset.count({ where }),
    prisma.asset.findMany({
      where: branchWhere,
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ]);

  const rows = assets.map((asset) => {
    const quantity = asset.transactions.reduce((sum, transaction) => sum + transaction.quantity, 0);
    const unitName = normalizeUnit(asset.unitName);
    return {
      ...asset,
      quantity,
      unitName,
      totalValue: quantity * (asset.unitValue ?? 0),
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const totalValue = rows.reduce((sum, row) => sum + row.totalValue, 0);
  const maintenanceCount = rows.filter((row) => row.status === "MAINTENANCE").length;
  const brokenCount = rows.filter((row) => row.status === "BROKEN").length;
  const categoryOptions = categoryRows.map((row) => row.category?.trim()).filter((value): value is string => Boolean(value));
  const canManageAssets = canUpdate("assets", role);
  const canRemoveAssets = canDelete("assets", role);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f8fcff_0%,#eef7ff_42%,#ffffff_100%)] p-6 shadow-[0_28px_80px_-48px_rgba(14,116,144,0.45)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <span className="inline-flex w-fit rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              Sổ tài sản
            </span>
            <div>
              <h1 className="page-title">Tài sản & trang thiết bị</h1>
              <p className="page-subtitle max-w-3xl">
                Theo dõi tài sản theo đúng nghiệp vụ vận hành: nhóm tài sản, phòng sử dụng, số lượng hiện có, đơn vị tính, giá trị trên từng đơn vị và trạng thái sử dụng.
              </p>
            </div>
          </div>
          {canCreate("assets", role) ? <NewAssetForm /> : null}
        </div>

        <form className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_240px_220px_180px_auto]">
          <label className="form-group">
            <span className="label-sm">Tìm theo tên, mã tài sản, phòng</span>
            <input type="text" name="q" defaultValue={q} placeholder="Ví dụ: điều hòa, TS-001, P.102..." className="input" />
          </label>

          <label className="form-group">
            <span className="label-sm">Nhóm tài sản</span>
            <select name="category" defaultValue={selectedCategory} className="input">
              <option value="">Tất cả nhóm</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="form-group">
            <span className="label-sm">Trạng thái</span>
            <select name="status" defaultValue={selectedStatus} className="input">
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang sử dụng</option>
              <option value="MAINTENANCE">Đang bảo trì</option>
              <option value="BROKEN">Hỏng</option>
              <option value="DISPOSED">Đã thanh lý</option>
            </select>
          </label>

          <label className="form-group">
            <span className="label-sm">Số dòng / trang</span>
            <select name="pageSize" defaultValue={String(pageSize)} className="input">
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} dòng
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary w-full">
              Lọc dữ liệu
            </button>
            <Link href="/assets" className="btn-ghost whitespace-nowrap">
              Xóa lọc
            </Link>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Dòng tài sản</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{total}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Số lượng hiện có</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{totalQuantity}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Giá trị ước tính</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{formatVnd(totalValue)}</p>
        </div>
        <div className={maintenanceCount > 0 || brokenCount > 0 ? "rounded-3xl border border-amber-200 bg-amber-50 p-6" : "stat-card"}>
          <p className={`text-xs font-semibold uppercase tracking-widest ${maintenanceCount > 0 || brokenCount > 0 ? "text-amber-700" : "text-ink-muted48"}`}>
            Cần chú ý
          </p>
          <p className={`mt-1 font-display text-2xl font-semibold tracking-tight ${maintenanceCount > 0 || brokenCount > 0 ? "text-amber-800" : ""}`}>
            {maintenanceCount} bảo trì
          </p>
          <p className={`mt-1 text-xs ${maintenanceCount > 0 || brokenCount > 0 ? "text-amber-700" : "text-ink-muted48"}`}>
            {brokenCount} thiết bị hỏng
          </p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Danh sách tài sản</h2>
            <p className="mt-1 text-sm text-ink-muted48">
              Tài sản được hiển thị theo nhóm, phòng, số lượng, đơn vị tính và giá trị từng đơn vị để dễ đối chiếu khi nhập mới hoặc kiểm kê.
            </p>
          </div>
          <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm text-ink-muted80">
            <p className="font-semibold text-ink">Quy ước</p>
            <p className="mt-1">Giá trị là giá của 1 đơn vị tài sản. Tổng giá trị = số lượng hiện có × giá trị / đơn vị.</p>
          </div>
        </div>

        <div className="mt-5 table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Tên tài sản</th>
                <th>Nhóm</th>
                <th>Phòng / vị trí</th>
                <th>Số lượng</th>
                <th>Đơn vị tính</th>
                <th>Giá trị / đơn vị</th>
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
                    <p className="mt-1 text-xs text-ink-muted48">{asset.assetCode ?? "Chưa có mã tài sản"}</p>
                  </td>
                  <td>{asset.category ?? "Chưa phân nhóm"}</td>
                  <td>{asset.room ?? "Chưa gán phòng"}</td>
                  <td>{asset.quantity}</td>
                  <td>{asset.unitName}</td>
                  <td>{asset.unitValue != null ? formatVnd(asset.unitValue) : "—"}</td>
                  <td className="font-medium">{formatVnd(asset.totalValue)}</td>
                  <td>
                    <span className={asset.status === "ACTIVE" ? "badge-green" : asset.status === "MAINTENANCE" ? "badge-amber" : asset.status === "BROKEN" ? "badge-red" : "badge-gray"}>
                      {ASSET_STATUS_LABEL[asset.status] ?? asset.status}
                    </span>
                  </td>
                  {(canManageAssets || canRemoveAssets) && (
                    <td>
                      <div className="flex items-center gap-2">
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
                  <td colSpan={9}>Không có tài sản nào khớp bộ lọc hiện tại.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-[#e6eefc] pt-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-ink-muted48">
            Trang {page}/{totalPages} • Hiển thị {rows.length} trên tổng {total} tài sản
          </p>
          <div className="pagination">
            <Link
              href={`/assets?q=${encodeURIComponent(q)}&category=${encodeURIComponent(selectedCategory)}&status=${encodeURIComponent(selectedStatus)}&page=${Math.max(1, page - 1)}&pageSize=${pageSize}`}
              className={page <= 1 ? "pagination-item pointer-events-none opacity-50" : "pagination-item"}
            >
              Trước
            </Link>
            <span className="pagination-item-active">{page}</span>
            <Link
              href={`/assets?q=${encodeURIComponent(q)}&category=${encodeURIComponent(selectedCategory)}&status=${encodeURIComponent(selectedStatus)}&page=${Math.min(totalPages, page + 1)}&pageSize=${pageSize}`}
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
