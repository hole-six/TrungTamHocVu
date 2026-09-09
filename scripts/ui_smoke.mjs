// Kiểm chứng giao diện THẬT: mở Chrome, đăng nhập, bấm từng nút, chụp màn hình và bắt
// mọi lỗi console/lỗi mạng. Dùng để không còn "nói khơi khơi" dựa trên truy vấn CSDL.
// Chạy: node scripts/ui_smoke.mjs
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:3000";
const OUT = "ui-shots";
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
const log = (...a) => console.log(...a);

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--window-size=1500,1000"],
    defaultViewport: { width: 1500, height: 1000 },
  });
  const page = await browser.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(`[console] ${page.url().replace(BASE, "")} :: ${msg.text().slice(0, 200)}`);
  });
  page.on("pageerror", (err) => problems.push(`[pageerror] ${page.url().replace(BASE, "")} :: ${String(err).slice(0, 200)}`));
  page.on("response", (res) => {
    if (res.status() >= 400 && res.url().startsWith(BASE)) {
      problems.push(`[http ${res.status()}] ${res.url().replace(BASE, "")}`);
    }
  });

  // ---- Đăng nhập ----
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  // Màn đăng nhập có hộp giới thiệu tài khoản demo che form — đóng trước khi gõ.
  for (const label of ["Để sau", "Đóng"]) {
    const btn = await page.$$eval("button", (els, l) => {
      const t = els.find((e) => (e.innerText || "").trim() === l && e.offsetParent !== null);
      if (t) { t.click(); return true; }
      return false;
    }, label).catch(() => false);
    if (btn) { log("đã đóng hộp:", label); await new Promise((r) => setTimeout(r, 400)); }
  }
  await page.click('input[type="email"]', { clickCount: 3 });
  await page.type('input[type="email"]', "admin@demo.vn", { delay: 12 });
  await page.click('input[type="password"]', { clickCount: 3 });
  await page.type('input[type="password"]', "Demo@123", { delay: 12 });
  const typed = await page.evaluate(() => ({
    email: document.querySelector('input[type="email"]')?.value,
    pwLen: document.querySelector('input[type="password"]')?.value?.length,
  }));
  log("đã gõ:", JSON.stringify(typed));
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await new Promise((r) => setTimeout(r, 1200));
  log("đăng nhập:", page.url().replace(BASE, "") || "/");
  await shot(page, "00-sau-dang-nhap");

  const pages = [
    ["dashboard", "Tổng quan"],
    ["leads", "CRM tuyển sinh"],
    ["students", "Học viên"],
    ["classes", "Lớp học"],
    ["calendar", "Thời khoá biểu"],
    ["session-credits", "Bổ trợ"],
    ["employees", "Nhân sự"],
    ["timesheets", "Chấm công"],
    ["payroll", "Lương"],
    ["tuition", "Học phí"],
    ["inventory", "Tài liệu"],
    ["reports", "Báo cáo"],
  ];

  for (const [path, label] of pages) {
    const before = problems.length;
    await page.goto(`${BASE}/${path}`, { waitUntil: "networkidle2" }).catch((e) => problems.push(`[goto] /${path} :: ${e.message}`));
    await new Promise((r) => setTimeout(r, 700));
    await shot(page, `page-${path.replace(/\//g, "_")}`);
    const buttons = await page.$$eval("button", (els) =>
      els.filter((el) => el.offsetParent !== null).map((el) => (el.innerText || "").trim()).filter(Boolean),
    );
    log(`\n=== /${path} (${label}) — ${buttons.length} nút hiện trên màn`);
    log("   nút:", [...new Set(buttons)].slice(0, 14).join(" | "));
    if (problems.length > before) log("   ⚠ lỗi mới:", problems.slice(before).join(" ;; "));
  }

  fs.writeFileSync("ui-shots/problems.txt", problems.join("\n"));
  log(`\n================ TỔNG: ${problems.length} vấn đề ================`);
  for (const p of [...new Set(problems)].slice(0, 40)) log(" -", p);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
