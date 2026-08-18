import { chromium } from "playwright";

const BASE = "http://localhost:3100";
const OUT = "C:\\Users\\lehoa\\AppData\\Local\\Temp\\claude\\c--Users-lehoa-Downloads-ERP-TrungTamHocVu\\d22917a0-b9eb-4100-853d-caf3b1d0261d\\scratchpad";

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.getByText("Dùng ngay", { exact: false }).first().click();
  await page.waitForTimeout(300);
  const submitBtn = page.locator('button[type="submit"]');
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login")),
    submitBtn.click(),
  ]);
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function run() {
  const browser = await chromium.launch({
    executablePath: "C:\\Users\\lehoa\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe",
  });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await context.newPage();
  await login(page);
  await page.goto(`${BASE}/students`);
  await page.waitForLoadState("networkidle");

  const rowCount = await page.locator("table tbody tr").count();
  console.log("student rows:", rowCount);

  // Try a few rows to find one with richer charge/payment history for the Học phí table.
  let picked = 0;
  for (let i = 0; i < Math.min(rowCount, 6); i++) {
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState("networkidle");
    await page.locator("table tbody tr").nth(i).click();
    await page.waitForURL(/\/students\/[^/]+$/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    picked = i;
    break; // just use first row for tongquan/hoso; we'll try more rows for hocphi separately
  }

  await page.screenshot({ path: `${OUT}/redesign_tongquan.png`, fullPage: true });

  await page.locator('button.tab-item:has-text("Hồ sơ")').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/redesign_hoso.png`, fullPage: true });

  await page.locator('button.tab-item:has-text("Học phí")').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/redesign_hocphi_row0.png`, fullPage: true });

  // Try other rows to find richer Học phí data
  for (let i = 1; i < Math.min(rowCount, 8); i++) {
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState("networkidle");
    await page.locator("table tbody tr").nth(i).click();
    await page.waitForURL(/\/students\/[^/]+$/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await page.locator('button.tab-item:has-text("Học phí")').click();
    await page.waitForTimeout(700);
    const chargeRowCount = await page.locator("table").nth(1).locator("tbody tr").count().catch(() => 0);
    console.log(`row ${i} charge table rows:`, chargeRowCount);
    if (chargeRowCount > 1) {
      await page.screenshot({ path: `${OUT}/redesign_hocphi_richer.png`, fullPage: true });
      console.log("found richer row at index", i, "url:", page.url());
      break;
    }
  }

  console.log("done");
  await browser.close();
}

run().catch((err) => {
  console.error("SCRIPT ERROR:", err);
  process.exit(1);
});
