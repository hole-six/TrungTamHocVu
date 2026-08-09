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

const IMPORT_JOB_STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ xử lý",
  VALIDATING: "Đang kiểm tra",
  DRY_RUN: "Chạy thử",
  IMPORTED: "Đã nhập",
  FAILED: "Lỗi",
  ROLLED_BACK: "Đã hoàn tác",
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

const IMPORT_JOBS_PAGE_SIZE = 30;

function buildImportJobsHref(base: { status?: string }, page: number) {
  const params = new URLSearchParams();
  if (base.status) params.set("status", base.status);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/admin/imports${qs ? `?${qs}` : ""}`;
}

export default async function AdminImportsPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string };
}) {
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

  const statusFilter = searchParams.status?.trim() ?? "";
  const importJobPage = Math.max(1, Number(searchParams.page) || 1);
  const importJobWhere = statusFilter ? { status: statusFilter } : {};

  const [readiness, manifest, overrideSummary, remediationIndex, importJobTotal, importJobStatusCounts, importJobs] = await Promise.all([
    readJsonIfExists<ImportReadiness>(readinessPath),
    readJsonIfExists<ImportManifest>(manifestPath),
    readJsonIfExists<OverrideSummary>(overrideSummaryPath),
    readJsonIfExists<RemediationIndex>(remediationIndexPath),
    prisma.importJob.count({ where: importJobWhere }),
    // Badge tổng hợp theo trạng thái phải tính trên TOÀN BỘ tập đã lọc, không chỉ trang
    // hiện tại — cùng nguyên tắc đã áp dụng ở sổ quỹ/tài sản.
    prisma.importJob.groupBy({ by: ["status"], where: importJobWhere, _count: { _all: true } }),
    prisma.importJob.findMany({
      where: importJobWhere,
      include: {
        branch: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (importJobPage - 1) * IMPORT_JOBS_PAGE_SIZE,
      take: IMPORT_JOBS_PAGE_SIZE,
    }),
  ]);

  const importJobPageCount = Math.max(1, Math.ceil(importJobTotal / IMPORT_JOBS_PAGE_SIZE));
  const countByStatus = (status: string) => importJobStatusCounts.find((row) => row.status === status)?._count._all ?? 0;
  const importedCount = countByStatus("IMPORTED");
  const failedCount = countByStatus("FAILED");
  const validatingCount = countByStatus("VALIDATING");

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
        <div className="card p-0">
          <div className="border-b border-hairline px-4 py-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">Bộ file remediation</h2>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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

          {/* Mobile Cards */}
          <div className="space-y-3 px-4 py-4 md:hidden">
            {remediationIndex.tables.map((item) => (
              <div key={item.file} className="rounded-lg border border-hairline bg-white p-3">
                <p className="font-medium text-ink mb-2">{item.table}</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-ink-muted48">File:</span>
                    <span className="text-ink-muted80 font-medium">{item.file}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted48">Trạng thái:</span>
                    <span className="text-ink-muted80 font-medium">{item.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
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

      <div className="card p-0">
        <div className="flex flex-col gap-3 border-b border-hairline px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">Nhật ký ImportJob</h2>
          <form action="/admin/imports" method="GET" className="flex items-center gap-2">
            <select name="status" defaultValue={statusFilter} className="input h-9 text-xs">
              <option value="">Tất cả trạng thái</option>
              {Object.entries(IMPORT_JOB_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-ghost h-9 text-xs">
              Lọc
            </button>
            {statusFilter ? (
              <Link href="/admin/imports" className="btn-ghost h-9 text-xs">
                Xóa lọc
              </Link>
            ) : null}
          </form>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
                      {IMPORT_JOB_STATUS_LABEL[job.status] ?? job.status}
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

        {/* Mobile Cards */}
        <div className="space-y-3 px-4 py-4 lg:hidden">
          {importJobs.map((job) => (
            <div key={job.id} className="rounded-lg border border-hairline bg-white p-3">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1">
                  <p className="font-medium text-ink">{job.targetEntity}</p>
                  <p className="mt-0.5 text-xs text-ink-muted80">
                    {job.branch?.code} · {job.branch?.name}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${
                    job.status === "IMPORTED"
                      ? "bg-emerald-100 text-emerald-700"
                      : job.status === "FAILED"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {IMPORT_JOB_STATUS_LABEL[job.status] ?? job.status}
                </span>
              </div>
              <div className="border-t border-hairline pt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-muted48">Thời gian:</span>
                  <span className="text-ink-muted80 font-medium">{formatDateTime(job.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted48">Kết quả:</span>
                  <span className="text-ink-muted80 font-medium">
                    {job.successRows}/{job.totalRows} OK · {job.errorRows} lỗi
                  </span>
                </div>
              </div>
            </div>
          ))}
          {importJobs.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-ink-muted48">
              Chưa có ImportJob nào.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-hairline px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-muted48">{importJobTotal} bản ghi</p>
          {importJobPageCount > 1 ? (
            <div className="flex items-center gap-2">
              {importJobPage > 1 ? (
                <Link href={buildImportJobsHref({ status: statusFilter }, importJobPage - 1)} className="btn-ghost h-9 text-xs">
                  Trước
                </Link>
              ) : null}
              <span className="rounded-full border border-[#dbe7ff] bg-white px-3 py-1.5 text-xs font-semibold text-ink">
                Trang {importJobPage}/{importJobPageCount}
              </span>
              {importJobPage < importJobPageCount ? (
                <Link href={buildImportJobsHref({ status: statusFilter }, importJobPage + 1)} className="btn-ghost h-9 text-xs">
                  Sau
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {readiness?.blockedTables?.length ? (
        <div className="card p-0">
          <div className="border-b border-hairline px-4 py-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">Bảng đang bị chặn</h2>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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

          {/* Mobile Cards */}
          <div className="space-y-3 px-4 py-4 md:hidden">
            {readiness.blockedTables.slice(0, 10).map((item) => (
              <div key={item.table} className="rounded-lg border border-hairline bg-white p-3">
                <p className="font-medium text-ink mb-2">{item.table}</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-ink-muted48">Số dòng:</span>
                    <span className="text-ink-muted80 font-medium">{item.rowCount}</span>
                  </div>
                  <div className="border-t border-hairline pt-1.5">
                    <p className="text-ink-muted48 mb-1">Thiếu khóa chính:</p>
                    <p className="text-ink-muted64 font-medium">
                      {Object.entries(item.missingKeyCounts)
                        .slice(0, 3)
                        .map(([key, count]) => `${key}: ${count}`)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
