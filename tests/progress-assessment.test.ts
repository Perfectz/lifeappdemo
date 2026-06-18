import { describe, expect, it } from "vitest";

import { parseProgressAssessment } from "@/domain/progressAssessment";

describe("progress assessment parsing", () => {
  it("parses a well-formed assessment", () => {
    const parsed = parseProgressAssessment({
      summary: "Visible leaning out vs. the goal.",
      alignment: "on_track",
      observations: ["Shoulders look broader", "Waist narrower"],
      encouragement: "Keep the streak going.",
      estimatedBodyFatRange: "20–24%"
    });
    expect(parsed.alignment).toBe("on_track");
    expect(parsed.observations).toHaveLength(2);
    expect(parsed.estimatedBodyFatRange).toBe("20–24%");
  });

  it("normalizes alignment variants and defaults to unclear", () => {
    expect(parseProgressAssessment({ alignment: "On Track" }).alignment).toBe("on_track");
    expect(parseProgressAssessment({ alignment: "needs-work" }).alignment).toBe("needs_work");
    expect(parseProgressAssessment({ alignment: "weird" }).alignment).toBe("unclear");
    expect(parseProgressAssessment({}).alignment).toBe("unclear");
  });

  it("is tolerant of garbage and missing fields", () => {
    const parsed = parseProgressAssessment(null);
    expect(parsed.summary).toBeTruthy();
    expect(parsed.observations).toEqual([]);
    expect(parsed.estimatedBodyFatRange).toBeUndefined();
  });

  it("drops non-string observations and caps the list", () => {
    const parsed = parseProgressAssessment({
      observations: ["ok", 5, null, "two", { x: 1 }]
    });
    expect(parsed.observations).toEqual(["ok", "two"]);
  });
});
