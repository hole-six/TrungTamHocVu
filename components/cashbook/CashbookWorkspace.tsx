"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import NewCashTransactionForm from "@/components/cashbook/NewCashTransactionForm";
import CategoryManager from "@/components/cashbook/CategoryManager";
import CashTransactionRow from "@/components/cashbook/CashTransactionRow";
import {
  getCreateSnapshotButtonLabel,
  getLiveFallbackLabel,
  getReportEffectiveBadge,
  getReportModeLabel,
  getSnapshotTimestampLabel,
} from "@/lib/reporting-ui";
import { exportSectionsToExcel } from "@/lib/export-utils";

type Category = { id: string; type: string; name: string; detail: string | null; notes: string | null };

type CashbookSummaryResponse = {
  meta: {
    requestedMode: "live" | "snapshot";
    effectiveMode: "live" | "snapshot";
    filters: {
      mode: "live" | "snapshot";
      periodKey: string | null;
      status: string | null;
    };
    snapshotReady: boolean;
    snapshotId: string | null;
    snapshotAt: string | null;
    periodKey: string | null;
  };
  transactions: Array<{
    id: string;
    txnDate: string;
    type: "THU" | "CHI";
    amount: number;
    description: string | null;
    detail: string | null;
    notes: string | null;
    attachmentUrl: string | null;
    status: string;
    categoryId: string | null;
    categoryName: string | null;
    handledByName: string | null;
    isDerived: boolean;
  }>;
  categories: Category[];
  totals: {
    totalThu: number;
    totalChi: number;
    balance: number;
  };
  byCategory: Array<{ name: string; thu: number; chi: number }>;
};

function formatVnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

function getDefaultPeriodKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function CashbookWorkspace({
  canManageCashbook,
  canCreateCashbook,
}: {
  canManageCashbook: boolean;
  canCreateCashbook: boolean;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [data, setData] = useState<CashbookSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"live" | "snapshot">((searchParams.get("mode") as "live" | "snapshot") ?? "live");
  const [periodKey, setPeriodKey] = useState(searchParams.get("periodKey") ?? getDefaultPeriodKey());
  const [typeFilter, setTypeFilter] = useState(searchParams.get("status") ?? "");

  const queryString = useMemo(() => searchParams.toString(), [searchParams]);

  useEffect(() => {
    setMode((searchParams.get("mode") as "live" | "snapshot") ?? "live");
    setPeriodKey(searchParams.get("periodKey") ?? getDefaultPeriodKey());
    setTypeFilter(searchParams.get("status") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/cashbook/summary?${queryString}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Không tải được dữ liệu thu chi.");
        }
        return response.json();
      })
      .then((payload: CashbookSummaryResponse) => setData(payload))
      .catch((fetchError: Error) => {
        if (fetchError.name !== "AbortError") setError(fetchError.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [queryString]);

  const applyFilters = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("mode", mode);
    next.set("periodKey", periodKey);
    next.set("timePreset", mode === "snapshot" ? "current_period" : "this_month");
    if (typeFilter) next.set("status", typeFilter);
    else next.delete("status");
    router.push(`${pathname}?${next.toString()}`);
  };

  const createSnapshot = async () => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("mode", "snapshot");
    next.set("periodKey", periodKey);
    next.set("timePreset", "current_period");
    if (typeFilter) next.set("status", typeFilter);

    setCreatingSnapshot(true);
    setError(null);
    try {
      const response = await fetch(`/api/cashbook/summary?${next.toString()}`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Không chốt được dữ liệu thu chi kỳ này.");
      router.push(`${pathname}?${next.toString()}`);
      router.refresh();
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : "Không chốt được dữ liệu thu chi kỳ này.");
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleExport = () => {
    if (!data) return;

    exportSectionsToExcel(
      [
        {
          title: "Tổng quan thu chi",
          columns: [
            { key: "metric", label: "Chỉ số" },
            { key: "value", label: "Giá trị" },
          ],
          rows: [
            { metric: "Kỳ báo cáo", value: data.meta.periodKey ?? periodKey },
            { metric: "Chế độ dữ liệu", value: data.meta.effectiveMode === "snapshot" ? "Kỳ đã chốt" : "Dữ liệu hiện tại" },
            { metric: "Loại phiếu lọc", value: typeFilter || "Tất cả" },
            { metric: "Tổng thu", value: formatVnd(data.totals.totalThu) },
            { metric: "Tổng chi", value: formatVnd(data.totals.totalChi) },
            { metric: "Số dư quỹ", value: formatVnd(data.totals.balance) },
          ],
        },
        {
          title: "Tổng hợp theo danh mục",
          columns: [
            { key: "name", label: "Danh mục" },
            { key: "thu", label: "Thu" },
            { key: "chi", label: "Chi" },
            { key: "balance", label: "Chênh lệch" },
          ],
          rows: data.byCategory.map((item) => ({
            name: item.name,
            thu: formatVnd(item.thu),
            chi: formatVnd(item.chi),
            balance: formatVnd(item.thu - item.chi),
          })),
        },
        {
          title: "Danh sách phiếu thu chi",
          columns: [
            { key: "txnDate", label: "Ngày" },
            { key: "type", label: "Loại" },
            { key: "categoryName", label: "Danh mục" },
            { key: "amount", label: "Số tiền" },
            { key: "description", label: "Diễn giải" },
            { key: "status", label: "Trạng thái" },
          ],
          rows: data.transactions.map((item) => ({
            txnDate: formatDate(item.txnDate),
            type: item.type,
            categoryName: item.categoryName ?? "",
            amount: formatVnd(item.amount),
            description: item.description ?? "",
            status: item.status,
          })),
        },
      ],
      `thu-chi_${data.meta.periodKey ?? periodKey}_${data.meta.effectiveMode}`,
      "ThuChi",
    );
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="page-title">Thu chi</h1>
            <p className="page-subtitle">Theo dõi phiếu thu chi, số dư quỹ và bản đã chốt theo kỳ.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canCreateCashbook && data ? <NewCashTransactionForm categories={data.categories} /> : null}
            <button onClick={handleExport} disabled={!data} className="btn-ghost">
              Xuất Excel
            </button>
            {canManageCashbook ? (
              <button onClick={createSnapshot} disabled={creatingSnapshot} className="btn-ghost">
                {getCreateSnapshotButtonLabel("cashbook", creatingSnapshot)}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Chế độ dữ liệu</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as "live" | "snapshot")} className="input">
              <option value="live">{getReportModeLabel("live")}</option>
              <option value="snapshot">{getReportModeLabel("snapshot")}</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Kỳ báo cáo</span>
            <input type="month" value={periodKey} onChange={(event) => setPeriodKey(event.target.value)} className="input" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Loại phiếu</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="input">
              <option value="">Tất cả</option>
              <option value="THU">Thu</option>
              <option value="CHI">Chi</option>
            </select>
          </label>
          <div className="flex items-end">
            <button onClick={applyFilters} className="btn-primary w-full">Xem dữ liệu</button>
          </div>
        </div>

        {data?.meta ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className={`badge ${data.meta.effectiveMode === "snapshot" ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
              {getReportEffectiveBadge(data.meta.effectiveMode, "cashbook")}
            </span>
            <span className="badge bg-ink/5 text-ink-muted80">Kỳ: {data.meta.periodKey ?? periodKey}</span>
            {data.meta.snapshotAt ? (
              <span className="badge bg-emerald-100 text-emerald-700">{getSnapshotTimestampLabel("cashbook", data.meta.snapshotAt)}</span>
            ) : (
              <span className="badge bg-ink/5 text-ink-muted80">{getLiveFallbackLabel("cashbook")}</span>
            )}
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>

      {loading || !data ? (
        <div className="card">
          <p className="text-sm text-ink-muted48">Đang tải dữ liệu thu chi...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Tổng thu</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-emerald-600">{formatVnd(data.totals.totalThu)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Tổng chi</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-red-600">{formatVnd(data.totals.totalChi)}</p>
            </div>
            <div className="stat-card-accent">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Số dư quỹ</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">{formatVnd(data.totals.balance)}</p>
            </div>
          </div>

          {canManageCashbook ? <CategoryManager categories={data.categories} /> : null}

          <div className="card overflow-x-auto">
            <h2 className="font-display text-lg font-semibold tracking-tight">Tổng hợp theo danh mục</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                <tr>
                  <th className="py-2 font-medium">Danh mục</th>
                  <th className="py-2 font-medium">Thu</th>
                  <th className="py-2 font-medium">Chi</th>
                  <th className="py-2 font-medium">Chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                {data.byCategory.map((item) => (
                  <tr key={item.name} className="border-b border-hairline last:border-0">
                    <td className="py-2 font-medium">{item.name}</td>
                    <td className="py-2 text-emerald-600">{formatVnd(item.thu)}</td>
                    <td className="py-2 text-red-600">{formatVnd(item.chi)}</td>
                    <td className={`py-2 font-medium ${item.thu - item.chi >= 0 ? "text-primary" : "text-red-600"}`}>{formatVnd(item.thu - item.chi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Loại</th>
                  <th>Danh mục</th>
                  <th>Diễn giải</th>
                  <th>Số tiền</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((transaction) => (
                  <CashTransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    categories={data.categories}
                    canManageCashbook={canManageCashbook}
                  />
                ))}
                {data.transactions.length === 0 && (
                  <tr className="table-empty">
                    <td colSpan={7}>Chưa có phiếu thu/chi nào.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
