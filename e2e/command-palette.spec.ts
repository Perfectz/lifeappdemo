import { expect, test } from "./test-base";

test.describe("Command palette", () => {
  test("opens with Ctrl+K, filters, and navigates on Enter", async ({ page }) => {
    await page.goto("/dashboard");

    // Open with Ctrl+K.
    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", { name: "Command menu" });
    await expect(dialog).toBeVisible();

    // Type to filter — Quest Log ranks first for "quest".
    await page.keyboard.type("quest");
    const list = dialog.getByRole("listbox");
    await expect(list.getByRole("option").first()).toContainText("Quest Log");

    // Press Enter to navigate to the top result.
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/tasks$/);
    await expect(dialog).toHaveCount(0);
  });

  test("Escape closes the palette without navigating", async ({ page }) => {
    await page.goto("/dashboard");

    await page.keyboard.press("Control+K");
    await expect(page.getByRole("dialog", { name: "Command menu" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Command menu" })).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
