import { describe, expect, it } from "vitest";

import { isThemeUnlocked } from "@/client/theme";
import {
  getHeroRank,
  getStreakMilestone,
  isStreakMilestone
} from "@/domain/progression";

describe("getStreakMilestone", () => {
  it("returns the highest milestone reached", () => {
    expect(getStreakMilestone(0)).toBeNull();
    expect(getStreakMilestone(2)).toBeNull();
    expect(getStreakMilestone(3)).toBe(3);
    expect(getStreakMilestone(6)).toBe(3);
    expect(getStreakMilestone(7)).toBe(7);
    expect(getStreakMilestone(45)).toBe(30);
    expect(getStreakMilestone(200)).toBe(100);
  });

  it("detects exact milestone days", () => {
    expect(isStreakMilestone(7)).toBe(true);
    expect(isStreakMilestone(8)).toBe(false);
  });
});

describe("getHeroRank", () => {
  it("ranks up with level", () => {
    expect(getHeroRank(1)).toBe("Novice");
    expect(getHeroRank(2)).toBe("Apprentice");
    expect(getHeroRank(5)).toBe("Adventurer");
    expect(getHeroRank(10)).toBe("Veteran");
    expect(getHeroRank(15)).toBe("Champion");
    expect(getHeroRank(25)).toBe("Legend");
  });
});

describe("isThemeUnlocked", () => {
  it("gates alternate themes behind levels", () => {
    expect(isThemeUnlocked("psx", 1)).toBe(true);
    expect(isThemeUnlocked("gameboy", 2)).toBe(false);
    expect(isThemeUnlocked("gameboy", 3)).toBe(true);
    expect(isThemeUnlocked("amber", 4)).toBe(false);
    expect(isThemeUnlocked("amber", 5)).toBe(true);
  });
});
