import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const baseUrl = process.env.SHELL_SHOT_BASE_URL ?? "http://127.0.0.1:3000";

// Onboarding (fresh, no seed).
{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "tmp-phase7-onboarding.png" });
  await context.close();
}

// Quick add (seed onboarded so welcome doesn't cover it).
{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.localStorage.setItem("lifequest.onboarded.v1", "true");
  });
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "New Quest" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "tmp-phase7-quickadd.png" });
  await context.close();
}

await browser.close();
console.log("wrote tmp-phase7-onboarding.png + tmp-phase7-quickadd.png");
