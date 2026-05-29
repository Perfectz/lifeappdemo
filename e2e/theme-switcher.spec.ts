import { expect, test } from "./test-base";

test.describe("Menu theme switcher", () => {
  test("toggles between PSX, Game Boy and Amber and persists across reload", async ({
    page
  }) => {
    // Alternate themes unlock with hero level (Game Boy LV3, Amber LV5).
    // Seed 20 completed quests so the hero is LV5 and all skins are open.
    await page.addInitScript(() => {
      const completed = Array.from({ length: 20 }, (_, i) => ({
        id: `seed-${i}`,
        title: `Seed quest ${i}`,
        status: "done",
        priority: "medium",
        tags: [],
        completedAt: "2026-05-20T10:00:00.000Z",
        createdAt: "2026-05-20T09:00:00.000Z",
        updatedAt: "2026-05-20T10:00:00.000Z"
      }));
      window.localStorage.setItem("lifequest.tasks.v1", JSON.stringify(completed));
    });

    await page.goto("/settings");

    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);

    await page
      .getByRole("radio", { name: /Game Boy LCD/ })
      .check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "gameboy");

    // Reload should preserve the choice.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "gameboy");

    await page
      .getByRole("radio", { name: /CRT Amber/ })
      .check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "amber");

    await page
      .getByRole("radio", { name: /PSX Navy/ })
      .check();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  });
});
