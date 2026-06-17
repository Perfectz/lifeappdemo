import { describe, expect, it } from "vitest";

import { parseVisionResult, shouldRequestDetail } from "@/domain/visionUpdates";

describe("vision update parsing", () => {
  it("normalizes a well-formed model response", () => {
    const result = parseVisionResult({
      summary: "A steps screenshot showing 8,240 steps.",
      confidence: "high",
      proposals: [
        { tool: "log_metric", args: { steps: 8240 }, label: "Log 8,240 steps" }
      ]
    });
    expect(result).toMatchObject({
      summary: "A steps screenshot showing 8,240 steps.",
      confidence: "high"
    });
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]).toMatchObject({ tool: "log_metric", label: "Log 8,240 steps" });
    expect(shouldRequestDetail(result)).toBe(false);
  });

  it("defaults to low confidence and drops malformed proposals", () => {
    const result = parseVisionResult({
      summary: "Blurry.",
      proposals: [{ args: { steps: 1 } }, { tool: "log_metric", args: { steps: 500 }, label: "Log 500 steps" }]
    });
    expect(result.confidence).toBe("low");
    expect(result.proposals).toHaveLength(1);
  });

  it("supplies a fallback question when nothing is proposed", () => {
    const result = parseVisionResult({ summary: "Can't tell.", confidence: "low", proposals: [] });
    expect(result.question).toBeTruthy();
    expect(shouldRequestDetail(result)).toBe(true);
  });

  it("flags low confidence or an explicit question as needing detail", () => {
    expect(
      shouldRequestDetail(
        parseVisionResult({
          summary: "Maybe a run.",
          confidence: "medium",
          question: "Was that miles or kilometers?",
          proposals: [{ tool: "log_cardio", args: { activity: "run" }, label: "Log a run" }]
        })
      )
    ).toBe(true);
  });

  it("handles non-object input safely", () => {
    expect(parseVisionResult(null).proposals).toEqual([]);
    expect(parseVisionResult("oops").confidence).toBe("low");
  });
});
