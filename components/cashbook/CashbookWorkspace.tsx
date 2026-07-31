"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CategoryManager from "@/components/cashbook/CategoryManager";
import CashTransactionRow from "@/components/cashbook/CashTransactionRow";
import NewCashTransactionForm from "@/components/cashbook/NewCashTransactionForm";
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

function formatVnd(amount: number) {
  return `${amount.toLocaleString("vi-VN")}đ`;
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
          title: "Tong quan thu chi",
          columns: [
            { key: "metric", label: "Chi so" },
            { key: "value", label: "Gia tri" },
          ],
          rows: [
            { metric: "Ky bao cao", value: data.meta.periodKey ?? periodKey },
            { metric: "Che do du lieu", value: data.meta.effectiveMode === "snapshot" ? "Ky da chot" : "Du lieu hien tai" },
            { metric: "Loai phieu loc", value: typeFilter || "Tat ca" },
            { metric: "Tong thu", value: formatVnd(data.totals.totalThu) },
            { metric: "Tong chi", value: formatVnd(data.totals.totalChi) },
            { metric: "So du quy", value: formatVnd(data.totals.balance) },
          ],
        },
        {
          title: "Tong hop theo danh muc",
          columns: [
            { key: "name", label: "Danh muc" },
            { key: "thu", label: "Thu" },
            { key: "chi", label: "Chi" },
            { key: "balance", label: "Chenh lech" },
          ],
          rows: data.byCategory.map((item) => ({
            name: item.name,
            thu: formatVnd(item.thu),
            chi: formatVnd(item.chi),
            balance: formatVnd(item.thu - item.chi),
          })),
        },
        {
          title: "So giao dich thu chi",
          columns: [
            { key: "txnDate", label: "Ngay" },
            { key: "type", label: "Loai" },
            { key: "categoryName", label: "Danh muc" },
            { key: "amountIn", label: "Thu vao" },
            { key: "amountOut", label: "Chi ra" },
            { key: "description", label: "Dien giai" },
            { key: "status", label: "Trang thai" },
          ],
          rows: data.transactions.map((item) => ({
            txnDate: formatDate(item.txnDate),
            type: item.type,
            categoryName: item.categoryName ?? "",
            amountIn: item.type === "THU" ? formatVnd(item.amount) : "",
            amountOut: item.type === "CHI" ? formatVnd(item.amount) : "",
            description: item.description ?? "",
            status: item.status,
          })),
        },
      ],
      `thu-chi_${data.meta.periodKey ?? periodKey}_${data.meta.effectiveMode}`,
      "ThuChi",
    );
  };

  const derivedStats = useMemo(() => {
    if (!data) {
      return {
        thuCategories: [] as Array<{ name: string; amount: number }>,
        chiCategories: [] as Array<{ name: string; amount: number }>,
        visibleTransactions: 0,
        confirmedTransactions: 0,
        voidedTransactions: 0,
        autoPostedTransactions: 0,
      };
    }

    return {
      thuCategories: data.byCategory
        .filter((item) => item.thu > 0)
        .map((item) => ({ name: item.name, amount: item.thu }))
        .sort((left, right) => right.amount - left.amount),
      chiCategories: data.byCategory
        .filter((item) => item.chi > 0)
        .map((item) => ({ name: item.name, amount: item.chi }))
        .sort((left, right) => right.amount - left.amount),
      visibleTransactions: data.transactions.length,
      confirmedTransactions: data.transactions.filter((item) => item.status === "CONFIRMED").length,
      voidedTransactions: data.transactions.filter((item) => item.status === "VOIDED").length,
      autoPostedTransactions: data.transactions.filter((item) => item.isDerived).length,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f8fcff_0%,#eef7ff_42%,#ffffff_100%)] p-6 shadow-[0_28px_80px_-48px_rgba(14,116,144,0.45)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <span className="inline-flex w-fit rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              Sổ quỹ theo kỳ
            </span>
            <div>
              <h1 className="page-title">Thu chi tiền mặt</h1>
              <p className="page-subtitle max-w-3xl">
                Màn này phải trả lời rõ 3 câu hỏi: kỳ này thu vào bao nhiêu, chi ra bao nhiêu, và từng khoản tiền đang nằm ở nhóm nào.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canCreateCashbook && data ? <NewCashTransactionForm categories={data.categories} /> : null}
            <button onClick={handleExport} disabled={!data} className="btn-secondary">
              Xuất Excel
            </button>
            {canManageCashbook ? (
              <button onClick={createSnapshot} disabled={creatingSnapshot} className="btn-ghost">
                {getCreateSnapshotButtonLabel("cashbook", creatingSnapshot)}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <label className="form-group">
            <span className="label-sm">Chế độ dữ liệu</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as "live" | "snapshot")} className="input">
              <option value="live">{getReportModeLabel("live")}</option>
              <option value="snapshot">{getReportModeLabel("snapshot")}</option>
            </select>
          </label>
          <label className="form-group">
            <span className="label-sm">Kỳ báo cáo</span>
            <input type="month" value={periodKey} onChange={(event) => setPeriodKey(event.target.value)} className="input" />
          </label>
          <label className="form-group">
            <span className="label-sm">Lọc loại phiếu</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="input">
              <option value="">Tất cả giao dịch</option>
              <option value="THU">Chỉ thu vào</option>
              <option value="CHI">Chỉ chi ra</option>
            </select>
          </label>
          <div className="flex items-end">
            <button onClick={applyFilters} className="btn-primary w-full">
              Xem sổ quỹ
            </button>
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Tổng thu vào</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-emerald-600">{formatVnd(data.totals.totalThu)}</p>
              <p className="mt-2 text-sm text-ink-muted48">{derivedStats.thuCategories.length} nhóm thu phát sinh trong kỳ</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Tổng chi ra</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-rose-600">{formatVnd(data.totals.totalChi)}</p>
              <p className="mt-2 text-sm text-ink-muted48">{derivedStats.chiCategories.length} nhóm chi phát sinh trong kỳ</p>
            </div>
            <div className="stat-card-accent">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Số dư quỹ</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">{formatVnd(data.totals.balance)}</p>
              <p className="mt-2 text-sm text-white/80">Cân đối thực còn sau khi trừ toàn bộ khoản chi</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Giao dịch trong kỳ</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">{derivedStats.visibleTransactions}</p>
              <p className="mt-2 text-sm text-ink-muted48">
                {derivedStats.confirmedTransactions} xác nhận · {derivedStats.voidedTransactions} hủy · {derivedStats.autoPostedTransactions} tự sinh
              </p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight">Bảng tổng hợp dòng tiền theo nhóm</h2>
                  <p className="mt-1 text-sm text-ink-muted48">
                    Đọc như file gốc: tiền được tách rõ thành 2 nhánh thu vào và chi ra, sau đó mới nhìn đến danh mục.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm text-ink-muted80">
                  <p className="font-semibold text-ink">Nguyên tắc hiển thị</p>
                  <p className="mt-1">Không trộn danh mục cấu hình với bảng tiền. Danh mục chỉ là lớp phân loại của dòng tiền.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[26px] border border-emerald-100 bg-emerald-50/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Thu vào</p>
                      <p className="mt-1 text-lg font-semibold text-emerald-700">{formatVnd(data.totals.totalThu)}</p>
                    </div>
                    <span className="badge bg-white text-emerald-700">{derivedStats.thuCategories.length} nhóm thu</span>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-100 bg-white">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-emerald-100 bg-emerald-50 text-xs uppercase tracking-wide text-emerald-700">
                        <tr>
                          <th className="px-4 py-3 font-medium">Loại thu</th>
                          <th className="px-4 py-3 text-right font-medium">Số tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {derivedStats.thuCategories.map((item) => (
                          <tr key={item.name} className="border-b border-[#eef5ef] last:border-0">
                            <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatVnd(item.amount)}</td>
                          </tr>
                        ))}
                        {derivedStats.thuCategories.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-4 py-4 text-center text-ink-muted48">
                              Kỳ này chưa có khoản thu nào.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-[26px] border border-rose-100 bg-rose-50/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Chi ra</p>
                      <p className="mt-1 text-lg font-semibold text-rose-700">{formatVnd(data.totals.totalChi)}</p>
                    </div>
                    <span className="badge bg-white text-rose-700">{derivedStats.chiCategories.length} nhóm chi</span>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-rose-100 bg-white">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-rose-100 bg-rose-50 text-xs uppercase tracking-wide text-rose-700">
                        <tr>
                          <th className="px-4 py-3 font-medium">Loại chi</th>
                          <th className="px-4 py-3 text-right font-medium">Số tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {derivedStats.chiCategories.map((item) => (
                          <tr key={item.name} className="border-b border-[#f7e8ea] last:border-0">
                            <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                            <td className="px-4 py-3 text-right font-semibold text-rose-700">{formatVnd(item.amount)}</td>
                          </tr>
                        ))}
                        {derivedStats.chiCategories.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-4 py-4 text-center text-ink-muted48">
                              Kỳ này chưa có khoản chi nào.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {canManageCashbook ? <CategoryManager categories={data.categories} /> : null}
          </div>

          <div className="card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">Sổ giao dịch thu chi chi tiết</h2>
                <p className="mt-1 text-sm text-ink-muted48">
                  Đây là bảng chính để đối chiếu tiền. Mỗi dòng là một nghiệp vụ, tách riêng cột thu vào và chi ra để tránh nhìn nhầm.
                </p>
              </div>
              <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm text-ink-muted80">
                <p className="font-semibold text-ink">Cách đọc nhanh</p>
                <p className="mt-1">Cột nào có số là hướng của dòng tiền. Thu vào không hiển thị ở cột chi ra và ngược lại.</p>
              </div>
            </div>

            <div className="mt-5 table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Loại phiếu</th>
                    <th>Danh mục</th>
                    <th>Nội dung thu chi</th>
                    <th className="text-right">Thu vào</th>
                    <th className="text-right">Chi ra</th>
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
                  {data.transactions.length === 0 ? (
                    <tr className="table-empty">
                      <td colSpan={8}>Chưa có phiếu thu/chi nào trong kỳ đang xem.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
