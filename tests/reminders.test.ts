import { afterEach, describe, expect, it } from "vitest";

import {
  areBrowserRemindersEnabled,
  markBrowserReminderFired,
  setBrowserRemindersEnabled,
  shouldFireBrowserReminder
} from "@/client/reminders";

afterEach(() => {
  window.localStorage.clear();
});

describe("browser reminder preferences", () => {
  it("defaults to disabled", () => {
    expect(areBrowserRemindersEnabled(window.localStorage)).toBe(false);
  });

  it("persists the enabled flag", () => {
    setBrowserRemindersEnabled(window.localStorage, true);
    expect(areBrowserRemindersEnabled(window.localStorage)).toBe(true);
    setBrowserRemindersEnabled(window.localStorage, false);
    expect(areBrowserRemindersEnabled(window.localStorage)).toBe(false);
  });

  it("fires at most once per day when enabled", () => {
    setBrowserRemindersEnabled(window.localStorage, true);
    expect(shouldFireBrowserReminder(window.localStorage, "2026-05-26")).toBe(true);
    markBrowserReminderFired(window.localStorage, "2026-05-26");
    expect(shouldFireBrowserReminder(window.localStorage, "2026-05-26")).toBe(false);
    // A new day re-arms it.
    expect(shouldFireBrowserReminder(window.localStorage, "2026-05-27")).toBe(true);
  });

  it("never fires when disabled", () => {
    expect(shouldFireBrowserReminder(window.localStorage, "2026-05-26")).toBe(false);
  });
});
