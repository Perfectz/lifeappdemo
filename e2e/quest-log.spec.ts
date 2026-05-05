import { expect, test } from "@playwright/test";

test.describe("V01 Quest Log task CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
  });

  test("create, persist, complete, reopen, and archive a quest", async ({ page }) => {
    await expect(page.getByText("No quests yet. Add one small win.")).toBeVisible();

    await page.getByLabel("Quest Title").fill("Finish the V01 slice");
    await page.getByLabel("Description").fill("Keep the scope to Quest Log CRUD.");
    await page.getByLabel("Priority").selectOption("high");
    await page.getByLabel("work").check();
    await page.getByLabel("learning").check();
    await page.getByRole("button", { name: "Add Quest" }).click();

    const activeQuests = page.getByRole("region", { name: "Active Quests" });
    await expect(activeQuests.getByRole("heading", { name: "Finish the V01 slice" })).toBeVisible();
    await expect(activeQuests.getByText("high")).toBeVisible();
    await expect(activeQuests.getByText("work")).toBeVisible();

    await page.reload();
    await expect(activeQuests.getByRole("heading", { name: "Finish the V01 slice" })).toBeVisible();

    await activeQuests.getByRole("button", { name: "Complete" }).click();

    const clearedQuests = page.getByRole("region", { name: "Cleared Quests" });
    await expect(clearedQuests.getByRole("heading", { name: "Finish the V01 slice" })).toBeVisible();

    await clearedQuests.getByRole("button", { name: "Reopen" }).click();
    await expect(activeQuests.getByRole("heading", { name: "Finish the V01 slice" })).toBeVisible();

    await activeQuests.getByRole("button", { name: "Archive" }).click();

    const archived = page.getByRole("region", { name: "Archived" });
    await expect(archived.getByRole("heading", { name: "Finish the V01 slice" })).toBeVisible();
  });

  test("validates an empty title", async ({ page }) => {
    await page.getByRole("button", { name: "Add Quest" }).click();

    await expect(page.getByText("Quest title is required.")).toBeVisible();
    await expect(page.getByText("No quests yet. Add one small win.")).toBeVisible();
  });
});
