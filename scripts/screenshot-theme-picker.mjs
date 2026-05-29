import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 1100 },
  deviceScaleFactor: 2
});
const page = await context.newPage();

const baseUrl = process.env.SHELL_SHOT_BASE_URL ?? "http://127.0.0.1:3000";
await page.goto(`${baseUrl}/settings`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: "tmp-theme-picker.png", fullPage: false });
await browser.close();
console.log("wrote tmp-theme-picker.png");
