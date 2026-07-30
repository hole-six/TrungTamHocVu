import { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Theo dõi Import ERP",
};

type ImportReadiness = {
  readyTables: Array<{
    table: string;
    rowCount: number;
    rowsWithAllKeys: number;
  }>;
  partialTables: Array<{
    table: string;
    rowCount: number;
    rowsWithAnyKey: number;
  }>;
  blockedTables: Array<{
    table: string;
    rowCount: number;
    missingKeyCounts: Record<string, number>;
  }>;
  coreBlockers: string[];
};

type ImportManifest = {
  generatedAt: string;
  rawTableCounts: Record<string, number>;
  canonicalCounts: Record<string, number>;
  warnings: string[];
};

type OverrideSummary = {
  loaded: {
    filesRead: number;
    rowsApplied: number;
    tablesTouched: number;
  };
  applied: {
    rowsApplied: number;
    tablesTouched: number;
  };
  remediationTemplates: {
    filesWritten: number;
    tablesPrepared: number;
  };
};

type RemediationIndex = {
  generatedAt: string;
  tables: Array<{
    table: string;
    file: string;
    status: string;
  }>;
};

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function formatDateTime(value: Date | string | null) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString("vi-VN");
}

export default async function AdminImportsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const readinessPath = path.join(process.cwd(), "docs", "generated", "workbook_2026", "import_readiness.json");
  const manifestPath = path.join(process.cwd(), "docs", "generated", "workbook_2026", "manifest.json");
  const overrideSummaryPath = path.join(process.cwd(), "docs", "generated", "workbook_2026", "override_summary.json");
  const remediationIndexPath = path.join(process.cwd(), "docs", "generated", "workbook_2026", "remediation", "_index.json");

  const [readiness, manifest, overrideSummary, remediationIndex, importJobs] = await Promise.all([
    readJsonIfExists<ImportReadiness>(readinessPath),
    readJsonIfExists<ImportManifest>(manifestPath),
    readJsonIfExists<OverrideSummary>(overrideSummaryPath),
    readJsonIfExists<RemediationIndex>(remediationIndexPath),
    prisma.importJob.findMany({
      include: {
        branch: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const importedCount = importJobs.filter((item) => item.status === "IMPORTED").length;
  const failedCount = importJobs.filter((item) => item.status === "FAILED").length;
  const validatingCount = importJobs.filter((item) => item.status === "VALIDATING").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Theo dõi Import ERP
          </h1>
          <p className="mt-1 text-sm text-ink-muted48">
            Giám sát luồng import workbook, dữ liệu đã vào DB và các blocker còn lại.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/imports/remediation" className="btn-primary">
            Mở Remediation
          </Link>
          <Link href="/admin" className="btn-ghost">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Quay lại Admin
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="card">
          <p className="text-xs text-ink-muted48">Tổng ImportJob</p>
          <p className="mt-2 text-2xl font-bold text-ink">{importJobs.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-ink-muted48">Đã nhập thành công</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{importedCount}</p>
        </div>
        <div className="card">
          <p className="text-xs text-ink-muted48">Đang chờ/soát lỗi</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{validatingCount}</p>
        </div>
        <div className="card">
          <p className="text-xs text-ink-muted48">Đang bị chặn</p>
          <p className="mt-2 text-2xl font-bold text-red-600">{failedCount}</p>
        </div>
        <div className="card">
          <p className="text-xs text-ink-muted48">Lần phân tích gần nhất</p>
          <p className="mt-2 text-sm font-semibold text-ink">
            {manifest ? formatDateTime(manifest.generatedAt) : "Chưa có manifest"}
          </p>
        </div>
      </div>

      {overrideSummary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card">
            <p className="text-xs text-ink-muted48">Template remediation</p>
            <p className="mt-2 text-2xl font-bold text-ink">
              {overrideSummary.remediationTemplates.tablesPrepared}
            </p>
            <p className="mt-1 text-xs text-ink-muted48">
              {overrideSummary.remediationTemplates.filesWritten} file được sinh
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-ink-muted48">Override đã nạp</p>
            <p className="mt-2 text-2xl font-bold text-indigo-600">
              {overrideSummary.loaded.rowsApplied}
            </p>
            <p className="mt-1 text-xs text-ink-muted48">
              {overrideSummary.loaded.tablesTouched} bảng có remediation chạy
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-ink-muted48">Override áp vào raw tables</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {overrideSummary.applied.rowsApplied}
            </p>
            <p className="mt-1 text-xs text-ink-muted48">
              {overrideSummary.applied.tablesTouched} bảng đã merge
            </p>
          </div>
        </div>
      )}

      {readiness && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Import được ngay</h2>
            <div className="mt-3 space-y-2 text-sm">
              {readiness.readyTables.map((item) => (
                <div key={item.table} className="rounded-lg border border-hairline px-3 py-2">
                  <div className="font-medium text-ink">{item.table}</div>
                  <div className="text-xs text-ink-muted48">
                    {item.rowsWithAllKeys}/{item.rowCount} dòng đủ khóa
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Cần hoàn thiện thêm</h2>
            <div className="mt-3 space-y-2 text-sm">
              {readiness.partialTables.length === 0 ? (
                <p className="text-ink-muted48">Không có bảng ở trạng thái trung gian.</p>
              ) : (
                readiness.partialTables.map((item) => (
                  <div key={item.table} className="rounded-lg border border-hairline px-3 py-2">
                    <div className="font-medium text-ink">{item.table}</div>
                    <div className="text-xs text-ink-muted48">
                      {item.rowsWithAnyKey}/{item.rowCount} dòng có khóa một phần
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Blocker lõi</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted64">
              {readiness.coreBlockers.map((item) => (
                <li key={item} className="rounded-lg border border-hairline px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {remediationIndex?.tables?.length ? (
        <div className="card overflow-x-auto p-0">
          <div className="border-b border-hairline px-4 py-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">Bộ file remediation</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
              <tr>
                <th className="px-4 py-3 font-medium">Bảng</th>
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {remediationIndex.tables.map((item) => (
                <tr key={item.file} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{item.table}</td>
                  <td className="px-4 py-3 text-ink-muted80">{item.file}</td>
                  <td className="px-4 py-3 text-ink-muted80">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {manifest?.warnings?.length ? (
        <div className="card border border-amber-200 bg-amber-50">
          <h2 className="font-display text-lg font-semibold tracking-tight text-amber-900">Cảnh báo nguồn dữ liệu</h2>
          <ul className="mt-3 space-y-2 text-sm text-amber-900">
            {manifest.warnings.map((warning) => (
              <li key={warning}>- {warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="card overflow-x-auto p-0">
        <div className="border-b border-hairline px-4 py-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">Nhật ký ImportJob</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="px-4 py-3 font-medium">Thời gian</th>
              <th className="px-4 py-3 font-medium">Đối tượng</th>
              <th className="px-4 py-3 font-medium">Chi nhánh</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Kết quả</th>
            </tr>
          </thead>
          <tbody>
            {importJobs.map((job) => (
              <tr key={job.id} className="border-b border-hairline last:border-0">
                <td className="px-4 py-3 text-ink-muted80">{formatDateTime(job.createdAt)}</td>
                <td className="px-4 py-3 font-medium text-ink">{job.targetEntity}</td>
                <td className="px-4 py-3 text-ink-muted80">
                  {job.branch?.code} · {job.branch?.name}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-lg px-2 py-1 text-xs font-bold ${
                      job.status === "IMPORTED"
                        ? "bg-emerald-100 text-emerald-700"
                        : job.status === "FAILED"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {job.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-muted80">
                  {job.successRows}/{job.totalRows} OK · {job.errorRows} lỗi
                </td>
              </tr>
            ))}
            {importJobs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-muted48">
                  Chưa có ImportJob nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {readiness?.blockedTables?.length ? (
        <div className="card overflow-x-auto p-0">
          <div className="border-b border-hairline px-4 py-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">Bảng đang bị chặn</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
              <tr>
                <th className="px-4 py-3 font-medium">Bảng</th>
                <th className="px-4 py-3 font-medium">Số dòng</th>
                <th className="px-4 py-3 font-medium">Thiếu khóa chính</th>
              </tr>
            </thead>
            <tbody>
              {readiness.blockedTables.slice(0, 10).map((item) => (
                <tr key={item.table} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{item.table}</td>
                  <td className="px-4 py-3 text-ink-muted80">{item.rowCount}</td>
                  <td className="px-4 py-3 text-xs text-ink-muted64">
                    {Object.entries(item.missingKeyCounts)
                      .slice(0, 3)
                      .map(([key, count]) => `${key}: ${count}`)
                      .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
