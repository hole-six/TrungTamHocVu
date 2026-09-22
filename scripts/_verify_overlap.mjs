import puppeteer from "puppeteer-core";
import { PrismaClient } from "@prisma/client";
const BASE = "http://localhost:3001";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const db = new PrismaClient();
const problems = [];

// Dựng sẵn 3 lớp cùng khung giờ 17:30–19:00 trong cùng 1 ngày
const branch = await db.branch.findFirstOrThrow();
const gv = await db.employee.findFirstOrThrow({ where: { workStatus: "ACTIVE" } });
const date = new Date("2026-11-03T00:00:00.000Z");
const classes = [];
for (const code of ["OVL-A", "OVL-B", "OVL-C"]) {
  const cls = await db.class.upsert({
    where: { classCode: code },
    update: {},
    create: { branchId: branch.id, classCode: code, className: `Lớp trùng giờ ${code}`, status: "ACTIVE", tuitionPerSession: 100000, totalSessions: 10 },
  });
  const session = await db.classSession.create({ data: { classId: cls.id, sessionDate: date, startTime: "17:30", endTime: "19:00", status: "PLANNED" } });
  classes.push({ cls, session });
}
console.log("giáo viên thử:", gv.fullName, "| 3 lớp cùng 17:30–19:00 ngày 3/11/2026");

const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"], defaultViewport: { width: 1500, height: 1000 } });
const page = await browser.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 180000 });
await page.waitForSelector('input[type="email"]');
await page.type('input[type="email"]', "admin@demo.vn");
await page.type('input[type="password"]', "Demo@123");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), page.click('button[type="submit"]')]);
await wait(1500);

const call = (sessionId, allowOverlap) =>
  page.evaluate(async (sessionId, employeeId, allowOverlap) => {
    const r = await fetch(`/api/sessions/${sessionId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, role: "TEACHER", allowOverlap }),
    });
    const body = await r.json().catch(() => ({}));
    return { status: r.status, code: body.code ?? null, error: body.error ?? null };
  }, sessionId, gv.id, allowOverlap);

console.log("\n1) lớp thứ 1 (khung giờ trống):");
console.log("   →", JSON.stringify(await call(classes[0].session.id, false)));

console.log("2) lớp thứ 2 cùng giờ, chưa đồng ý:");
const r2 = await call(classes[1].session.id, false);
console.log("   →", r2.status, r2.code, "|", (r2.error ?? "").slice(0, 150));
if (r2.code !== "OVERLAP_CONFIRM") problems.push("lớp thứ 2 phải hỏi lại, không phải chặn thẳng");

console.log("3) lớp thứ 2, người dùng bấm đồng ý:");
const r2ok = await call(classes[1].session.id, true);
console.log("   →", JSON.stringify(r2ok));
if (r2ok.status !== 201) problems.push("đồng ý rồi vẫn không xếp được lớp thứ 2");

console.log("4) lớp thứ 3 cùng giờ, kể cả đồng ý:");
const r3 = await call(classes[2].session.id, true);
console.log("   →", r3.status, r3.code, "|", (r3.error ?? "").slice(0, 160));
if (r3.code !== "OVERLAP_BLOCKED") problems.push("lớp thứ 3 phải bị chặn");

// Kiểm tra trên giao diện: form phân công hiện hộp hỏi
const [, secondCls] = classes;
await page.goto(`${BASE}/classes/${classes[2].cls.id}/sessions/${classes[2].session.id}`, { waitUntil: "networkidle2", timeout: 180000 });
await wait(2500);
let dialogText = null;
page.on("dialog", async (dialog) => { dialogText = dialog.message(); await dialog.dismiss(); });
const uiHas = await page.evaluate(() => Boolean([...document.querySelectorAll("select")].length));
console.log("\n5) mở trang buổi học lớp thứ 3:", uiHas ? "có form phân công" : "(không thấy form)");
await page.screenshot({ path: "ui-shots/v-overlap-session.png" });

console.log("\nproblems:", problems);
await browser.close();
await db.$disconnect();
