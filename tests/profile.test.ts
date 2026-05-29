import { afterEach, describe, expect, it } from "vitest";

import {
  defaultHeroName,
  maxHeroNameLength,
  readProfile,
  sanitizeHeroName,
  writeHeroName
} from "@/client/profile";

afterEach(() => {
  window.localStorage.clear();
});

describe("sanitizeHeroName", () => {
  it("trims and caps length", () => {
    expect(sanitizeHeroName("  Aria  ")).toBe("Aria");
    expect(sanitizeHeroName("x".repeat(100)).length).toBe(maxHeroNameLength);
  });

  it("falls back to the default for empty or non-string input", () => {
    expect(sanitizeHeroName("")).toBe(defaultHeroName);
    expect(sanitizeHeroName("   ")).toBe(defaultHeroName);
    expect(sanitizeHeroName(undefined)).toBe(defaultHeroName);
    expect(sanitizeHeroName(42)).toBe(defaultHeroName);
  });
});

describe("profile read/write", () => {
  it("defaults to the default hero name when nothing is stored", () => {
    expect(readProfile(window.localStorage).heroName).toBe(defaultHeroName);
  });

  it("persists and reads back a sanitized hero name", () => {
    const applied = writeHeroName("  Aria of the North  ", window.localStorage);
    expect(applied).toBe("Aria of the North");
    expect(readProfile(window.localStorage).heroName).toBe("Aria of the North");
  });

  it("ignores corrupt stored JSON", () => {
    window.localStorage.setItem("lifequest.profile.v1", "{broken");
    expect(readProfile(window.localStorage).heroName).toBe(defaultHeroName);
  });
});
