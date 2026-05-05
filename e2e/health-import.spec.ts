import { expect, test } from "@playwright/test";

test.describe("V15 Health Import Alpha", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/health-import");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
  });

  test("uploads a fixture, previews it, confirms import, and metrics shows imported entries", async ({
    page
  }) => {
    await expect(page.getByRole("heading", { name: "Health Import" })).toBeVisible();
    await page.getByLabel("Health export file").setInputFiles({
      name: "samsung-step-count.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        [
          "start_time,steps",
          "2026-05-05T09:00:00Z,9300"
        ].join("\n")
      )
    });

    await expect(page.getByText("Dry-run preview ready: 1 record(s) parsed.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "steps" })).toBeVisible();
    await expect(page.getByText("Steps -> MetricEntry.steps")).toBeVisible();
    await page.getByRole("button", { name: "Confirm Import" }).click();
    await expect(page.getByText("Import complete: 1 metric entry saved.")).toBeVisible();

    await page.goto("/metrics");
    await expect(page.getByText("9300 steps")).toBeVisible();
    await expect(page.getByText("Source: samsung_export")).toBeVisible();

    await page.goto("/dashboard");
    const metricsSection = page.getByRole("complementary", { name: "Dashboard actions" });
    await expect(metricsSection.getByText("Steps")).toBeVisible();
    await expect(metricsSection.getByText("9300")).toBeVisible();
  });
});
