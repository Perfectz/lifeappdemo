/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixtures use a `use` callback that is unrelated to React hooks. */
import { test as base, expect } from "@playwright/test";

/**
 * Shared test base that suppresses the first-run onboarding modal by
 * seeding the "onboarded" flag before any page script runs. The
 * onboarding flow has its own dedicated spec that uses the raw
 * @playwright/test import so it can exercise the first-run experience.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem("lifequest.onboarded.v1", "true");
        // The reminder banner is wall-clock dependent; suppress it in
        // tests so it doesn't intercept clicks or collide with other
        // role="status" regions. Its logic is unit-tested separately.
        window.localStorage.setItem("lifequest.suppressReminders", "true");
      } catch {
        // ignore
      }
    });
    await use(context);
  }
});

export { expect };
export type { Page } from "@playwright/test";
