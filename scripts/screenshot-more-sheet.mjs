import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 393, height: 851 },
  deviceScaleFactor: 2
});
const page = await context.newPage();

const baseUrl = process.env.SHELL_SHOT_BASE_URL ?? "http://127.0.0.1:3000";
await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.locator('button.mobile-tabbar-link-more').click();
await page.waitForTimeout(350);
await page.screenshot({ path: "tmp-step-d-more-open.png", fullPage: false });
await browser.close();
console.log("wrote tmp-step-d-more-open.png");
