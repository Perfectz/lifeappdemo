import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/ai/timeline-mirror/route";
import { resetRateLimiter } from "@/server/ai/rateLimiter";
import { setTimelineMirrorForTests } from "@/server/ai/timelineMirrorClient";
import { AINotConfiguredError } from "@/server/ai/openaiClient";

const IMG = "data:image/jpeg;base64,AAAA";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/ai/timeline-mirror", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

const okResult = {
  timelineScore: 70,
  idealPercent: 70,
  warningPercent: 30,
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
    title: "Walk",
    description: "Walk 20 minutes.",
    difficulty: "easy" as const,
    xpReward: 30,
    category: "movement" as const
  },
  jrpgMessage: "j",
  coachNote: "c"
};

describe("/api/ai/timeline-mirror", () => {
  beforeEach(() => {
    resetRateLimiter();
  });
  afterEach(() => {
    setTimelineMirrorForTests(undefined);
  });

  it("rejects a request with no photo", async () => {
    const response = await POST(postRequest({}));
    expect(response.status).toBe(400);
  });

  it("rejects an invalid reference role", async () => {
    setTimelineMirrorForTests(async () => okResult);
    const response = await POST(
      postRequest({
        currentPhoto: { dataUrl: IMG },
        references: [{ role: "bogus", dataUrl: IMG }]
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns a parsed reading on success", async () => {
    setTimelineMirrorForTests(async () => okResult);
    const response = await POST(
      postRequest({
        currentPhoto: { dataUrl: IMG, poseType: "front_full_body" },
        references: [{ role: "ideal", poseType: "front_full_body", dataUrl: IMG }],
        idealMarkdown: "# Patrick 2.0",
        lifeDataSummary: "Steps up."
      })
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.timelineScore).toBe(70);
    expect(payload.nextQuest.title).toBe("Walk");
  });

  it("maps AINotConfiguredError to 503", async () => {
    setTimelineMirrorForTests(async () => {
      throw new AINotConfiguredError();
    });
    const response = await POST(postRequest({ currentPhoto: { dataUrl: IMG } }));
    expect(response.status).toBe(503);
  });

  it("rate limits after the window fills", async () => {
    setTimelineMirrorForTests(async () => okResult);
    let last: Response | undefined;
    for (let i = 0; i < 22; i += 1) {
      last = await POST(postRequest({ currentPhoto: { dataUrl: IMG } }));
    }
    expect(last?.status).toBe(429);
  });
});
