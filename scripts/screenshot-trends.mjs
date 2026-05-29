import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 1100 },
  deviceScaleFactor: 2
});
const page = await context.newPage();
const baseUrl = process.env.SHELL_SHOT_BASE_URL ?? "http://127.0.0.1:3000";

await page.addInitScript(() => {
  const tags = ["health", "work", "content", "admin"];
  const tasks = [];
  // 18 completed quests spread across the last 14 days.
  for (let i = 0; i < 18; i += 1) {
    const day = 26 - (i % 13);
    const iso = new Date(2026, 4, day, 10 + (i % 6)).toISOString();
    tasks.push({
      id: `done-${i}`,
      title: `Quest ${i}`,
      status: "done",
      priority: "medium",
      tags: [tags[i % tags.length]],
      completedAt: iso,
      createdAt: iso,
      updatedAt: iso
    });
  }
  // a few open ones
  for (let i = 0; i < 5; i += 1) {
    tasks.push({
      id: `open-${i}`,
      title: `Open ${i}`,
      status: "todo",
      priority: "medium",
      tags: ["admin"],
      plannedForDate: "2026-05-26",
      createdAt: "2026-05-26T09:00:00.000Z",
      updatedAt: "2026-05-26T09:00:00.000Z"
    });
  }
  window.localStorage.setItem("lifequest.tasks.v1", JSON.stringify(tasks));

  const metrics = [];
  for (let d = 0; d < 12; d += 1) {
    const date = `2026-05-${String(14 + d).padStart(2, "0")}`;
    metrics.push({
      id: `m-${d}`,
      date,
      checkInType: "morning",
      source: "manual",
      energyLevel: 2 + (d % 4),
      moodLevel: 3 + (d % 3),
      recordedAt: `${date}T07:00:00.000Z`,
      createdAt: `${date}T07:00:00.000Z`,
      updatedAt: `${date}T07:00:00.000Z`
    });
  }
  window.localStorage.setItem("lifequest.metricEntries.v1", JSON.stringify(metrics));
});

await page.goto(`${baseUrl}/trends`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: "tmp-phase6-trends.png" });
await browser.close();
console.log("wrote tmp-phase6-trends.png");
