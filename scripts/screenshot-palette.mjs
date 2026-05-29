import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2
});
const page = await context.newPage();

const baseUrl = process.env.SHELL_SHOT_BASE_URL ?? "http://127.0.0.1:3000";
await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.keyboard.press("Control+K");
await page.waitForTimeout(220);
await page.screenshot({ path: "tmp-step-e-palette.png", fullPage: false });

await page.keyboard.type("quest");
await page.waitForTimeout(150);
await page.screenshot({ path: "tmp-step-e-palette-filter.png", fullPage: false });

await browser.close();
console.log("wrote tmp-step-e-palette.png + tmp-step-e-palette-filter.png");
