import { expect, test } from "./test-base";

test.describe("Quest celebration", () => {
  test("completing a quest shows a celebration overlay", async ({ page }) => {
    await page.goto("/tasks");

    await page.getByLabel("Quest Title").fill("Defeat the inbox");
    await page.getByRole("button", { name: "Add Quest" }).click();
    await expect(page.getByText("Defeat the inbox")).toBeVisible();

    // Complete it.
    await page.getByRole("button", { name: "Complete" }).first().click();

    // Celebration overlay appears with the JRPG flourish.
    await expect(page.getByText("QUEST COMPLETE!")).toBeVisible();
    await expect(
      page.locator(".celebration-card").getByText("Defeat the inbox")
    ).toBeVisible();
  });
});
