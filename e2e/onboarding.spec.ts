import { expect, test } from "@playwright/test";

// Uses the raw test import (no onboarded-flag seed) to exercise the
// genuine first-run experience.
test.describe("First-run onboarding", () => {
  test("shows the welcome modal on a fresh start and dismisses it", async ({ page }) => {
    await page.goto("/dashboard");

    const dialog = page.getByRole("dialog", { name: "Welcome, hero" }).or(
      page.getByText("LifeQuest OS", { exact: true })
    );
    await expect(page.getByText("Add your first quest")).toBeVisible();

    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.getByText("Add your first quest")).toBeHidden();

    // Does not reappear after reload (flag persisted).
    await page.reload();
    await expect(page.getByText("Add your first quest")).toBeHidden();
    void dialog;
  });

  test("opens quick-add from the welcome CTA", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Add your first quest" }).click();

    // Quick-add dialog appears.
    const dialog = page.getByRole("dialog", { name: "Quick add quest" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Quest title").fill("My first quest");
    await dialog.getByRole("button", { name: "Add Quest" }).click();

    await page.goto("/tasks");
    await expect(page.getByText("My first quest")).toBeVisible();
  });
});
