"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RemediationTableDetail, RemediationTableSummary } from "@/lib/workbook-remediation";

type RemediationWorkbenchProps = {
  tables: RemediationTableSummary[];
  initialSelectedTable: RemediationTableDetail | null;
};

function formatReadinessStatus(status: RemediationTableSummary["readinessStatus"]) {
  if (status === "READY") return "Sẵn sàng";
  if (status === "PARTIAL") return "Bổ sung thêm";
  if (status === "BLOCKED") return "Đang bị chặn";
  return "Chưa rõ";
}

function statusClassName(status: RemediationTableSummary["readinessStatus"]) {
  if (status === "READY") return "bg-emerald-100 text-emerald-700";
  if (status === "PARTIAL") return "bg-amber-100 text-amber-700";
  if (status === "BLOCKED") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

export default function RemediationWorkbench({
  tables,
  initialSelectedTable,
}: RemediationWorkbenchProps) {
  const router = useRouter();
  const [selectedTableName, setSelectedTableName] = useState(initialSelectedTable?.table ?? tables[0]?.table ?? "");
  const [selectedTable, setSelectedTable] = useState(initialSelectedTable);
  const [csvContent, setCsvContent] = useState(initialSelectedTable?.csvContent ?? "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedSummary = useMemo(
    () => tables.find((item) => item.table === selectedTableName) ?? null,
    [selectedTableName, tables]
  );

  async function loadTable(tableName: string) {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/import-remediation?table=${encodeURIComponent(tableName)}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Không thể tải remediation.");
        return;
      }

      setSelectedTable(data.selectedTable ?? null);
      setCsvContent(data.selectedTable?.csvContent ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải remediation.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTableChange(tableName: string) {
    setSelectedTableName(tableName);
    await loadTable(tableName);
  }

  async function handleSave() {
    if (!selectedTableName) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/import-remediation", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          table: selectedTableName,
          csvContent,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Không thể lưu remediation.");
        return;
      }

      setSelectedTable(data.item);
      setCsvContent(data.item.csvContent);
      setMessage("Đã lưu remediation. Có thể chạy lại pipeline để nạp dữ liệu mới.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu remediation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Remediation ERP</h1>
          <p className="mt-1 text-sm text-ink-muted48">
            Bổ sung khóa thiếu cho workbook để mở khóa import CRM, đào tạo, học phí và kho.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/imports" className="btn-ghost">
            Quay lại Import ERP
          </Link>
          <button
            type="button"
            onClick={() => void loadTable(selectedTableName)}
            className="btn-primary"
            disabled={!selectedTableName || loading}
          >
            {loading ? "Đang tải..." : "Tải lại bảng"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="card xl:col-span-1">
          <label className="text-xs font-medium uppercase tracking-wide text-ink-muted48">
            Bảng remediation
          </label>
          <select
            value={selectedTableName}
            onChange={(event) => void handleTableChange(event.target.value)}
            className="input mt-2"
          >
            {tables.map((item) => (
              <option key={item.table} value={item.table}>
                {item.table}
              </option>
            ))}
          </select>

          <div className="mt-4 space-y-3">
            {tables.map((item) => (
              <button
                key={item.table}
                type="button"
                onClick={() => void handleTableChange(item.table)}
                className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                  item.table === selectedTableName ? "border-ink bg-canvas-parchment/60" : "border-hairline hover:border-ink/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{item.table}</p>
                    <p className="mt-1 text-xs text-ink-muted48">{item.file}</p>
                  </div>
                  <span className={`inline-flex rounded-lg px-2 py-1 text-[11px] font-bold ${statusClassName(item.readinessStatus)}`}>
                    {formatReadinessStatus(item.readinessStatus)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-muted64">
                  {item.activeOverrideRows}/{item.rowCount} dòng đã có dữ liệu bổ sung
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 xl:col-span-3">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="card">
              <p className="text-xs text-ink-muted48">Trạng thái</p>
              <p className={`mt-2 inline-flex rounded-lg px-2 py-1 text-xs font-bold ${statusClassName(selectedSummary?.readinessStatus ?? "UNKNOWN")}`}>
                {formatReadinessStatus(selectedSummary?.readinessStatus ?? "UNKNOWN")}
              </p>
            </div>
            <div className="card">
              <p className="text-xs text-ink-muted48">Tổng dòng</p>
              <p className="mt-2 text-2xl font-bold text-ink">{selectedTable?.rowCount ?? selectedSummary?.rowCount ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-xs text-ink-muted48">Dòng override</p>
              <p className="mt-2 text-2xl font-bold text-indigo-600">
                {selectedTable?.activeOverrideRows ?? selectedSummary?.activeOverrideRows ?? 0}
              </p>
            </div>
            <div className="card">
              <p className="text-xs text-ink-muted48">Số cột</p>
              <p className="mt-2 text-2xl font-bold text-ink">{selectedTable?.headers.length ?? selectedSummary?.headers.length ?? 0}</p>
            </div>
          </div>

          {selectedSummary?.missingKeyCounts && Object.keys(selectedSummary.missingKeyCounts).length > 0 ? (
            <div className="card border border-amber-200 bg-amber-50">
              <h2 className="font-display text-lg font-semibold tracking-tight text-amber-900">
                Khóa còn thiếu cần bổ sung
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(selectedSummary.missingKeyCounts).map(([key, count]) => (
                  <span key={key} className="rounded-lg bg-white px-3 py-2 text-sm text-amber-900">
                    {key}: {count}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="card">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">CSV remediation</h2>
                <p className="mt-1 text-sm text-ink-muted48">
                  Giữ cột `sourceRow`, điền thêm khóa nghiệp vụ và bật `applyOverride` khi muốn merge vào pipeline.
                </p>
              </div>
              <button type="button" onClick={handleSave} className="btn-primary" disabled={saving || loading || !selectedTableName}>
                {saving ? "Đang lưu..." : "Lưu remediation"}
              </button>
            </div>

            <textarea
              value={csvContent}
              onChange={(event) => setCsvContent(event.target.value)}
              className="mt-4 min-h-[420px] w-full rounded-xl border border-hairline bg-white px-4 py-3 font-mono text-xs text-ink outline-none focus:border-ink/30"
              spellCheck={false}
            />

            {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="card">
              <h2 className="font-display text-lg font-semibold tracking-tight">Xem nhanh dữ liệu đã điền</h2>
              {selectedTable?.previewRows.length ? (
                <div className="mt-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-hairline text-ink-muted48">
                      <tr>
                        {selectedTable.headers.slice(0, 6).map((header) => (
                          <th key={header} className="px-2 py-2 font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTable.previewRows.slice(0, 8).map((row, index) => (
                        <tr key={`${row.sourceRow ?? index}-${index}`} className="border-b border-hairline last:border-0">
                          {selectedTable.headers.slice(0, 6).map((header) => (
                            <td key={header} className="px-2 py-2 text-ink-muted80">
                              {row[header] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-3 text-sm text-ink-muted48">
                  Bảng này chưa có override thực tế. Sau khi điền xong, preview sẽ hiện ngay tại đây.
                </p>
              )}
            </div>

            <div className="card">
              <h2 className="font-display text-lg font-semibold tracking-tight">Bước vận hành tiếp theo</h2>
              <ul className="mt-3 space-y-2 text-sm text-ink-muted80">
                <li>- Điền các mã còn thiếu theo đúng quan hệ lớp, học viên, thu/chi hoặc kho.</li>
                <li>- Bật `applyOverride` cho các dòng cần merge vào dữ liệu gốc.</li>
                <li>- Chạy lại pipeline: `npm run pipeline:workbook -- --apply --output "docs/generated/workbook_2026"`.</li>
                <li>- Quay về trang import để theo dõi `ImportJob` và blocker đã giảm hay chưa.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
