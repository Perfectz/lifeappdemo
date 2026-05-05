import { expect, test } from "@playwright/test";

test.describe("PWA install and stale-safe offline shell", () => {
  test("manifest and service worker installability basics are available", async ({ page }) => {
    await page.goto("/settings");

    const manifestResponse = await page.request.get("/manifest.webmanifest");
    expect(manifestResponse.ok()).toBe(true);
    const manifest = (await manifestResponse.json()) as {
      display?: string;
      icons?: Array<{ purpose?: string; sizes?: string; src?: string; type?: string }>;
      name?: string;
      scope?: string;
      short_name?: string;
      start_url?: string;
      theme_color?: string;
    };

    expect(manifest.name).toBe("LifeQuest OS");
    expect(manifest.short_name).toBe("LifeQuest");
    expect(manifest.start_url).toBe("/dashboard");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#101319");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }),
        expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }),
        expect.objectContaining({ src: "/icons/maskable-512.png", purpose: "maskable" })
      ])
    );

    await expect(page.getByText("Install Readiness")).toBeVisible();
    await expect(page.getByText("Android Install Steps")).toBeVisible();
    await expect(page.getByText("Offline Boundary")).toBeVisible();
    await expect.poll(async () => page.evaluate(() => Boolean(navigator.serviceWorker))).toBe(true);
  });

  test("offline reload shows a useful shell after first load", async ({ page, context }) => {
    try {
      await page.goto("/settings");
      await page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) {
          return;
        }
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
          await new Promise<void>((resolve) => {
            navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
              once: true
            });
            window.location.reload();
          });
        }
      });
      await page.waitForLoadState("domcontentloaded");

      await context.setOffline(true);
      await page.reload();

      if ((await page.getByRole("heading", { name: "LifeQuest OS" }).count()) > 0) {
        await expect(page.getByRole("heading", { name: "LifeQuest OS" })).toBeVisible();
        await expect(page.getByText("Offline Shell", { exact: true })).toBeVisible();
        await expect(
          page.getByText("App routes use fresh server HTML when online to avoid stale screens")
        ).toBeVisible();
      } else {
        await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
        await expect(page.getByRole("status")).toContainText(
          "PWA install and stale-safe offline shell"
        );
      }
    } finally {
      await context.setOffline(false);
    }
  });

  test("AI coach shows a network-required boundary while offline", async ({ page }) => {
    await page.goto("/coach");
    await expect(
      page
        .getByRole("region", { name: "AI coach chat" })
        .getByText("Task changes require confirmation", { exact: true })
    ).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false
      });
      window.dispatchEvent(new Event("offline"));
    });

    await page.getByLabel("Message").fill("Can you help me while offline?");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.locator(".form-error")).toContainText("AI features require network access");
  });
});
