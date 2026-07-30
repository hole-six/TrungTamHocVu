import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function timestampForFile(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

async function main() {
  const root = process.cwd();
  const now = new Date();
  const stamp = timestampForFile(now);

  const templateWorkbookPath = path.join(root, "docs", "File Quan ly tong 2026.backup-2026-07-30.xlsx");
  const fallbackWorkbookPath = path.join(root, "docs", "File Quan ly tong 2026.xlsx");
  const outputDir = path.join(root, "docs", "generated", "workbook_exports");
  const outputWorkbookPath = path.join(outputDir, `File Quan ly tong 2026.export-${stamp}.xlsx`);
  const cleanAliasPath = path.join(outputDir, `ERP_Operational_${stamp}.xlsx`);
  const tempDir = path.join(os.tmpdir(), "erp-report-patch");
  const payloadPath = path.join(tempDir, `report_patch_payload_${stamp}.json`);

  await mkdir(outputDir, { recursive: true });
  await mkdir(tempDir, { recursive: true });

  const sourceWorkbookPath = await readFile(templateWorkbookPath)
    .then(() => templateWorkbookPath)
    .catch(() => fallbackWorkbookPath);

  await copyFile(sourceWorkbookPath, outputWorkbookPath);

  const tsxCliPath = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");

  const { stdout } = await execFileAsync(process.execPath, [tsxCliPath, path.join("scripts", "patch_reports_into_workbook.ts")], {
    cwd: root,
    env: {
      ...process.env,
      FORCE_COLOR: "0",
    },
  });

  const payloadMeta = JSON.parse(stdout) as { payloadPath: string };
  const rawPayload = JSON.parse(await readFile(payloadMeta.payloadPath, "utf8")) as Record<string, unknown>;

  rawPayload.workbookPath = outputWorkbookPath;
  rawPayload.backupWorkbookPath = sourceWorkbookPath;

  await writeFile(payloadPath, `${JSON.stringify(rawPayload, null, 2)}\n`, "utf8");

  const patchResult = await execFileAsync("python", [path.join("scripts", "patch_workbook_reports_xml.py"), payloadPath], {
    cwd: root,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
    },
  });

  const patchResultV2 = await execFileAsync("python", [path.join("scripts", "patch_workbook_operational_v2.py"), payloadPath], {
    cwd: root,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
    },
  });

  const syncSiblingPath = outputWorkbookPath.replace(/\.xlsx$/i, ".sync.xlsx");
  const operationalSiblingPath = outputWorkbookPath.replace(/\.xlsx$/i, ".operational-v2.xlsx");
  await Promise.all([
    rm(syncSiblingPath, { force: true }).catch(() => undefined),
    rm(operationalSiblingPath, { force: true }).catch(() => undefined),
  ]);
  await copyFile(outputWorkbookPath, cleanAliasPath);

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputWorkbookPath,
        cleanAliasPath,
        payloadPath,
        sourceWorkbookPath,
        patchResult: patchResult.stdout ? JSON.parse(patchResult.stdout) : null,
        patchResultV2: patchResultV2.stdout ? JSON.parse(patchResultV2.stdout) : null,
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
