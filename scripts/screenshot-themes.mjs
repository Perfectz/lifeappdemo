import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 1100 },
  deviceScaleFactor: 2
});
const page = await context.newPage();

const baseUrl = process.env.SHELL_SHOT_BASE_URL ?? "http://127.0.0.1:3000";

for (const theme of ["psx", "gameboy", "amber"]) {
  await page.addInitScript((t) => {
    window.localStorage.setItem("lifequest.onboarded.v1", "true");
    window.localStorage.setItem("lifequest.suppressReminders", "true");
    if (t === "psx") {
      window.localStorage.removeItem("lifequest.theme.v1");
    } else {
      window.localStorage.setItem("lifequest.theme.v1", t);
    }
  }, theme);
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `tmp-theme-${theme}.png`, fullPage: false });
  console.log(`wrote tmp-theme-${theme}.png`);
}

await browser.close();
