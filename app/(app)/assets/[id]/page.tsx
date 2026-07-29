import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ASSET_STATUS_LABEL, ASSET_TXN_TYPE_LABEL } from "@/lib/server/asset-rules";
import AssetTransactionForm from "@/components/assets/AssetTransactionForm";
import AssetEditForm from "@/components/assets/AssetEditForm";

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}
function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("vi-VN");
}

export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  const asset = await prisma.asset.findUnique({
    where: { id: params.id },
    include: { transactions: { orderBy: { txnDate: "desc" } } },
  });
  if (!asset) notFound();

  const quantity = asset.transactions.reduce((s, t) => s + t.quantity, 0);
  const totalValue = quantity * (asset.unitValue ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/assets" className="text-sm text-primary">
          ← Quay lại Tài sản & Trang thiết bị
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{asset.name}</h1>
            <p className="mt-1 text-sm text-ink-muted48">
              {asset.category ?? "Chưa phân loại"} {asset.room && `· ${asset.room}`}
            </p>
          </div>
          <span
            className={`badge ${asset.status === "ACTIVE" ? "bg-primary/10 text-primary" : asset.status === "BROKEN" ? "bg-red-100 text-red-700" : "bg-ink/5 text-ink-muted48"}`}
          >
            {ASSET_STATUS_LABEL[asset.status] ?? asset.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Số lượng hiện có</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{quantity}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Giá trị/đơn vị</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{asset.unitValue ? formatVnd(asset.unitValue) : "—"}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Tổng giá trị</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatVnd(totalValue)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card overflow-x-auto">
            <h2 className="font-display text-lg font-semibold tracking-tight">Lịch sử giao dịch</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                <tr>
                  <th className="py-2 font-medium">Ngày</th>
                  <th className="py-2 font-medium">Loại</th>
                  <th className="py-2 font-medium">Số lượng</th>
                  <th className="py-2 font-medium">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {asset.transactions.map((t) => (
                  <tr key={t.id} className="border-b border-hairline last:border-0">
                    <td className="py-2">{formatDate(t.txnDate)}</td>
                    <td className="py-2 text-ink-muted80">
                      {ASSET_TXN_TYPE_LABEL[t.type] ?? t.type} {t.toRoom && `→ ${t.toRoom}`}
                    </td>
                    <td className="py-2 font-medium">{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
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

          <AssetTransactionForm assetId={asset.id} />
        </div>

        <AssetEditForm
          assetId={asset.id}
          initial={{ status: asset.status, room: asset.room ?? "", notes: asset.notes ?? "" }}
        />
      </div>
    </div>
  );
}
