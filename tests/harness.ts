// Khung test tự động cho mảng TIỀN.
//
// Vì sao tự viết thay vì lắp vitest/jest: toàn bộ logic tiền nằm trong các hàm nhận
// một Prisma transaction client, nên thứ thật sự cần là (a) một CSDL sạch, (b) cách
// dựng dữ liệu mẫu, (c) so sánh số. Ba thứ đó gọn hơn nhiều so với kéo về một bộ
// test runner, và chạy được offline — đúng kiểu các script check:* sẵn có trong dự án.
//
// NGUYÊN TẮC QUAN TRỌNG: test chạy trên MỘT FILE CSDL RIÊNG (prisma/test.db), không
// bao giờ đụng vào dev.db. Mỗi lần chạy đều xóa và dựng lại từ migration thật, nên
// kết quả không phụ thuộc dữ liệu đang có trên máy ai.
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const TEST_DB_PATH = path.join(process.cwd(), "prisma", "test.db");
const TEST_DB_URL = `file:${TEST_DB_PATH.split(String.fromCharCode(92)).join("/")}`;

export function createTestDatabase(): PrismaClient {
  for (const suffix of ["", "-journal"]) {
    const file = TEST_DB_PATH + suffix;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "pipe",
    shell: process.platform === "win32",
  });
  return new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
}

export function dropTestDatabase() {
  for (const suffix of ["", "-journal"]) {
    const file = TEST_DB_PATH + suffix;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

// ---- Ghi nhận kết quả ----
type Failure = { test: string; detail: string };
const failures: Failure[] = [];
let currentTest = "";
let passed = 0;

export function vnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

export async function test(name: string, run: () => Promise<void>) {
  currentTest = name;
  const before = failures.length;
  try {
    await run();
  } catch (error) {
    failures.push({ test: name, detail: `nổ giữa chừng: ${(error as Error).message}` });
  }
  if (failures.length === before) {
    passed += 1;
    console.log(`  ĐÚNG  ${name}`);
  } else {
    console.log(`  SAI   ${name}`);
    for (const failure of failures.slice(before)) console.log(`        ${failure.detail}`);
  }
}

export function expectEqual(actual: unknown, expected: unknown, what: string) {
  if (actual !== expected) {
    failures.push({ test: currentTest, detail: `${what}: nhận ${String(actual)}, mong đợi ${String(expected)}` });
  }
}

export function expectTrue(condition: boolean, what: string) {
  if (!condition) failures.push({ test: currentTest, detail: what });
}

export function summary(): number {
  console.log(
    failures.length === 0
      ? `\n==> ${passed} phép thử ĐỀU ĐÚNG.`
      : `\n==> ${passed} đúng, ${failures.length} SAI.`,
  );
  return failures.length;
}
