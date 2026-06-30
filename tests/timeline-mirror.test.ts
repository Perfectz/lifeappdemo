import { describe, expect, it } from "vitest";

import {
  isPoseType,
  isReferenceImageRole,
  isTimelineCheckin,
  isTimelineIdentityDoc,
  parseTimelineMirrorResult
} from "@/domain/timelineMirror";

describe("timeline mirror result parsing", () => {
  it("parses a well-formed result", () => {
    const parsed = parseTimelineMirrorResult({
      timelineScore: 68,
      idealPercent: 68,
      warningPercent: 32,
      direction: "toward_ideal",
      backslideDetected: false,
      confidence: "medium",
      photoTypeDetected: "face_upper_45",
      photoUsability: {
        usable: true,
        qualityScore: 78,
        issues: ["Office lighting is harsh"],
        retakeRecommended: false,
        retakeReason: null
      },
      visualSummary: "Stronger presence than the Warning reference.",
      dataSummary: "Engaged this week.",
      overallRead: "Act 1 hero training.",
      positiveSignal: "Still showing up.",
      warningSignal: "Watch the logs.",
      nextQuest: {
        title: "20-Minute Walk + Protein Anchor",
        description: "Walk 20 minutes, make the next meal protein-first.",
        difficulty: "easy",
        xpReward: 35,
        category: "movement"
      },
      jrpgMessage: "Mirror Crystal says: Patrick 2.0 remains unlocked.",
      coachNote: "One clean action."
    });

    expect(parsed.timelineScore).toBe(68);
    expect(parsed.idealPercent).toBe(68);
    expect(parsed.warningPercent).toBe(32);
    expect(parsed.direction).toBe("toward_ideal");
    expect(parsed.photoTypeDetected).toBe("face_upper_45");
    expect(parsed.nextQuest.xpReward).toBe(35);
    expect(parsed.nextQuest.category).toBe("movement");
  });

  it("clamps the score and derives the ideal/warning split", () => {
    const parsed = parseTimelineMirrorResult({ timelineScore: 140 });
    expect(parsed.timelineScore).toBe(100);
    expect(parsed.idealPercent).toBe(100);
    expect(parsed.warningPercent).toBe(0);

    const low = parseTimelineMirrorResult({ timelineScore: -20 });
    expect(low.timelineScore).toBe(0);
    expect(low.warningPercent).toBe(100);
  });

  it("ignores an incoherent model ideal percent and back-fills from the score", () => {
    const parsed = parseTimelineMirrorResult({ timelineScore: 70, idealPercent: 10 });
    // 10 is >5 away from 70, so it's discarded in favour of the score.
    expect(parsed.idealPercent).toBe(70);
    expect(parsed.warningPercent).toBe(30);
  });

  it("normalizes enum variants and defaults", () => {
    expect(parseTimelineMirrorResult({ direction: "Toward Ideal" }).direction).toBe("toward_ideal");
    expect(parseTimelineMirrorResult({ direction: "weird" }).direction).toBe("unclear");
    expect(parseTimelineMirrorResult({ confidence: "HIGH" }).confidence).toBe("high");
    expect(parseTimelineMirrorResult({ photoTypeDetected: "front-full-body" }).photoTypeDetected).toBe(
      "front_full_body"
    );
  });

  it("treats a toward_warning direction as a backslide", () => {
    const parsed = parseTimelineMirrorResult({ direction: "toward_warning" });
    expect(parsed.backslideDetected).toBe(true);
  });

  it("is tolerant of garbage and guarantees a usable shape", () => {
    const parsed = parseTimelineMirrorResult(null);
    expect(parsed.timelineScore).toBe(50);
    expect(parsed.idealPercent + parsed.warningPercent).toBe(100);
    expect(parsed.nextQuest.title).toBeTruthy();
    expect(parsed.nextQuest.difficulty).toBe("easy");
    expect(parsed.photoUsability.usable).toBe(true);
    expect(parsed.jrpgMessage).toBeTruthy();
  });

  it("marks an unusable photo and recommends a retake", () => {
    const parsed = parseTimelineMirrorResult({
      photoUsability: { usable: false, issues: ["Too dark to analyze"] }
    });
    expect(parsed.photoUsability.usable).toBe(false);
    expect(parsed.photoUsability.retakeRecommended).toBe(true);
  });

  it("caps and cleans the quest fields", () => {
    const parsed = parseTimelineMirrorResult({
      nextQuest: { title: "Go", xpReward: 99999, difficulty: "EASY", category: "training" }
    });
    expect(parsed.nextQuest.xpReward).toBe(9999);
    expect(parsed.nextQuest.difficulty).toBe("easy");
    expect(parsed.nextQuest.category).toBe("training");
  });
});

describe("timeline mirror predicates", () => {
  it("validates roles and pose types", () => {
    expect(isReferenceImageRole("ideal")).toBe(true);
    expect(isReferenceImageRole("nope")).toBe(false);
    expect(isPoseType("front_full_body")).toBe(true);
    expect(isPoseType("sideways")).toBe(false);
  });

  it("validates identity docs", () => {
    const now = "2026-06-28T00:00:00.000Z";
    expect(
      isTimelineIdentityDoc({
        id: "1",
        docType: "ideal_version",
        title: "Patrick 2.0",
        markdownContent: "# Hero",
        createdAt: now,
        updatedAt: now
      })
    ).toBe(true);
    expect(isTimelineIdentityDoc({ id: "1", docType: "bogus" })).toBe(false);
  });

  it("validates check-ins", () => {
    expect(
      isTimelineCheckin({
        id: "1",
        date: "2026-06-28",
        detectedPoseType: "unknown",
        result: { timelineScore: 50 },
        createdAt: "2026-06-28T00:00:00.000Z"
      })
    ).toBe(true);
    expect(isTimelineCheckin({ id: "1" })).toBe(false);
  });
});
