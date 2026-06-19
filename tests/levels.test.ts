import { describe, expect, it } from "vitest";

import { MAX_LEVEL, levelFromJourney } from "@/domain/levels";

describe("transformation levels", () => {
  it("starts at level 1 on day one (0% journey)", () => {
    const info = levelFromJourney(0);
    expect(info.level).toBe(1);
    expect(info.maxLevel).toBe(MAX_LEVEL);
    expect(info.isMaxLevel).toBe(false);
    expect(info.title).toBe("Day One");
  });

  it("reaches max level at the goal (100% journey)", () => {
    const info = levelFromJourney(100);
    expect(info.level).toBe(MAX_LEVEL);
    expect(info.isMaxLevel).toBe(true);
    expect(info.percentIntoLevel).toBe(100);
    expect(info.title).toMatch(/Patrick 2\.0/);
  });

  it("places the midpoint near the middle level", () => {
    const info = levelFromJourney(50);
    expect(info.level).toBeGreaterThan(MAX_LEVEL / 2 - 3);
    expect(info.level).toBeLessThan(MAX_LEVEL / 2 + 3);
    expect(info.isMaxLevel).toBe(false);
  });

  it("clamps out-of-range journey values", () => {
    expect(levelFromJourney(-20).level).toBe(1);
    expect(levelFromJourney(140).level).toBe(MAX_LEVEL);
  });

  it("reports XP progress within a level (0–100)", () => {
    const info = levelFromJourney(37);
    expect(info.percentIntoLevel).toBeGreaterThanOrEqual(0);
    expect(info.percentIntoLevel).toBeLessThanOrEqual(100);
  });
});
