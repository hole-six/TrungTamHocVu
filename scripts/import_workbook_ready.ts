import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type CanonicalData = {
  lookups: {
    courses: Array<{
      courseCode: string;
      name: string;
      tuitionPerSession: number | null;
      sessionsPerWeek: number | null;
    }>;
  };
  finance: {
    cashCategories: Array<{
      type: string;
      name: string;
      detail: string | null;
      notes: string | null;
      handledByHint?: string | null;
    }>;
  };
  inventory: {
    books: Array<{
      bookCode: string | null;
      name: string;
      unitPrice: number;
      quantityOnHand: number;
      notes: string | null;
    }>;
  };
};

type ImportReadiness = {
  readyTables: ReadinessTable[];
  partialTables: ReadinessTable[];
  blockedTables: ReadinessTable[];
  coreBlockers: string[];
};

type ReadinessTable = {
  table: string;
  rowCount: number;
  rowsWithAnyKey: number;
  rowsWithAllKeys: number;
  missingKeyCounts: Record<string, number>;
};

type ImportSummary = {
  targetEntity: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  createdRows: number;
  updatedRows: number;
  skippedRows: number;
  notes?: string[];
};

type ImportJobStatus = "PENDING" | "VALIDATING" | "DRY_RUN" | "IMPORTED" | "FAILED" | "ROLLED_BACK";

const prisma = new PrismaClient();

function getFlag(name: string): boolean {
  return process.argv.includes(name);
}

function getArg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index >= 0 && index < process.argv.length - 1) {
    return process.argv[index + 1];
  }
  return fallback;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function resolveBranch(branchCode?: string) {
  if (branchCode) {
    const branch = await prisma.branch.findUnique({
      where: { code: branchCode },
    });
    if (branch) {
      return branch;
    }
  }

  const firstBranch = await prisma.branch.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (!firstBranch) {
    const organization =
      (await prisma.organization.findFirst({
        orderBy: { createdAt: "asc" },
      })) ??
      (await prisma.organization.create({
        data: {
          name: "Trung tâm (tạo tự động từ importer)",
        },
      }));

    return prisma.branch.create({
      data: {
        organizationId: organization.id,
        code: branchCode ?? "CS1",
        name: "Cơ sở 1",
        isActive: true,
      },
    });
  }

  return firstBranch;
}

async function ensureDefaultStockLocation(branchId: string, apply: boolean) {
  const existing = await prisma.stockLocation.findFirst({
    where: {
      branchId,
      name: "Kho mặc định",
    },
  });

  if (existing || !apply) {
    return existing;
  }

  return prisma.stockLocation.create({
    data: {
      branchId,
      name: "Kho mặc định",
    },
  });
}

async function recordImportJob(input: {
  branchId: string;
  sourceFile: string;
  targetEntity: string;
  status: ImportJobStatus;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errorLog?: unknown;
}) {
  return prisma.importJob.create({
    data: {
      branchId: input.branchId,
      sourceFile: input.sourceFile,
      targetEntity: input.targetEntity,
      status: input.status,
      totalRows: input.totalRows,
      successRows: input.successRows,
      errorRows: input.errorRows,
      errorLog: input.errorLog ? JSON.stringify(input.errorLog, null, 2) : null,
    },
  });
}

async function importCourses(
  branchId: string,
  rows: CanonicalData["lookups"]["courses"],
  apply: boolean,
): Promise<ImportSummary> {
  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  for (const row of rows) {
    if (!row.courseCode || !row.name) {
      skippedRows += 1;
      continue;
    }

    const existing = await prisma.course.findFirst({
      where: {
        branchId,
        code: row.courseCode,
      },
    });

    if (!apply) {
      if (existing) {
        updatedRows += 1;
      } else {
        createdRows += 1;
      }
      continue;
    }

    if (existing) {
      await prisma.course.update({
        where: { id: existing.id },
        data: {
          name: row.name,
          tuitionPerSession: row.tuitionPerSession ?? 0,
          sessionsPerWeek: row.sessionsPerWeek ?? 0,
          isActive: true,
        },
      });
      updatedRows += 1;
    } else {
      await prisma.course.create({
        data: {
          branchId,
          code: row.courseCode,
          name: row.name,
          tuitionPerSession: row.tuitionPerSession ?? 0,
          sessionsPerWeek: row.sessionsPerWeek ?? 0,
          isActive: true,
        },
      });
      createdRows += 1;
    }
  }

  return {
    targetEntity: "Course",
    totalRows: rows.length,
    successRows: createdRows + updatedRows,
    errorRows: skippedRows,
    createdRows,
    updatedRows,
    skippedRows,
  };
}

async function importTransactionCategories(
  rows: CanonicalData["finance"]["cashCategories"],
  apply: boolean,
): Promise<ImportSummary> {
  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  for (const row of rows) {
    if (!row.type || !row.name) {
      skippedRows += 1;
      continue;
    }

    const existing = await prisma.transactionCategory.findFirst({
      where: {
        type: row.type,
        name: row.name,
        detail: row.detail ?? null,
      },
    });

    if (!apply) {
      if (existing) {
        updatedRows += 1;
      } else {
        createdRows += 1;
      }
      continue;
    }

    if (existing) {
      await prisma.transactionCategory.update({
        where: { id: existing.id },
        data: {
          notes: row.notes ?? existing.notes,
        },
      });
      updatedRows += 1;
    } else {
      await prisma.transactionCategory.create({
        data: {
          type: row.type,
          name: row.name,
          detail: row.detail,
          notes: row.notes ?? row.handledByHint ?? null,
        },
      });
      createdRows += 1;
    }
  }

  return {
    targetEntity: "TransactionCategory",
    totalRows: rows.length,
    successRows: createdRows + updatedRows,
    errorRows: skippedRows,
    createdRows,
    updatedRows,
    skippedRows,
  };
}

async function importBooks(
  branchId: string,
  rows: CanonicalData["inventory"]["books"],
  apply: boolean,
): Promise<ImportSummary> {
  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  for (const row of rows) {
    if (!row.name) {
      skippedRows += 1;
      continue;
    }

    const existing = await prisma.book.findFirst({
      where: {
        branchId,
        name: row.name,
      },
    });

    if (!apply) {
      if (existing) {
        updatedRows += 1;
      } else {
        createdRows += 1;
      }
      continue;
    }

    if (existing) {
      await prisma.book.update({
        where: { id: existing.id },
        data: {
          bookCode: row.bookCode ?? existing.bookCode,
          unitPrice: row.unitPrice,
          quantityOnHand: row.quantityOnHand,
          notes: row.notes ?? existing.notes,
        },
      });
      updatedRows += 1;
    } else {
      await prisma.book.create({
        data: {
          branchId,
          bookCode: row.bookCode,
          name: row.name,
          unitPrice: row.unitPrice,
          quantityOnHand: row.quantityOnHand,
          notes: row.notes,
        },
      });
      createdRows += 1;
    }
  }

  return {
    targetEntity: "Book",
    totalRows: rows.length,
    successRows: createdRows + updatedRows,
    errorRows: skippedRows,
    createdRows,
    updatedRows,
    skippedRows,
  };
}

async function main() {
  const apply = getFlag("--apply");
  const inputDir = getArg("--input", path.join("docs", "generated", "workbook_2026"))!;
  const branchCode = getArg("--branch-code");
  const sourceFile = getArg("--source-file", "docs/File Quan ly tong 2026.xlsx")!;

  const canonical = await readJsonFile<CanonicalData>(path.join(inputDir, "canonical.json"));
  const readiness = await readJsonFile<ImportReadiness>(path.join(inputDir, "import_readiness.json"));

  const branch = await resolveBranch(branchCode);
  const stockLocation = await ensureDefaultStockLocation(branch.id, apply);

  const summaries: ImportSummary[] = [];

  const courseSummary = await importCourses(branch.id, canonical.lookups.courses, apply);
  summaries.push(courseSummary);

  const categorySummary = await importTransactionCategories(canonical.finance.cashCategories, apply);
  summaries.push(categorySummary);

  const bookSummary = await importBooks(branch.id, canonical.inventory.books, apply);
  summaries.push(bookSummary);

  const noModelTables: ReadinessTable[] = readiness.readyTables.filter(
    (item) => item.table === "MucLuc.Table3",
  ).concat(readiness.partialTables.filter((item) => item.table === "MucLuc.Table1"));

  if (apply) {
    await recordImportJob({
      branchId: branch.id,
      sourceFile,
      targetEntity: "Course",
      status: "IMPORTED",
      totalRows: courseSummary.totalRows,
      successRows: courseSummary.successRows,
      errorRows: courseSummary.errorRows,
      errorLog: {
        createdRows: courseSummary.createdRows,
        updatedRows: courseSummary.updatedRows,
        skippedRows: courseSummary.skippedRows,
      },
    });

    await recordImportJob({
      branchId: branch.id,
      sourceFile,
      targetEntity: "TransactionCategory",
      status: "IMPORTED",
      totalRows: categorySummary.totalRows,
      successRows: categorySummary.successRows,
      errorRows: categorySummary.errorRows,
      errorLog: {
        createdRows: categorySummary.createdRows,
        updatedRows: categorySummary.updatedRows,
        skippedRows: categorySummary.skippedRows,
      },
    });

    await recordImportJob({
      branchId: branch.id,
      sourceFile,
      targetEntity: "Book",
      status: "IMPORTED",
      totalRows: readiness.readyTables.find((item) => item.table === "XuatNhapSach.T_SachTon")?.rowCount ?? bookSummary.totalRows,
      successRows: bookSummary.successRows,
      errorRows: (readiness.readyTables.find((item) => item.table === "XuatNhapSach.T_SachTon")?.rowCount ?? bookSummary.totalRows) - bookSummary.successRows,
      errorLog: {
        createdRows: bookSummary.createdRows,
        updatedRows: bookSummary.updatedRows,
        skippedRows: bookSummary.skippedRows,
      },
    });

    for (const table of noModelTables) {
      await recordImportJob({
        branchId: branch.id,
        sourceFile,
        targetEntity: table.table,
        status: "VALIDATING",
        totalRows: table.rowCount,
        successRows: 0,
        errorRows: table.rowCount,
        errorLog: {
          reason: "Bảng lookup hỗ trợ runtime, hiện schema chưa có model persist riêng.",
          missingKeyCounts: table.missingKeyCounts,
        },
      });
    }

    for (const table of readiness.blockedTables) {
      await recordImportJob({
        branchId: branch.id,
        sourceFile,
        targetEntity: table.table,
        status: "FAILED",
        totalRows: table.rowCount,
        successRows: 0,
        errorRows: table.rowCount,
        errorLog: {
          missingKeyCounts: table.missingKeyCounts,
          reason: "Thiếu khóa nghiệp vụ để import an toàn vào ERP.",
        },
      });
    }
  }

  const output = {
    mode: apply ? "apply" : "dry-run",
    branch: {
      id: branch.id,
      code: branch.code,
      name: branch.name,
    },
    stockLocation: stockLocation
      ? { id: stockLocation.id, name: stockLocation.name }
      : { name: "Kho mặc định", pendingCreation: !apply },
    imported: summaries,
    blockedTables: readiness.blockedTables.length,
    partialTables: readiness.partialTables.length,
    readyTables: readiness.readyTables.length,
    coreBlockers: readiness.coreBlockers,
  };

  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
