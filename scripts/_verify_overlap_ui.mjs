import puppeteer from "puppeteer-core";
import { PrismaClient } from "@prisma/client";
const BASE = "http://localhost:3001";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const db = new PrismaClient();

const branch = await db.branch.findFirstOrThrow();
const gv = await db.employee.findFirstOrThrow({ where: { workStatus: "ACTIVE" } });
const date = new Date("2026-11-10T00:00:00.000Z");
const mk = async (code) => {
  const cls = await db.class.upsert({
    where: { classCode: code },
    update: {},
    create: { branchId: branch.id, classCode: code, className: `Lớp UI ${code}`, status: "ACTIVE", tuitionPerSession: 100000, totalSessions: 10 },
  });
  const session = await db.classSession.create({ data: { classId: cls.id, sessionDate: date, startTime: "17:30", endTime: "19:00", status: "PLANNED" } });
  return { cls, session };
};
const a = await mk("UIOVL-A");
const b = await mk("UIOVL-B");
await db.sessionAssignment.create({ data: { sessionId: a.session.id, employeeId: gv.id, role: "TEACHER", hours: 1.5, hourlyRate: 200000, amount: 300000 } });
console.log("đã có:", gv.fullName, "dạy lớp UIOVL-A 17:30–19:00 ngày 10/11/2026");

const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"], defaultViewport: { width: 1500, height: 1050 } });
const page = await browser.newPage();
let dialogMessage = null;
page.on("dialog", async (dialog) => { dialogMessage = dialog.message(); await dialog.accept(); });
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 180000 });
await page.waitForSelector('input[type="email"]');
await page.type('input[type="email"]', "admin@demo.vn");
await page.type('input[type="password"]', "Demo@123");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), page.click('button[type="submit"]')]);
await wait(1500);

await page.goto(`${BASE}/classes/${b.cls.id}/sessions/${b.session.id}`, { waitUntil: "networkidle2", timeout: 180000 });
await wait(2500);
const picked = await page.evaluate((employeeName) => {
  const selects = [...document.querySelectorAll("select")];
  const staff = selects.find((s) => [...s.options].some((o) => o.text.includes(employeeName)));
  if (!staff) return null;
  const option = [...staff.options].find((o) => o.text.includes(employeeName));
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(staff, option.value);
  staff.dispatchEvent(new Event("change", { bubbles: true }));
  return option.text;
}, gv.fullName);
console.log("chọn nhân sự trên form:", picked);
await wait(500);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => /Phân công|Thêm nhân sự|Gán/i.test(b.innerText));
  btn?.click();
});
await wait(3500);
console.log("hộp hỏi hiện ra:", dialogMessage ? `"${dialogMessage.slice(0, 140)}"` : "(KHÔNG có hộp hỏi)");
const saved = await db.sessionAssignment.findFirst({ where: { sessionId: b.session.id, employeeId: gv.id } });
console.log("sau khi bấm đồng ý → đã gán vào lớp thứ 2:", Boolean(saved));
await page.screenshot({ path: "ui-shots/v-overlap-ui.png" });
await browser.close();
await db.$disconnect();
