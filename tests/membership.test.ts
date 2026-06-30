import { describe, expect, it } from "vitest";

import { APP_CREATOR_EMAIL, isAppCreator } from "@/client/membership";

describe("isAppCreator", () => {
  it("matches the creator email case-insensitively", () => {
    expect(isAppCreator(APP_CREATOR_EMAIL)).toBe(true);
    expect(isAppCreator("PZGambo@Gmail.com")).toBe(true);
    expect(isAppCreator("  pzgambo@gmail.com  ")).toBe(true);
  });

  it("rejects everyone else", () => {
    expect(isAppCreator("someone@else.com")).toBe(false);
    expect(isAppCreator(null)).toBe(false);
    expect(isAppCreator(undefined)).toBe(false);
    expect(isAppCreator("")).toBe(false);
  });
});
