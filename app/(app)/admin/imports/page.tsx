import { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import RemediationFilesTable from "./RemediationFilesTable";
import ImportJobsTable from "./ImportJobsTable";
import BlockedTablesTable from "./BlockedTablesTable";

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

export default async function AdminImportsPage({
  searchParams,
}: {
  searchParams: { page?: string; pageSize?: string; status?: string };
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
  const importJobPageSize = Math.max(1, Number(searchParams.pageSize) || IMPORT_JOBS_PAGE_SIZE);
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
      skip: (importJobPage - 1) * importJobPageSize,
      take: importJobPageSize,
    }),
  ]);

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

          <div className="p-4">
            <RemediationFilesTable data={remediationIndex.tables} />
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

        <div className="p-4">
          <ImportJobsTable
            initialData={importJobs}
            total={importJobTotal}
            page={importJobPage}
            pageSize={importJobPageSize}
            statusFilter={statusFilter}
            statusLabels={IMPORT_JOB_STATUS_LABEL}
          />
        </div>
      </div>

      {readiness?.blockedTables?.length ? (
        <div className="card p-0">
          <div className="border-b border-hairline px-4 py-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">Bảng đang bị chặn</h2>
          </div>

          <div className="p-4">
            <BlockedTablesTable data={readiness.blockedTables.slice(0, 10)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
