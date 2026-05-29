import { expect, test } from "./test-base";

test.describe("Data backup & restore", () => {
  test("exports a JSON backup of stored data", async ({ page }) => {
    await page.goto("/tasks");
    // Seed a quest so there is data to back up.
    await page.getByLabel("Quest Title").fill("Backup me");
    await page.getByRole("button", { name: "Add Quest" }).click();
    await expect(page.getByText("Backup me")).toBeVisible();

    await page.goto("/settings");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download backup (JSON)" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^lifequest-backup-.*\.json$/);
  });

  test("restores data from an uploaded backup file", async ({ page }) => {
    await page.goto("/settings");

    const backup = {
      app: "lifequest-os",
      schemaVersion: 1,
      exportedAt: "2026-05-26T08:00:00.000Z",
      data: {
        "lifequest.tasks.v1": [
          {
            id: "restored-1",
            title: "Restored quest",
            status: "todo",
            priority: "medium",
            tags: [],
            createdAt: "2026-05-26T08:00:00.000Z",
            updatedAt: "2026-05-26T08:00:00.000Z"
          }
        ]
      }
    };

    await page.setInputFiles('input[aria-label="Choose a LifeQuest backup file"]', {
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup))
    });

    // The panel reloads ~700ms after a successful restore; wait for that
    // navigation to complete before navigating again to avoid aborting it.
    await page.waitForTimeout(1500);
    await page.goto("/tasks", { waitUntil: "load" });
    await expect(page.getByText("Restored quest")).toBeVisible();
  });
});
