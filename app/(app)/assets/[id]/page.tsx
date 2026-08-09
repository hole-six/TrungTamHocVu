import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ASSET_STATUS_LABEL, ASSET_TXN_TYPE_LABEL, computeAssetTotalValue } from "@/lib/server/asset-rules";
import AssetTransactionForm from "@/components/assets/AssetTransactionForm";
import AssetEditForm from "@/components/assets/AssetEditForm";
import DeleteAssetButton from "@/components/assets/DeleteAssetButton";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate, canDelete } from "@/lib/server/role-matrix";

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}
function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("vi-VN");
}
function unitLabel(unitName: string | null) {
  return unitName?.trim() || "cái";
}

export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  const asset = await prisma.asset.findUnique({
    where: { id: params.id },
    include: { transactions: { orderBy: { txnDate: "desc" } } },
  });
  if (!asset) notFound();

  const currentUser = await getCurrentUser();
  const role = currentUser ? await getUserRole(currentUser.id) : null;
  const canManageAsset = canUpdate("assets", role);
  const canRemoveAsset = canDelete("assets", role);

  const quantity = asset.transactions.reduce((s, t) => s + t.quantity, 0);
  const baseValue = quantity * (asset.unitValue ?? 0);
  const maintenanceValue = asset.transactions
    .filter((transaction) => transaction.type === "MAINTENANCE")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalValue = computeAssetTotalValue(asset.unitValue, quantity, asset.transactions);
  const unitName = unitLabel(asset.unitName);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Link href="/assets" className="text-sm text-primary">
          ← Quay lại Tài sản & Trang thiết bị
        </Link>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{asset.name}</h1>
              <p className="mt-1 text-sm text-ink-muted48">
                {asset.assetCode && <>Mã <strong>{asset.assetCode}</strong> · </>}
                {asset.category ?? "Chưa phân loại"} {asset.room && `· ${asset.room}`} · Đơn vị tính {unitName}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 font-medium text-sky-700">Số lượng {quantity}</span>
              <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 font-medium text-violet-700">Tổng giá trị {formatVnd(totalValue)}</span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-medium text-amber-700">Bảo dưỡng {formatVnd(maintenanceValue)}</span>
              <span
                className={`rounded-full border px-3 py-1 font-medium ${
                  asset.status === "ACTIVE"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : asset.status === "BROKEN"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-slate-200 bg-slate-100 text-slate-600"
                }`}
              >
                {ASSET_STATUS_LABEL[asset.status] ?? asset.status}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/assets" className="btn-ghost">
              Danh sách TS
            </Link>
            {canRemoveAsset && <DeleteAssetButton assetId={asset.id} assetName={asset.name} redirectTo="/assets" />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Số lượng hiện có</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{quantity} {unitName}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Giá trị/đơn vị</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{asset.unitValue ? formatVnd(asset.unitValue) : "—"}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Giá trị gốc</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatVnd(baseValue)}</p>
          <p className="mt-1 text-xs text-ink-muted48">Số lượng × giá trị / đơn vị</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Đã chi bảo dưỡng</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-amber-700">{formatVnd(maintenanceValue)}</p>
          <p className="mt-1 text-xs text-ink-muted48">{asset.transactions.filter((transaction) => transaction.type === "MAINTENANCE").length} lần bảo dưỡng</p>
        </div>
        <div className="card sm:col-span-2 xl:col-span-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Tổng giá trị</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatVnd(totalValue)}</p>
          <p className="mt-1 text-xs text-ink-muted48">Giá trị gốc + toàn bộ tiền bảo dưỡng đã ghi nhận</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold tracking-tight">Lịch sử giao dịch</h2>
              <span className="badge bg-ink/5 text-ink-muted80">{asset.transactions.length} dòng</span>
            </div>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                <tr>
                  <th className="py-2 font-medium">Ngày</th>
                  <th className="py-2 font-medium">Loại</th>
                  <th className="py-2 font-medium">Phát sinh</th>
                  <th className="py-2 font-medium">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {asset.transactions.map((t) => (
                  <tr key={t.id} className="border-b border-hairline last:border-0">
                    <td className="py-2">{formatDate(t.txnDate)}</td>
                    <td className="py-2 text-ink-muted80">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            t.type === "MAINTENANCE"
                              ? "bg-amber-100 text-amber-700"
                              : t.type === "DISPOSAL"
                                ? "bg-rose-100 text-rose-700"
                                : t.type === "RECEIPT"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {ASSET_TXN_TYPE_LABEL[t.type] ?? t.type}
                        </span>
                        {t.toRoom ? <span className="text-xs text-ink-muted48">→ {t.toRoom}</span> : null}
                      </div>
                    </td>
                    <td className="py-2 font-medium">
                      {t.type === "MAINTENANCE" ? (
                        t.amount > 0 ? (
                          <div>
                            <p className="font-semibold text-amber-700">{formatVnd(t.amount)}</p>
                            <p className="text-xs text-ink-muted48">Tiền bảo dưỡng</p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-semibold text-emerald-700">Tự bảo dưỡng</p>
                            <p className="text-xs text-ink-muted48">Không mất chi phí</p>
                          </div>
                        )
                      ) : (
                        <div>
                          <p className="font-semibold text-ink">{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</p>
                          <p className="text-xs text-ink-muted48">Số lượng</p>
                        </div>
                      )}
                    </td>
                    <td className="py-2 text-ink-muted48">{t.notes ?? "—"}</td>
                  </tr>
                ))}
                {asset.transactions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-ink-muted48">
                      Chưa có giao dịch nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {canManageAsset && <AssetTransactionForm assetId={asset.id} assetName={asset.name} />}
        </div>

        {canManageAsset && (
          <AssetEditForm
            assetId={asset.id}
            initial={{
              status: asset.status,
              name: asset.name,
              category: asset.category ?? "",
              room: asset.room ?? "",
              unitName: asset.unitName ?? "cái",
              unitValue: asset.unitValue?.toString() ?? "",
              notes: asset.notes ?? "",
            }}
          />
        )}
      </div>
    </div>
  );
}
