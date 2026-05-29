import { chromium } from "@playwright/test";

const path = process.argv[2] ?? "/dashboard";
const variant = process.argv[3] ?? "desktop";
const outFile =
  process.argv[4] ?? `tmp-shell-${variant}-${path.replace(/\W+/g, "-").replace(/^-|-$/g, "")}.png`;

const viewport =
  variant === "mobile"
    ? { width: 393, height: 851 }
    : variant === "tall"
      ? { width: 1280, height: 1100 }
      : { width: 1280, height: 800 };

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport,
  deviceScaleFactor: 2
});
const page = await context.newPage();

const baseUrl = process.env.SHELL_SHOT_BASE_URL ?? "http://127.0.0.1:3000";
await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
await page.waitForTimeout(400);
await page.screenshot({ path: outFile, fullPage: false });

await browser.close();
console.log(`wrote ${outFile}`);
