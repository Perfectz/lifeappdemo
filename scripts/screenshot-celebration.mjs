import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2
});
const page = await context.newPage();
const baseUrl = process.env.SHELL_SHOT_BASE_URL ?? "http://127.0.0.1:3000";

await page.goto(`${baseUrl}/tasks`, { waitUntil: "networkidle" });
await page.getByLabel("Quest Title").fill("Slay the dragon of procrastination");
await page.getByRole("button", { name: "Add Quest" }).click();
await page.getByText("Slay the dragon of procrastination").waitFor();
await page.getByRole("button", { name: "Complete" }).first().click();
await page.waitForTimeout(450);
await page.screenshot({ path: "tmp-phase5-celebration.png" });
await browser.close();
console.log("wrote tmp-phase5-celebration.png");
