import { expect, test } from "@playwright/test";

test.describe("V05 AM/PM Metrics Check-In", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/metrics");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
  });

  test("logs morning metrics and updates the dashboard snapshot", async ({ page }) => {
    await expect(page.getByText("This app tracks personal patterns and reflections.")).toBeVisible();

    await page.getByLabel("Check-in type").selectOption("morning");
    await page.getByLabel("Sleep duration").fill("7.5");
    await page.getByLabel("Energy level").selectOption("4");
    await page.getByLabel("Mood level").selectOption("3");
    await page.getByLabel("Steps").fill("7200");
    await page.getByRole("button", { name: "Save Metrics" }).click();

    await expect(page.getByText("Metric check-in saved.")).toBeVisible();
    await expect(page.getByRole("heading", { name: / - morning$/ })).toBeVisible();
    await expect(page.getByText("Energy 4 | Mood 3 | Sleep 7.5h | 7200 steps")).toBeVisible();

    await page.goto("/dashboard");
    const metricsSection = page.getByRole("complementary", { name: "Dashboard actions" });
    await expect(metricsSection.getByText("Energy")).toBeVisible();
    await expect(metricsSection.getByText("4/5")).toBeVisible();
    await expect(metricsSection.getByText("Mood")).toBeVisible();
    await expect(metricsSection.getByText("3/5")).toBeVisible();
    await expect(metricsSection.getByText("Sleep")).toBeVisible();
    await expect(metricsSection.getByText("7.5h")).toBeVisible();
    await expect(metricsSection.getByText("Steps")).toBeVisible();
    await expect(metricsSection.getByText("7200")).toBeVisible();
  });

  test("logs evening metrics and shows recent entries", async ({ page }) => {
    await page.getByLabel("Check-in type").selectOption("morning");
    await page.getByLabel("Energy level").selectOption("5");
    await page.getByRole("button", { name: "Save Metrics" }).click();

    await page.getByLabel("Check-in type").selectOption("evening");
    await page.getByLabel("Energy level").selectOption("2");
    await page.getByLabel("Mood level").selectOption("2");
    await page.getByRole("button", { name: "Save Metrics" }).click();

    await expect(page.getByText("Metric check-in saved.")).toBeVisible();
    await expect(page.getByRole("heading", { name: / - evening$/ })).toBeVisible();
    await expect(page.getByText("Energy 2 | Mood 2")).toBeVisible();
  });

  test("blocks invalid blood pressure and negative steps", async ({ page }) => {
    await page.getByLabel("Steps").fill("-5");
    await page.getByRole("button", { name: "Save Metrics" }).click();
    await expect(
      page.getByRole("region", { name: "Metrics" }).getByRole("alert")
    ).toHaveText("Steps must be a non-negative whole number.");

    await page.getByLabel("Steps").fill("100");
    await page.getByLabel("Blood pressure systolic").fill("0");
    await page.getByRole("button", { name: "Save Metrics" }).click();
    await expect(
      page.getByRole("region", { name: "Metrics" }).getByRole("alert")
    ).toHaveText("Blood pressure systolic must be a positive whole number.");

    const entries = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("lifequest.metricEntries.v1") ?? "[]")
    );
    expect(entries).toHaveLength(0);
  });
});
