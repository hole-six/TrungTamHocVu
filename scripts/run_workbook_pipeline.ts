import { spawn } from "node:child_process";
import path from "node:path";

type StepResult = {
  step: string;
  command: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
};

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

function runCommand(step: string, command: string[], cwd: string): Promise<StepResult> {
  return new Promise((resolve, reject) => {
    const child =
      process.platform === "win32"
        ? spawn(command.map((part) => (/\s/.test(part) ? `"${part}"` : part)).join(" "), [], {
            cwd,
            shell: true,
            env: process.env,
          })
        : spawn(command[0], command.slice(1), {
            cwd,
            shell: false,
            env: process.env,
          });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({
        step,
        command,
        exitCode: exitCode ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

async function main() {
  const cwd = process.cwd();
  const source = getArg("--source", path.join("docs", "File Quan ly tong 2026.xlsx"))!;
  const dictionary = getArg("--dictionary", path.join("docs", "Data_Dictionary_Excel.csv"))!;
  const output = getArg("--output", path.join("docs", "generated", "workbook_2026"))!;
  const branchCode = getArg("--branch-code");
  const apply = getFlag("--apply");
  const refreshRemediation = getFlag("--refresh-remediation");

  const extractCommand = [
    "python",
    "-X",
    "utf8",
    "scripts/extract_workbook_erp.py",
    "--source",
    source,
    "--dictionary",
    dictionary,
    "--output",
    output,
  ];

  if (refreshRemediation) {
    extractCommand.push("--refresh-remediation");
  }

  const importCommand = [
    "npx",
    "tsx",
    "scripts/import_workbook_ready.ts",
    "--input",
    output,
    "--source-file",
    source,
  ];

  if (branchCode) {
    importCommand.push("--branch-code", branchCode);
  }
  if (apply) {
    importCommand.push("--apply");
  }

  const steps: StepResult[] = [];

  const extractResult = await runCommand("extract", extractCommand, cwd);
  steps.push(extractResult);
  if (extractResult.exitCode !== 0) {
    console.log(JSON.stringify({ ok: false, steps }, null, 2));
    process.exit(extractResult.exitCode);
  }

  const importResult = await runCommand(apply ? "import-apply" : "import-dry-run", importCommand, cwd);
  steps.push(importResult);

  const ok = steps.every((step) => step.exitCode === 0);
  console.log(JSON.stringify({ ok, steps }, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
