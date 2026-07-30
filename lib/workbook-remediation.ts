import "server-only";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type RemediationIndex = {
  generatedAt: string;
  tables: Array<{
    table: string;
    file: string;
    status: string;
  }>;
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

export type RemediationTableSummary = {
  table: string;
  file: string;
  status: string;
  rowCount: number;
  activeOverrideRows: number;
  headers: string[];
  missingKeyCounts: Record<string, number>;
  readinessStatus: "READY" | "PARTIAL" | "BLOCKED" | "UNKNOWN";
};

export type RemediationTableDetail = RemediationTableSummary & {
  csvContent: string;
  previewRows: Array<Record<string, string>>;
};

export type RemediationWorkspace = {
  tables: RemediationTableSummary[];
  selectedTable: RemediationTableDetail | null;
};

const WORKBOOK_OUTPUT_DIR = path.join(process.cwd(), "docs", "generated", "workbook_2026");
const REMEDIATION_DIR = path.join(WORKBOOK_OUTPUT_DIR, "remediation");

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeNewlines(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseCsv(content: string): string[][] {
  const source = normalizeNewlines(content);
  if (!source.trim()) {
    return [];
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (char === "\"") {
      if (inQuotes && source[index + 1] === "\"") {
        cell += "\"";
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  while (rows.length > 0 && rows[rows.length - 1].every((value) => value === "")) {
    rows.pop();
  }

  return rows;
}

function escapeCsvCell(value: string) {
  if (/["\n,]/.test(value) || /^\s|\s$/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function stringifyCsv(rows: string[][]) {
  return `${rows.map((row) => row.map((cell) => escapeCsvCell(cell ?? "")).join(",")).join("\n")}\n`;
}

function isTruthyOverride(value: string | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "x", "yes", "y", "apply"].includes(normalized);
}

function parseRemediationContent(content: string) {
  const csvRows = parseCsv(content);
  if (csvRows.length === 0) {
    return {
      headers: [] as string[],
      dataRows: [] as Array<Record<string, string>>,
    };
  }

  const [rawHeaders, ...rawDataRows] = csvRows;
  const headers = rawHeaders.map((item) => item.trim());

  const dataRows = rawDataRows.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return record;
  });

  return { headers, dataRows };
}

function computeActiveOverrideRows(rows: Array<Record<string, string>>) {
  return rows.filter((row) => {
    if (isTruthyOverride(row.applyOverride)) {
      return true;
    }

    return Object.entries(row).some(([key, value]) => {
      if (key === "sourceRow" || key === "applyOverride" || key === "notes") {
        return false;
      }
      return String(value ?? "").trim().length > 0;
    });
  }).length;
}

function buildPreviewRows(rows: Array<Record<string, string>>, limit = 12) {
  return rows
    .filter((row) =>
      Object.entries(row).some(([key, value]) => key !== "notes" && String(value ?? "").trim().length > 0)
    )
    .slice(0, limit);
}

function getTableReadiness(
  readiness: ImportReadiness | null,
  tableName: string
): Pick<RemediationTableSummary, "missingKeyCounts" | "readinessStatus" | "rowCount"> {
  const readyItem = readiness?.readyTables.find((item) => item.table === tableName);
  if (readyItem) {
    return {
      missingKeyCounts: {},
      readinessStatus: "READY",
      rowCount: readyItem.rowCount,
    };
  }

  const partialItem = readiness?.partialTables.find((item) => item.table === tableName);
  if (partialItem) {
    return {
      missingKeyCounts: {},
      readinessStatus: "PARTIAL",
      rowCount: partialItem.rowCount,
    };
  }

  const blockedItem = readiness?.blockedTables.find((item) => item.table === tableName);
  if (blockedItem) {
    return {
      missingKeyCounts: blockedItem.missingKeyCounts,
      readinessStatus: "BLOCKED",
      rowCount: blockedItem.rowCount,
    };
  }

  return {
    missingKeyCounts: {},
    readinessStatus: "UNKNOWN",
    rowCount: 0,
  };
}

async function readIndex() {
  return readJsonIfExists<RemediationIndex>(path.join(REMEDIATION_DIR, "_index.json"));
}

async function readReadiness() {
  return readJsonIfExists<ImportReadiness>(path.join(WORKBOOK_OUTPUT_DIR, "import_readiness.json"));
}

async function readTableDetail(
  item: RemediationIndex["tables"][number],
  readiness: ImportReadiness | null
): Promise<RemediationTableDetail> {
  const absolutePath = path.join(REMEDIATION_DIR, item.file);
  const csvContent = await readFile(absolutePath, "utf8");
  const { headers, dataRows } = parseRemediationContent(csvContent);
  const readinessData = getTableReadiness(readiness, item.table);

  return {
    table: item.table,
    file: item.file,
    status: item.status,
    rowCount: dataRows.length || readinessData.rowCount,
    activeOverrideRows: computeActiveOverrideRows(dataRows),
    headers,
    missingKeyCounts: readinessData.missingKeyCounts,
    readinessStatus: readinessData.readinessStatus,
    csvContent,
    previewRows: buildPreviewRows(dataRows),
  };
}

export async function getRemediationWorkspace(selectedTableName?: string): Promise<RemediationWorkspace> {
  const [index, readiness] = await Promise.all([readIndex(), readReadiness()]);
  if (!index?.tables?.length) {
    return { tables: [], selectedTable: null };
  }

  const details = await Promise.all(index.tables.map((item) => readTableDetail(item, readiness)));
  const summaries = details.map((item) => ({
    table: item.table,
    file: item.file,
    status: item.status,
    rowCount: item.rowCount,
    activeOverrideRows: item.activeOverrideRows,
    headers: item.headers,
    missingKeyCounts: item.missingKeyCounts,
    readinessStatus: item.readinessStatus,
  }));

  const selectedTable =
    details.find((item) => item.table === selectedTableName) ??
    details.find((item) => item.readinessStatus === "BLOCKED") ??
    details[0] ??
    null;

  return {
    tables: summaries,
    selectedTable,
  };
}

export async function saveRemediationCsv(tableName: string, csvContent: string) {
  const index = await readIndex();
  const fileRecord = index?.tables.find((item) => item.table === tableName);

  if (!fileRecord) {
    throw new Error(`Không tìm thấy remediation table: ${tableName}`);
  }

  const normalizedContent = normalizeNewlines(csvContent).trim();
  const parsedRows = parseCsv(normalizedContent);
  if (parsedRows.length === 0) {
    throw new Error("File remediation không được để trống.");
  }

  const headers = parsedRows[0].map((value) => value.trim());
  if (!headers.includes("sourceRow")) {
    throw new Error("File remediation phải có cột sourceRow.");
  }

  const normalizedRows = parsedRows.map((row, rowIndex) => {
    if (rowIndex === 0) {
      return headers;
    }
    return headers.map((_, cellIndex) => row[cellIndex] ?? "");
  });

  const absolutePath = path.join(REMEDIATION_DIR, fileRecord.file);
  await writeFile(absolutePath, stringifyCsv(normalizedRows), "utf8");

  const readiness = await readReadiness();
  return readTableDetail(fileRecord, readiness);
}
