import { expect, test } from "@playwright/test";

const routes = [
  { label: "Dashboard", path: "/dashboard", heading: "Today" },
  { label: "Quest Log", path: "/tasks", heading: "Quest Log" },
  {
    label: "Morning Stand-Up",
    path: "/standup/morning",
    heading: "Morning Stand-Up"
  },
  {
    label: "Evening Postmortem",
    path: "/standup/evening",
    heading: "Evening Postmortem"
  },
  { label: "Metrics", path: "/metrics", heading: "Metrics" },
  { label: "Health Import", path: "/health-import", heading: "Health Import" },
  { label: "Journal", path: "/journal", heading: "Journal" },
  { label: "Reports", path: "/reports", heading: "Reports" },
  { label: "AI Coach", path: "/coach", heading: "AI Coach" },
  { label: "Settings", path: "/settings", heading: "Settings" }
];

test.describe("V00 walking skeleton navigation", () => {
  test("dashboard loads with shell navigation", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "LifeQuest OS dashboard" })
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  });

  for (const route of routes) {
    test(`${route.label} route loads from nav`, async ({ page }) => {
      await page.goto("/dashboard");
      const primaryNav = page.getByRole("navigation", { name: "Primary" });
      await primaryNav.locator(`a[href="${route.path}"]`).click();

      await expect(page).toHaveURL(new RegExp(`${route.path}$`));
      await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible();
      if (route.path === "/dashboard") {
        await expect(page.getByText("LifeQuest OS Command Center")).toBeVisible();
      } else if (route.path === "/tasks") {
        await expect(page.getByRole("button", { name: "Add Quest" })).toBeVisible();
      } else if (route.path === "/standup/morning") {
        await expect(page.getByRole("button", { name: "Save Daily Plan" })).toBeVisible();
      } else if (route.path === "/standup/evening") {
        await expect(page.getByRole("button", { name: "Save Postmortem" })).toBeVisible();
      } else if (route.path === "/metrics") {
        await expect(page.getByRole("button", { name: "Save Metrics" })).toBeVisible();
      } else if (route.path === "/health-import") {
        await expect(page.getByRole("button", { name: "Confirm Import" })).toBeVisible();
      } else if (route.path === "/journal") {
        await expect(page.getByRole("button", { name: "Save Journal Entry" })).toBeVisible();
      } else if (route.path === "/reports") {
        await expect(page.getByRole("button", { name: "Generate Preview" })).toBeVisible();
      } else if (route.path === "/coach") {
        await expect(
          page
            .getByRole("region", { name: "AI coach chat" })
            .getByText("Task changes require confirmation", { exact: true })
        ).toBeVisible();
      } else {
        await expect(page.getByRole("status")).toContainText("PWA install and stale-safe offline shell");
        await expect(page.getByText("Android Install Steps")).toBeVisible();
      }
    });
  }
});
