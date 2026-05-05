import { expect, type Page, test } from "@playwright/test";

async function mockMicrophoneSuccess(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => undefined }]
        })
      }
    });
  });
}

async function mockMicrophoneDenied(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new Error("denied");
        }
      }
    });
  });
}

test.describe("V14 Voice Session Alpha", () => {
  test("starts a morning voice shell and hands transcript to text AI", async ({ page }) => {
    await mockMicrophoneSuccess(page);
    await page.route("**/api/realtime/session", async (route) => {
      const body = route.request().postDataJSON() as { mode: string };
      expect(body.mode).toBe("morning");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          clientSecret: "ek_test_morning_voice",
          expiresAt: "2026-05-05T09:10:00.000Z",
          mode: "morning",
          credentialSource: "mock"
        })
      });
    });

    await page.goto("/standup/morning");
    await expect(page.getByRole("button", { name: "Voice Mode" })).toBeEnabled();
    await page.getByRole("button", { name: "Voice Mode" }).click();
    await page.getByRole("button", { name: "Start Voice Session" }).click();

    await expect(page.getByText("active")).toBeVisible();
    await expect(page.getByText("granted")).toBeVisible();
    await expect(page.getByText("mock")).toBeVisible();

    await page.getByRole("button", { name: "Stop Voice Session" }).click();
    await expect(page.getByText("ended")).toBeVisible();
    await page.getByLabel("Transcript").fill("Voice said prioritize the launch quest.");
    await page.getByRole("button", { name: "Hand off to text AI" }).click();

    await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue(
      "[Voice transcript]\nVoice said prioritize the launch quest."
    );
    const localStorageDump = await page.evaluate(() =>
      Array.from({ length: window.localStorage.length }, (_, index) => {
        const key = window.localStorage.key(index);
        return key ? `${key}:${window.localStorage.getItem(key) ?? ""}` : "";
      }).join("\n")
    );
    expect(localStorageDump).not.toContain("ek_test_morning_voice");
  });

  test("shows evening text fallback when microphone permission is denied", async ({ page }) => {
    await mockMicrophoneDenied(page);

    await page.goto("/standup/evening");
    await expect(page.getByRole("button", { name: "Voice Mode" })).toBeEnabled();
    await page.getByRole("button", { name: "Voice Mode" }).click();
    await page.getByRole("button", { name: "Start Voice Session" }).click();

    await expect(
      page.getByRole("region", { name: "evening voice session" }).getByRole("alert")
    ).toHaveText(
      "Microphone permission was denied. Use text mode instead."
    );
    await expect(
      page.getByRole("region", { name: "evening voice session" }).getByText("denied", {
        exact: true
      })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Fallback to text mode" })).toBeVisible();
  });
});
