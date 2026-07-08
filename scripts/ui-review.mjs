/* One-shot visual review capture: desktop + mobile, all three themes.
   Usage: node scripts/ui-review.mjs  (expects dev server on :3100) */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:3100";
const OUT = "output/ui-review";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function shot(name, { width, height, theme, path: routePath, settle = 1200, burst = false }) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript((t) => {
    window.localStorage.setItem("lifequest.onboarded.v1", "true");
    if (t) window.localStorage.setItem("lifequest.theme.v1", t);
  }, theme ?? "");
  await page.goto(`${BASE}${routePath}`, { waitUntil: "domcontentloaded" });
  if (burst) {
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("lifequest:celebrate", {
          detail: { kind: "levelup", title: "LEVEL UP — LV 2", subtitle: "APPRENTICE" }
        })
      );
    });
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.close();
  console.log(`captured ${name}`);
}

await shot("desktop-dashboard", { width: 1280, height: 800, path: "/dashboard" });
await shot("desktop-dashboard-gameboy", { width: 1280, height: 800, path: "/dashboard", theme: "gameboy" });
await shot("desktop-dashboard-amber", { width: 1280, height: 800, path: "/dashboard", theme: "amber" });
await shot("desktop-settings", { width: 1280, height: 800, path: "/settings" });
await shot("mobile-dashboard", { width: 375, height: 812, path: "/dashboard" });
await shot("mobile-coach", { width: 375, height: 812, path: "/coach" });
await shot("mobile-vitals", { width: 375, height: 812, path: "/vitals" });
await shot("desktop-celebrate-burst", { width: 1280, height: 800, path: "/dashboard", burst: true });

await browser.close();
console.log("done");
