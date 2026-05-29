import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 1100 },
  deviceScaleFactor: 2
});
const page = await context.newPage();

const baseUrl = process.env.SHELL_SHOT_BASE_URL ?? "http://127.0.0.1:3000";

await page.addInitScript(() => {
  // Seed three overdue tasks (planned for two days ago, still todo).
  const overdueDate = "2026-05-22";
  const today = "2026-05-26";
  const tasks = [
    {
      id: "overdue-1",
      title: "Finish docs",
      status: "todo",
      priority: "medium",
      tags: [],
      plannedForDate: overdueDate,
      createdAt: `${overdueDate}T09:00:00.000Z`,
      updatedAt: `${overdueDate}T09:00:00.000Z`
    },
    {
      id: "overdue-2",
      title: "Buy groceries",
      status: "todo",
      priority: "low",
      tags: [],
      plannedForDate: overdueDate,
      createdAt: `${overdueDate}T09:00:00.000Z`,
      updatedAt: `${overdueDate}T09:00:00.000Z`
    },
    {
      id: "today-pending",
      title: "Walk the dog",
      status: "todo",
      priority: "medium",
      tags: [],
      plannedForDate: today,
      createdAt: `${today}T08:00:00.000Z`,
      updatedAt: `${today}T08:00:00.000Z`
    }
  ];
  window.localStorage.setItem("lifequest.tasks.v1", JSON.stringify(tasks));
  // Leave plans and postmortems empty so morning/evening pulse based on current hour.
});

await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.screenshot({ path: "tmp-step-i-pulses.png", fullPage: false });
await browser.close();
console.log("wrote tmp-step-i-pulses.png");
