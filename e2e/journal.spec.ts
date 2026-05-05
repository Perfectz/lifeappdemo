import { expect, test } from "@playwright/test";

const journalStorageKey = "lifequest.journalEntries.v1";

test.describe("V06 Journal and Lesson Capture", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/journal");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
  });

  test("creates, edits, refreshes, and deletes a journal entry", async ({ page }) => {
    await page.getByLabel("Entry type").selectOption("lesson");
    await page.getByLabel("Prompt").selectOption("What did I learn today?");
    await page.getByLabel("Content").fill("Small daily loops compound.");
    await page.getByRole("button", { name: "Save Journal Entry" }).click();

    await expect(page.getByText("Journal entry saved.")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Recent journal entries" }).getByText("What did I learn today?")
    ).toBeVisible();
    await expect(page.getByText("Small daily loops compound.")).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Content").fill("Edited lesson for tomorrow.");
    await page.getByRole("button", { name: "Save Journal Edit" }).click();

    await expect(page.getByText("Journal entry updated.")).toBeVisible();
    await expect(page.getByText("Edited lesson for tomorrow.")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Edited lesson for tomorrow.")).toBeVisible();

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toBe("Delete this journal entry?");
      await dialog.accept();
    });
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("Journal entry deleted.")).toBeVisible();
    await expect(page.getByText("Edited lesson for tomorrow.")).not.toBeVisible();

    const entries = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    }, journalStorageKey);
    expect(entries).toHaveLength(0);
  });

  test("highlights entries for the selected date", async ({ page }) => {
    await page.evaluate((key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify([
          {
            id: "today",
            date: "2026-05-04",
            type: "freeform",
            content: "Today entry",
            source: "manual",
            createdAt: "2026-05-04T09:00:00.000Z",
            updatedAt: "2026-05-04T09:00:00.000Z"
          },
          {
            id: "tomorrow",
            date: "2026-05-05",
            type: "freeform",
            content: "Tomorrow entry",
            source: "manual",
            createdAt: "2026-05-05T09:00:00.000Z",
            updatedAt: "2026-05-05T09:00:00.000Z"
          }
        ])
      );
    }, journalStorageKey);
    await page.reload();

    await page.getByLabel("Selected date").fill("2026-05-05");

    await expect(page.getByText("1 entry on selected date.")).toBeVisible();
    const selectedCard = page.locator(".journal-entry-card").filter({ hasText: "Tomorrow entry" });
    await expect(selectedCard).toHaveClass(/journal-entry-card-selected/);
  });
});
