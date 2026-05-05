import { expect, test } from "@playwright/test";

const taskStorageKey = "lifequest.tasks.v1";

function todayIsoDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
}

async function seedTasks(page: import("@playwright/test").Page, tasks: unknown[]) {
  await page.goto("/dashboard");
  await page.evaluate(
    ({ key, seededTasks }) => {
      window.localStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(seededTasks));
    },
    { key: taskStorageKey, seededTasks: tasks }
  );
}

test.describe("V02 Today Command Center", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
  });

  test("shows a task planned for today on the dashboard", async ({ page }) => {
    const today = todayIsoDate();

    await seedTasks(page, [
      {
        id: "planned-task",
        title: "Review today's quests",
        status: "todo",
        priority: "high",
        tags: [],
        plannedForDate: today,
        createdAt: `${today}T09:00:00.000Z`,
        updatedAt: `${today}T09:00:00.000Z`
      }
    ]);

    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
    await expect(page.getByText("LifeQuest OS Command Center")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Review today's quests" })).toBeVisible();
    await expect(page.getByText("Planned Today")).toBeVisible();
    await expect(page.getByText("Completed Today")).toBeVisible();
  });

  test("dashboard command buttons navigate to expected routes", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("link", { name: "Start Morning Stand-Up" }).click();
    await expect(page).toHaveURL(/\/standup\/morning$/);

    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Open Quest Log" }).click();
    await expect(page).toHaveURL(/\/tasks$/);

    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Log Metrics" }).click();
    await expect(page).toHaveURL(/\/metrics$/);

    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Start Evening Postmortem" }).click();
    await expect(page).toHaveURL(/\/standup\/evening$/);
  });
});
