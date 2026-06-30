import { afterEach, describe, expect, it } from "vitest";

import { createTimelineReferenceRepository } from "@/data/timelineReferenceRepository";
import {
  createTimelineIdentityRepository,
  getTimelineIdentityDoc,
  upsertTimelineIdentityDoc
} from "@/data/timelineIdentityRepository";
import {
  addTimelineCheckin,
  loadTimelineCheckins
} from "@/data/timelineCheckinRepository";
import type {
  TimelineCheckin,
  TimelineIdentityDoc,
  TimelineReferenceImage
} from "@/domain/timelineMirror";

const now = "2026-06-28T12:00:00.000Z";

function makeResult(score: number) {
  return {
    timelineScore: score,
    idealPercent: score,
    warningPercent: 100 - score,
    direction: "toward_ideal" as const,
    backslideDetected: false,
    confidence: "medium" as const,
    photoTypeDetected: "front_full_body" as const,
    photoUsability: {
      usable: true,
      qualityScore: 80,
      issues: [],
      retakeRecommended: false,
      retakeReason: null
    },
    visualSummary: "v",
    dataSummary: "d",
    overallRead: "o",
    positiveSignal: "p",
    warningSignal: "w",
    nextQuest: {
      title: "t",
      description: "d",
      difficulty: "easy" as const,
      xpReward: 10,
      category: "movement" as const
    },
    jrpgMessage: "j",
    coachNote: "c"
  };
}

describe("timeline reference repository", () => {
  afterEach(() => window.localStorage.clear());

  it("round-trips reference images and drops invalid records", () => {
    const repo = createTimelineReferenceRepository(window.localStorage);
    const ref: TimelineReferenceImage = {
      id: "r1",
      role: "ideal",
      poseType: "front_full_body",
      imageLocalId: "img1",
      createdAt: now
    };
    repo.save([ref, { id: "bad" } as unknown as TimelineReferenceImage]);
    const loaded = repo.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].role).toBe("ideal");
  });
});

describe("timeline identity repository", () => {
  afterEach(() => window.localStorage.clear());

  it("keeps a single doc per type via upsert", () => {
    const base: TimelineIdentityDoc = {
      id: "d1",
      docType: "ideal_version",
      title: "Patrick 2.0",
      markdownContent: "# v1",
      createdAt: now,
      updatedAt: now
    };
    upsertTimelineIdentityDoc(base);
    upsertTimelineIdentityDoc({ ...base, id: "d2", markdownContent: "# v2", updatedAt: now });

    const all = createTimelineIdentityRepository(window.localStorage).load();
    expect(all).toHaveLength(1);
    expect(getTimelineIdentityDoc("ideal_version")?.markdownContent).toBe("# v2");
  });
});

describe("timeline check-in repository", () => {
  afterEach(() => window.localStorage.clear());

  it("stores check-ins newest-first", () => {
    const older: TimelineCheckin = {
      id: "c1",
      date: "2026-06-27",
      detectedPoseType: "front_full_body",
      result: makeResult(60),
      createdAt: "2026-06-27T12:00:00.000Z"
    };
    const newer: TimelineCheckin = {
      id: "c2",
      date: "2026-06-28",
      detectedPoseType: "front_full_body",
      result: makeResult(70),
      createdAt: "2026-06-28T12:00:00.000Z"
    };
    addTimelineCheckin(older);
    addTimelineCheckin(newer);

    const history = loadTimelineCheckins();
    expect(history.map((c) => c.id)).toEqual(["c2", "c1"]);
  });
});
