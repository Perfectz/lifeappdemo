import { describe, expect, it } from "vitest";

import {
  emptyBodyProfile,
  hasCompletedSetup,
  isBodyProfile,
  withBodyProfileEdits
} from "@/domain/bodyProfile";

describe("body profile", () => {
  it("starts empty and not set up", () => {
    const profile = emptyBodyProfile("2026-06-18T00:00:00.000Z");
    expect(profile.setupCompleted).toBe(false);
    expect(hasCompletedSetup(profile)).toBe(false);
    expect(isBodyProfile(profile)).toBe(true);
  });

  it("records stats and completion", () => {
    const next = withBodyProfileEdits(emptyBodyProfile(), {
      sex: "male",
      age: 41,
      heightInches: 71,
      activityLevel: "light",
      setupCompleted: true
    });
    expect(hasCompletedSetup(next)).toBe(true);
    expect(next.age).toBe(41);
    expect(isBodyProfile(next)).toBe(true);
  });

  it("rejects malformed profiles", () => {
    expect(isBodyProfile(null)).toBe(false);
    expect(isBodyProfile({ setupCompleted: "yes", updatedAt: "x" })).toBe(false);
    expect(isBodyProfile({ setupCompleted: true, updatedAt: "x", age: -3 })).toBe(false);
    expect(isBodyProfile({ setupCompleted: true, updatedAt: "x", sex: "other" })).toBe(false);
  });
});
