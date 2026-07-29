import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { ASSET_STATUS_LABEL } from "@/lib/server/asset-rules";
import NewAssetForm from "@/components/assets/NewAssetForm";

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

export default async function AssetsPage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await getCurrentUser();
  const q = searchParams.q?.trim() ?? "";

  const assets = await prisma.asset.findMany({
    where: {
      ...(user?.branchId ? { branchId: user.branchId } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { category: { contains: q } }, { room: { contains: q } }] } : {}),
    },
    orderBy: { name: "asc" },
    include: { transactions: { select: { quantity: true } } },
  });

  const totalValue = assets.reduce((s, a) => {
    const qty = a.transactions.reduce((sq, t) => sq + t.quantity, 0);
    return s + qty * (a.unitValue ?? 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tài sản & Trang thiết bị</h1>
          <p className="mt-1 text-sm text-ink-muted48">
            {assets.length} loại thiết bị · Tổng giá trị ước tính {formatVnd(totalValue)}
          </p>
        </div>
        <NewAssetForm />
      </div>

      <form className="card flex items-center gap-3" action="/assets">
        <input type="text" name="q" defaultValue={q} placeholder="Tìm theo tên, loại, phòng..." className="input max-w-xs" />
        <button type="submit" className="btn-ghost">
          Lọc
        </button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="px-4 py-3 font-medium">Tên thiết bị</th>
              <th className="px-4 py-3 font-medium">Loại</th>
              <th className="px-4 py-3 font-medium">Phòng</th>
              <th className="px-4 py-3 font-medium">Số lượng</th>
              <th className="px-4 py-3 font-medium">Giá trị/đơn vị</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => {
              const qty = a.transactions.reduce((s, t) => s + t.quantity, 0);
              return (
                <tr key={a.id} className="border-b border-hairline last:border-0 hover:bg-canvas-parchment/40">
                  <td className="px-4 py-3">
                    <Link href={`/assets/${a.id}`} className="font-medium text-primary">
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted80">{a.category ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-muted80">{a.room ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-muted80">{qty}</td>
                  <td className="px-4 py-3 text-ink-muted80">{a.unitValue ? formatVnd(a.unitValue) : "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge ${
                        a.status === "ACTIVE"
                          ? "bg-primary/10 text-primary"
                          : a.status === "BROKEN"
                            ? "bg-red-100 text-red-700"
                            : "bg-ink/5 text-ink-muted48"
                      }`}
                    >
                      {ASSET_STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {assets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-muted48">
                  Chưa có tài sản/thiết bị nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
