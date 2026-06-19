import { describe, expect, it } from "vitest";

import { getTransformation } from "@/domain/transformation";

describe("transformation stage", () => {
  it("starts at stage 1 with no progress", () => {
    const t = getTransformation({ alignmentPercent: 0 });
    expect(t.stage).toBe(1);
    expect(t.progressPercent).toBe(0);
  });

  it("uses alignment alone before a weight goal is set", () => {
    expect(getTransformation({ alignmentPercent: 100 }).stage).toBe(5);
    expect(getTransformation({ alignmentPercent: 50 }).stage).toBe(3);
  });

  it("weights long-term weight progress more than daily alignment", () => {
    // High weight progress, low alignment today → still advanced.
    const t = getTransformation({ weightProgressPercent: 100, alignmentPercent: 0 });
    expect(t.progressPercent).toBe(70);
    expect(t.stage).toBe(4);
  });

  it("reaches the final stage near the goal with consistency", () => {
    const t = getTransformation({ weightProgressPercent: 100, alignmentPercent: 80 });
    expect(t.stage).toBe(5);
    expect(t.label).toMatch(/future self/i);
  });
});
