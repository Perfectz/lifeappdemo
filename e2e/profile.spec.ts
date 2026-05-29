import { expect, test } from "./test-base";

test.describe("Hero profile", () => {
  test("renaming the hero updates the sidebar avatar card", async ({ page }, testInfo) => {
    // The avatar card is only visible at desktop widths.
    test.skip(testInfo.project.name !== "chromium", "Avatar card is desktop-only");

    await page.goto("/settings");
    const input = page.getByLabel("Hero name");
    await input.fill("Aria");
    await input.blur();

    // Hero card strong reflects the new name without a reload.
    await expect(
      page.locator(".avatar-card-stats strong").filter({ hasText: "Aria" })
    ).toBeVisible();

    // And it persists across reload.
    await page.reload();
    await expect(
      page.locator(".avatar-card-stats strong").filter({ hasText: "Aria" })
    ).toBeVisible();
  });
});
