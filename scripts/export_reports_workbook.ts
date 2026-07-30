import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getReportHpSummary, getReportHsSummary } from "../lib/server/reporting";

const execFileAsync = promisify(execFile);

async function main() {
  const [reportHs, reportHp] = await Promise.all([getReportHsSummary(null), getReportHpSummary(null)]);

  const payload = {
    generatedAt: "2026-07-30",
    reportHs,
    reportHp,
  };

  const outputDir = path.join(process.cwd(), "docs", "generated", "erp_report_exports");
  const outputPath = path.join(outputDir, "ERP_Report_HS_HP_2026-07-30.xlsx");
  const tempDir = await mkdir(path.join(os.tmpdir(), "erp-report-export"), { recursive: true }).then(() =>
    path.join(os.tmpdir(), "erp-report-export"),
  );
  const payloadPath = path.join(tempDir, "report_payload.json");
  const builderPath = path.join(process.cwd(), "scripts", "build_reports_workbook.py");

  await mkdir(outputDir, { recursive: true });
  await writeFile(payloadPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const { stdout } = await execFileAsync(
    "python",
    [builderPath, payloadPath, outputPath],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
      },
    },
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        output: outputPath,
        payload,
        builder: JSON.parse(stdout),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
