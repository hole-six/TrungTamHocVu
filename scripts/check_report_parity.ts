import { execFileSync } from "node:child_process";
import path from "node:path";
import { getReportHpSummary, getReportHsSummary } from "../lib/server/reporting";

type WorkbookMetric = {
  reportHs: {
    activeLabel: string | null;
    activeTotal: number | null;
    leftLabel: string | null;
    leftTotal: number | null;
    newLabel: string | null;
    newTotal: number | null;
    nonEmptyCellCount: number;
  };
  reportHp: {
    title: string | null;
    totalLabel: string | null;
    sessionCount: number | null;
    materialsAmount: number | null;
    openingBalance: number | null;
    tuitionAmount: number | null;
    collectedAmount: number | null;
    remainingAmount: number | null;
    runningDebtAmount: number | null;
    nonEmptyCellCount: number;
  };
};

function readWorkbookMetrics(workbookPath: string): WorkbookMetric {
  const pythonCode = `
import json, sys, warnings
from openpyxl import load_workbook
warnings.filterwarnings("ignore")
wb = load_workbook(sys.argv[1], data_only=True, read_only=True)

def count_non_empty(ws):
    count = 0
    for row in ws.iter_rows(values_only=True):
        for value in row:
            if value not in (None, ""):
                count += 1
    return count

report_hs = wb["Report_HS"]
report_hp = wb["Report_HP"]

payload = {
    "reportHs": {
        "activeLabel": report_hs["L2"].value,
        "activeTotal": report_hs["N7"].value,
        "leftLabel": report_hs["L12"].value,
        "leftTotal": report_hs["N17"].value,
        "newLabel": report_hs["L18"].value,
        "newTotal": report_hs["N24"].value,
        "nonEmptyCellCount": count_non_empty(report_hs),
    },
    "reportHp": {
        "title": report_hp["O1"].value,
        "totalLabel": report_hp["O7"].value,
        "sessionCount": report_hp["P7"].value,
        "materialsAmount": report_hp["Q7"].value,
        "openingBalance": report_hp["R7"].value,
        "tuitionAmount": report_hp["S7"].value,
        "collectedAmount": report_hp["T7"].value,
        "remainingAmount": report_hp["U7"].value,
        "runningDebtAmount": report_hp["V7"].value,
        "nonEmptyCellCount": count_non_empty(report_hp),
    }
}
print(json.dumps(payload, ensure_ascii=False))
`;

  const output = execFileSync("python", ["-c", pythonCode, workbookPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
    },
  });

  return JSON.parse(output) as WorkbookMetric;
}

function compareNumber(name: string, workbookValue: number | null, erpValue: number) {
  if (workbookValue == null) {
    return {
      name,
      ok: false,
      status: "missing_in_workbook",
      workbookValue,
      erpValue,
    };
  }

  return {
    name,
    ok: workbookValue === erpValue,
    status: workbookValue === erpValue ? "match" : "mismatch",
    workbookValue,
    erpValue,
  };
}

async function main() {
  const workbookPath = path.join(process.cwd(), "docs", "File Quan ly tong 2026.xlsx");
  const workbook = readWorkbookMetrics(workbookPath);
  const [reportHs, reportHp] = await Promise.all([getReportHsSummary(null), getReportHpSummary(null)]);

  const checks = [
    compareNumber("Report_HS.activeStudents", workbook.reportHs.activeTotal, reportHs.activeStudents),
    compareNumber("Report_HS.leftStudents", workbook.reportHs.leftTotal, reportHs.leftStudents),
    compareNumber("Report_HS.newEnrollments", workbook.reportHs.newTotal, reportHs.newEnrollments),
    compareNumber("Report_HP.sessionCount", workbook.reportHp.sessionCount, reportHp.totals.sessionCount),
    compareNumber("Report_HP.materialsAmount", workbook.reportHp.materialsAmount, reportHp.totals.materialsAmount),
    compareNumber("Report_HP.openingBalance", workbook.reportHp.openingBalance, reportHp.totals.openingBalance),
    compareNumber("Report_HP.tuitionAmount", workbook.reportHp.tuitionAmount, reportHp.totals.tuitionAmount),
    compareNumber("Report_HP.collectedAmount", workbook.reportHp.collectedAmount, reportHp.totals.collectedAmount),
    compareNumber("Report_HP.remainingAmount", workbook.reportHp.remainingAmount, reportHp.totals.remainingAmount),
  ];

  const summary = {
    ok: checks.every((item) => item.ok),
    workbookTemplateSignals: {
      reportHsNonEmptyCells: workbook.reportHs.nonEmptyCellCount,
      reportHpNonEmptyCells: workbook.reportHp.nonEmptyCellCount,
      reportHsMissingNumericCache:
        workbook.reportHs.activeTotal == null &&
        workbook.reportHs.leftTotal == null &&
        workbook.reportHs.newTotal == null,
      reportHpZeroTotals:
        workbook.reportHp.sessionCount === 0 &&
        workbook.reportHp.materialsAmount === 0 &&
        workbook.reportHp.openingBalance === 0 &&
        workbook.reportHp.tuitionAmount === 0 &&
        workbook.reportHp.collectedAmount == null,
    },
    workbook,
    erp: {
      reportHs,
      reportHp,
    },
    checks,
    conclusion:
      checks.some((item) => item.status === "missing_in_workbook")
        ? "Workbook report hiện là template/pivot cache chưa có số thực để parity 1:1; ERP report đã tính được số từ DB."
        : checks.every((item) => item.ok)
          ? "ERP report parity khớp workbook."
          : "Workbook và ERP đang lệch số; cần kiểm tra nguồn dữ liệu hoặc logic tổng hợp.",
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
