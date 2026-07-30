import { PrismaClient } from "@prisma/client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type WorkbookMapRow = {
  workbook_sheet: string;
  workbook_table: string;
  erp_module: string;
  canonical_entity: string;
  prisma_models: string;
  business_keys: string;
  api_routes: string;
  ui_routes: string;
  implementation_status: string;
  notes: string;
};

type ReadinessEntry = {
  table: string;
  rowCount: number;
  rowsWithAnyKey: number;
  rowsWithAllKeys: number;
  missingKeyCounts: Record<string, number>;
};

type ReadinessDoc = {
  readyTables: ReadinessEntry[];
  partialTables: ReadinessEntry[];
  blockedTables: ReadinessEntry[];
  readyEntities: Record<string, number>;
  coreBlockers: string[];
};

type TableReport = WorkbookMapRow & {
  readinessStatus: "ready" | "partial" | "blocked" | "derived";
  readiness?: ReadinessEntry;
  dbCounts: string[];
  verdict: string;
};

const prisma = new PrismaClient();

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((result, header, index) => {
      result[header] = values[index] ?? "";
      return result;
    }, {});
  });
}

function asArray(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function keyForTable(sheet: string, table: string) {
  return table === "n/a" ? `${sheet}.n/a` : `${sheet}.${table}`;
}

function readinessLabel(status: TableReport["readinessStatus"], readiness?: ReadinessEntry) {
  if (status === "derived") {
    return "derived/report";
  }
  if (!readiness) {
    return status;
  }
  return `${status} (${readiness.rowsWithAllKeys}/${readiness.rowCount} đủ khóa)`;
}

function verdictFor(row: WorkbookMapRow, readinessStatus: TableReport["readinessStatus"]) {
  if (readinessStatus === "blocked") {
    return "Schema có, import template chưa dùng được";
  }
  if (readinessStatus === "partial") {
    return "Schema có, cần bridge/lookup thêm";
  }
  if (readinessStatus === "ready") {
    return "Có thể nhập từ template hiện tại";
  }
  if (row.implementation_status.includes("partial")) {
    return "Đã model hóa, còn thiếu parity report/UI";
  }
  return "Dữ liệu suy diễn từ module khác";
}

async function getDbCounts() {
  const [
    leads,
    guardians,
    placementTests,
    students,
    enrollments,
    statusHistory,
    schoolExamScores,
    courses,
    classes,
    scheduleRules,
    classTasks,
    classTaskLogs,
    sessions,
    assignments,
    attendances,
    timesheetEntries,
    timesheetPeriods,
    employees,
    contracts,
    payPolicies,
    billingPeriods,
    charges,
    invoices,
    payments,
    paymentAllocations,
    scholarships,
    adjustments,
    creditBalances,
    refunds,
    books,
    stockLocations,
    stockReceipts,
    stockIssues,
    bookIssues,
    cashReceipts,
    cashPayments,
    categories,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.guardian.count(),
    prisma.placementTest.count(),
    prisma.student.count(),
    prisma.enrollment.count(),
    prisma.enrollmentStatusHistory.count(),
    prisma.schoolExamScore.count(),
    prisma.course.count(),
    prisma.class.count(),
    prisma.scheduleRule.count(),
    prisma.classTask.count(),
    prisma.classTaskLog.count(),
    prisma.classSession.count(),
    prisma.sessionAssignment.count(),
    prisma.studentAttendance.count(),
    prisma.timesheetEntry.count(),
    prisma.timesheetPeriod.count(),
    prisma.employee.count(),
    prisma.employmentContract.count(),
    prisma.payPolicy.count(),
    prisma.billingPeriod.count(),
    prisma.charge.count(),
    prisma.invoice.count(),
    prisma.payment.count(),
    prisma.paymentAllocation.count(),
    prisma.scholarship.count(),
    prisma.adjustment.count(),
    prisma.creditBalance.count(),
    prisma.refund.count(),
    prisma.book.count(),
    prisma.stockLocation.count(),
    prisma.stockTransaction.count({ where: { type: "RECEIPT" } }),
    prisma.stockTransaction.count({ where: { type: "RETURN" } }),
    prisma.bookIssue.count(),
    prisma.cashTransaction.count({ where: { type: "THU" } }),
    prisma.cashTransaction.count({ where: { type: "CHI" } }),
    prisma.transactionCategory.count(),
  ]);

  return {
    "DSTest.T_DSTest": [`Lead:${leads}`, `Guardian:${guardians}`, `PlacementTest:${placementTests}`],
    "DSHV.T_HV": [`Student:${students}`, `Enrollment:${enrollments}`, `StatusHistory:${statusHistory}`, `ExamScore:${schoolExamScores}`],
    "DSLop.T_DSLop": [`Course:${courses}`, `Class:${classes}`, `ScheduleRule:${scheduleRules}`, `ClassTask:${classTasks}`, `TaskLog:${classTaskLogs}`],
    "ChiTietLopHoc.T_ChiTietLop": [`Session:${sessions}`, `Assignment:${assignments}`, `Attendance:${attendances}`, `TimesheetEntry:${timesheetEntries}`, `TimesheetPeriod:${timesheetPeriods}`],
    "TheoDoiHP.T_HP": [`BillingPeriod:${billingPeriods}`, `Charge:${charges}`, `Invoice:${invoices}`, `Payment:${payments}`, `Allocation:${paymentAllocations}`, `Scholarship:${scholarships}`, `Adjustment:${adjustments}`, `Credit:${creditBalances}`, `Refund:${refunds}`],
    "XuatNhapSach.T_SachTon": [`Book:${books}`, `StockLocation:${stockLocations}`],
    "XuatNhapSach.T_SachNhap": [`StockReceipt:${stockReceipts}`],
    "XuatNhapSach.T_SachXuat": [`BookIssue:${bookIssues}`, `StockReturn:${stockIssues}`],
    "Thu-Chi.T_Thu": [`CashReceipt:${cashReceipts}`],
    "Thu-Chi.T_Chi": [`CashPayment:${cashPayments}`],
    "Thu-Chi.T_PhanLoai": [`Category:${categories}`],
    "NhanSu.T_NS": [`Employee:${employees}`, `Contract:${contracts}`, `PayPolicy:${payPolicies}`],
    "MucLuc.Table1": [`ScheduleRule:${scheduleRules}`],
    "MucLuc.Table2": [`Course:${courses}`],
    "MucLuc.Table3": [`ScheduleRule:${scheduleRules}`],
    "Report_Cong_Luong.n/a": [`TimesheetEntry:${timesheetEntries}`, `Payroll-ready via SessionAssignment+Timesheet`],
    "Report_HS.n/a": [`Student:${students}`, `Enrollment:${enrollments}`, `Attendance:${attendances}`],
    "Report_HP.n/a": [`Charge:${charges}`, `Payment:${payments}`, `BillingPeriod:${billingPeriods}`],
    "SinhNhatHV.n/a": [`Student:${students}`],
    "Home.Table19": [`No DB table`, `Navigation/reference only`],
  } as Record<string, string[]>;
}

async function main() {
  const root = process.cwd();
  const docsDir = path.join(root, "docs");
  const mapPath = path.join(docsDir, "WORKBOOK_TO_PRISMA_MAP.csv");
  const readinessPath = path.join(docsDir, "generated", "workbook_2026_phase4check", "import_readiness.json");
  const outputMd = path.join(docsDir, "WORKBOOK_DB_PARITY_REPORT_2026-07-30.md");
  const outputJson = path.join(docsDir, "WORKBOOK_DB_PARITY_REPORT_2026-07-30.json");

  const [mapCsv, readinessJson] = await Promise.all([
    readFile(mapPath, "utf8"),
    readFile(readinessPath, "utf8"),
  ]);

  const workbookRows = parseCsv(mapCsv) as WorkbookMapRow[];
  const readiness = JSON.parse(readinessJson) as ReadinessDoc;
  const dbCounts = await getDbCounts();

  const readinessMap = new Map<string, { status: TableReport["readinessStatus"]; entry?: ReadinessEntry }>();
  for (const entry of readiness.readyTables) readinessMap.set(entry.table, { status: "ready", entry });
  for (const entry of readiness.partialTables) readinessMap.set(entry.table, { status: "partial", entry });
  for (const entry of readiness.blockedTables) readinessMap.set(entry.table, { status: "blocked", entry });

  const tableReports: TableReport[] = workbookRows.map((row) => {
    const tableKey = keyForTable(row.workbook_sheet, row.workbook_table);
    const readinessKey = row.workbook_table === "n/a" ? undefined : `${row.workbook_sheet}.${row.workbook_table}`;
    const readinessInfo = readinessKey ? readinessMap.get(readinessKey) : undefined;
    const readinessStatus = readinessInfo?.status ?? "derived";

    return {
      ...row,
      readinessStatus,
      readiness: readinessInfo?.entry,
      dbCounts: dbCounts[tableKey] ?? asArray(row.prisma_models),
      verdict: verdictFor(row, readinessStatus),
    };
  });

  const implementedCount = tableReports.filter((row) => row.implementation_status.startsWith("implemented")).length;
  const partialCount = tableReports.filter((row) => row.implementation_status.includes("partial")).length;
  const readyCount = tableReports.filter((row) => row.readinessStatus === "ready").length;
  const blockedCount = tableReports.filter((row) => row.readinessStatus === "blocked").length;
  const partialReadinessCount = tableReports.filter((row) => row.readinessStatus === "partial").length;

  const mdLines: string[] = [
    "# Workbook → DB Parity Report (2026-07-30)",
    "",
    "## Kết luận nhanh",
    "",
    `- Tổng mục đối chiếu: ${tableReports.length}`,
    `- Đã implement ở schema/API/UI: ${implementedCount}/${tableReports.length}`,
    `- Mức import-ready từ chính workbook template: ready ${readyCount}, partial ${partialReadinessCount}, blocked ${blockedCount}`,
    "- Trạng thái chung: schema và luồng ERP đã phủ gần đủ, nhưng nhiều sheet nghiệp vụ chính trong workbook vẫn là template/công thức nên chưa thể import raw 1:1.",
    "",
    "## Bảng đối chiếu từng sheet/bảng",
    "",
    "| Sheet | Table | Module | Status code | Import-ready | DB hiện có | Kết luận |",
    "|---|---|---|---|---|---|---|",
  ];

  for (const row of tableReports) {
    mdLines.push(
      `| ${row.workbook_sheet} | ${row.workbook_table} | ${row.erp_module} | ${row.implementation_status} | ${readinessLabel(row.readinessStatus, row.readiness)} | ${row.dbCounts.join("<br>")} | ${row.verdict} |`,
    );
  }

  mdLines.push(
    "",
    "## Các sheet/bảng đang khớp tốt nhất",
    "",
    ...tableReports
      .filter((row) => row.readinessStatus === "ready")
      .map((row) => `- ${row.workbook_sheet}/${row.workbook_table}: ${row.notes}`),
    "",
    "## Các điểm còn vướng chính",
    "",
    ...readiness.coreBlockers.map((item) => `- ${item}`),
    "- `ChiTietLopHoc`, `DSTest`, `DSHV`, `DSLop`, `NhanSu`, `TheoDoiHP` có model đủ nhưng dữ liệu trong file mẫu chưa mang business key raw để import thẳng.",
    "- `Thu-Chi.T_Thu` và `Thu-Chi.T_Chi` hiện giống vùng tổng hợp/pivot hơn là journal raw, nên parity cần đi qua `PaymentCashPosting` và `StockCashPosting` thay vì import trực tiếp từng dòng.",
    "- `Report_HS`, `Report_HP`, `Report_Cong_Luong`, `SinhNhatHV` là báo cáo suy diễn; muốn khớp 100% cần viết query/report parity chứ không chỉ đối chiếu schema.",
    "",
    "## Khuyến nghị thực thi tiếp",
    "",
    "- Ưu tiên 1: dựng report API cho `Report_HS` và `Report_HP` để so số với workbook.",
    "- Ưu tiên 2: thêm tầng `template adapters` cho các sheet công thức nếu bạn muốn nhập từ file mẫu thay vì dữ liệu vận hành raw.",
    "- Ưu tiên 3: chuẩn hóa bridge giữa `Payment` ↔ `CashTransaction` và `BookIssue` ↔ `Charge` ở mọi luồng thật, không chỉ demo seed.",
  );

  const jsonReport = {
    generatedAt: "2026-07-30",
    summary: {
      total: tableReports.length,
      implementedCount,
      partialCount,
      readyCount,
      partialReadinessCount,
      blockedCount,
    },
    readyEntities: readiness.readyEntities,
    coreBlockers: readiness.coreBlockers,
    tables: tableReports,
  };

  await mkdir(path.dirname(outputMd), { recursive: true });
  await Promise.all([
    writeFile(outputMd, `${mdLines.join("\n")}\n`, "utf8"),
    writeFile(outputJson, `${JSON.stringify(jsonReport, null, 2)}\n`, "utf8"),
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        generatedAt: "2026-07-30",
        files: {
          markdown: outputMd,
          json: outputJson,
        },
        summary: jsonReport.summary,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
