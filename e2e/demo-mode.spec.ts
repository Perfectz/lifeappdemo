import { expect, test } from "@playwright/test";

const taskStorageKey = "lifequest.tasks.v1";
const metricStorageKey = "lifequest.metricEntries.v1";

test.describe("V16 Portfolio Demo Mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
  });

  test("enables demo mode, populates dashboard, then resets demo data while preserving real data", async ({
    page
  }) => {
    await page.evaluate(
      ({ tasksKey, metricsKey }) => {
        window.localStorage.setItem(
          tasksKey,
          JSON.stringify([
            {
              id: "real-task",
              title: "Real preserved quest",
              status: "todo",
              priority: "high",
              tags: ["work"],
              createdAt: "2026-05-05T09:00:00.000Z",
              updatedAt: "2026-05-05T09:00:00.000Z"
            }
          ])
        );
        window.localStorage.setItem(
          metricsKey,
          JSON.stringify([
            {
              id: "real-metric",
              date: "2026-05-05",
              checkInType: "morning",
              source: "manual",
              steps: 1111,
              recordedAt: "2026-05-05T09:00:00.000Z",
              createdAt: "2026-05-05T09:00:00.000Z",
              updatedAt: "2026-05-05T09:00:00.000Z"
            }
          ])
        );
      },
      { metricsKey: metricStorageKey, tasksKey: taskStorageKey }
    );

    await page.reload();
    await page.getByRole("button", { name: "Enable Demo Mode" }).click();
    await expect(page.getByText("Demo mode enabled with fake portfolio data.")).toBeVisible();
    await expect(page.locator(".demo-data-badge").first()).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.locator(".demo-data-badge").first()).toBeVisible();
    await expect(page.getByText("Screenshot-Ready Demo")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ship the portfolio-ready LifeQuest walkthrough" })).toBeVisible();

    await page.goto("/settings");
    await page.getByRole("button", { name: "Reset Demo Data" }).click();
    await expect(page.getByText(/Demo data reset/)).toBeVisible();

    const remaining = await page.evaluate(
      ({ tasksKey, metricsKey }) => ({
        metrics: JSON.parse(window.localStorage.getItem(metricsKey) ?? "[]"),
        tasks: JSON.parse(window.localStorage.getItem(tasksKey) ?? "[]")
      }),
      { metricsKey: metricStorageKey, tasksKey: taskStorageKey }
    );

    expect(remaining.tasks).toEqual([
      expect.objectContaining({ id: "real-task", title: "Real preserved quest" })
    ]);
    expect(remaining.metrics).toEqual([
      expect.objectContaining({ id: "real-metric", source: "manual", steps: 1111 })
    ]);
    expect(JSON.stringify(remaining)).not.toContain("demo-");
  });
});
