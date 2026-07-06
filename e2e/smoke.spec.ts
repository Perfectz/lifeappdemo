import { expect, test } from "./test-base";

/**
 * Smoke suite for the current app: every core screen loads and the primary
 * daily flows (log food, log vitals) actually persist. Intentionally resilient
 * — asserts stable headings/labels/roles rather than brittle copy. The older
 * detailed specs were removed when they fell behind major feature changes;
 * rebuild targeted specs on top of this as flows stabilize.
 */

test.describe("smoke: core screens load", () => {
  test("dashboard loads past the auth gate", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    // Past the login gate (no email field) and the app shell rendered.
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveCount(0);
    await expect(page.locator("main")).toBeVisible();
  });

  const screens = [
    { path: "/vitals", check: (p: import("@playwright/test").Page) => p.getByLabel(/Glucose/i).first() },
    { path: "/nutrition", check: (p: import("@playwright/test").Page) => p.getByRole("heading", { name: "Breakfast" }) },
    { path: "/fitness", check: (p: import("@playwright/test").Page) => p.getByText("0/3").first() },
    { path: "/character", check: (p: import("@playwright/test").Page) => p.getByRole("heading", { name: "Attributes" }) },
    { path: "/progress", check: (p: import("@playwright/test").Page) => p.getByRole("heading", { name: "Progress Photos", exact: true }) },
    { path: "/coach", check: (p: import("@playwright/test").Page) => p.getByRole("heading", { name: "AI Coach" }) },
    { path: "/standup/morning", check: (p: import("@playwright/test").Page) => p.getByRole("heading", { name: /Good morning/i }) }
  ];

  for (const screen of screens) {
    test(`${screen.path} renders`, async ({ page }) => {
      await page.goto(screen.path);
      await expect(screen.check(page)).toBeVisible();
    });
  }
});

test.describe("smoke: core daily flows persist", () => {
  test("log vitals saves a reading", async ({ page }) => {
    await page.goto("/vitals");
    await page.getByLabel(/Glucose/i).first().fill("96");
    await page.getByRole("button", { name: "Log vitals" }).click();
    await expect(page.getByText(/Logged today's vitals/i)).toBeVisible();
  });

  test("nutrition diary logs a food to a meal", async ({ page }) => {
    await page.goto("/nutrition");
    const breakfast = page.getByLabel("Breakfast");
    await breakfast.getByRole("button", { name: "Add food to Breakfast" }).click();
    await breakfast.getByPlaceholder("Food description").fill("Oatmeal");
    await breakfast.getByPlaceholder("cal").fill("320");
    await breakfast.getByRole("button", { name: /Add to Breakfast/i }).click();
    await expect(breakfast.getByText("Oatmeal")).toBeVisible();
  });
});

test.describe("smoke: AI coach chat shell", () => {
  test("coach exposes new chat + history controls", async ({ page }) => {
    await page.goto("/coach");
    await expect(page.getByRole("button", { name: "＋ New chat" })).toBeVisible();
    await expect(page.getByRole("button", { name: /History \(\d+\)/ })).toBeVisible();
    // Role-scoped: getByLabel("Message") substring-matches the dictation
    // button ("Dictate your message") too when speech recognition exists.
    await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
  });
});
