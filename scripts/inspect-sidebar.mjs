import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 1100 },
  deviceScaleFactor: 1
});
const page = await context.newPage();

await page.goto("http://127.0.0.1:3000/dashboard", { waitUntil: "networkidle" });
await page.waitForTimeout(500);

const rects = await page.evaluate(() => {
  function info(sel) {
    const el = document.querySelector(sel);
    if (!el) return { sel, missing: true };
    const r = el.getBoundingClientRect();
    return {
      sel,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      height: Math.round(r.height),
      display: getComputedStyle(el).display,
      visibility: getComputedStyle(el).visibility
    };
  }
  return [
    info("aside.sidebar"),
    info("nav.nav-list"),
    info("nav.nav-footer"),
    info('a[href="/settings"]')
  ];
});

console.log(JSON.stringify(rects, null, 2));
await browser.close();
