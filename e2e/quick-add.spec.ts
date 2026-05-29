import { expect, test } from "./test-base";

test.describe("Quick add quest", () => {
  test("adds a quest from the command palette action", async ({ page }) => {
    await page.goto("/dashboard");

    await page.keyboard.press("Control+K");
    const palette = page.getByRole("dialog", { name: "Command menu" });
    await expect(palette).toBeVisible();
    await palette.getByLabel("Command search").fill("new quest");
    await palette.getByRole("option", { name: /New Quest/ }).first().click();

    const dialog = page.getByRole("dialog", { name: "Quick add quest" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Quest title").fill("Palette quest");
    await dialog.getByRole("button", { name: "Add Quest" }).click();

    await page.goto("/tasks");
    await expect(page.getByText("Palette quest")).toBeVisible();
  });
});
