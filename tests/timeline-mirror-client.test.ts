import { afterEach, describe, expect, it, vi } from "vitest";

import { AINotConfiguredError } from "@/server/ai/openaiClient";
import {
  assessTimelineMirror,
  setTimelineMirrorForTests,
  type TimelineMirrorInput
} from "@/server/ai/timelineMirrorClient";

const baseInput: TimelineMirrorInput = {
  currentPhoto: { dataUrl: "data:image/jpeg;base64,AAAA", poseHint: "front_full_body" },
  references: [
    { role: "ideal", poseType: "front_full_body", dataUrl: "data:image/jpeg;base64,BBBB" },
    { role: "warning", poseType: "front_full_body", dataUrl: "data:image/jpeg;base64,CCCC" }
  ],
  idealMarkdown: "# Patrick 2.0\nLean, disciplined.",
  warningMarkdown: "# Shadow Patrick\nNeglect, tomorrow mode.",
  profileContext: "Goal weight 200 lbs.",
  lifeDataSummary: "Weight trend down 1 lb. Steps 8k/day."
};

function openAiJsonResponse(obj: unknown): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(obj) } }] }),
    { headers: { "content-type": "application/json" }, status: 200 }
  );
}

describe("assessTimelineMirror", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    setTimelineMirrorForTests(undefined);
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });

  it("uses the injected test run when present", async () => {
    setTimelineMirrorForTests(async () => ({
      timelineScore: 80,
      idealPercent: 80,
      warningPercent: 20,
      direction: "toward_ideal",
      backslideDetected: false,
      confidence: "high",
      photoTypeDetected: "front_full_body",
      photoUsability: {
        usable: true,
        qualityScore: 90,
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
        difficulty: "easy",
        xpReward: 10,
        category: "movement"
      },
      jrpgMessage: "j",
      coachNote: "c"
    }));

    const result = await assessTimelineMirror(baseInput);
    expect(result.timelineScore).toBe(80);
  });

  it("throws AINotConfiguredError without an API key", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(assessTimelineMirror(baseInput)).rejects.toBeInstanceOf(AINotConfiguredError);
  });

  it("sends the uploaded photo + references and parses the JSON reading", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      openAiJsonResponse({
        timelineScore: 64,
        direction: "toward_ideal",
        nextQuest: { title: "Walk", category: "movement" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await assessTimelineMirror(baseInput);

    expect(result.timelineScore).toBe(64);
    expect(result.idealPercent).toBe(64);
    expect(result.warningPercent).toBe(36);
    expect(result.nextQuest.title).toBe("Walk");

    // The request body should carry 3 images (1 uploaded + 2 references).
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const userContent = body.messages[1].content as Array<{ type: string }>;
    const imageBlocks = userContent.filter((c) => c.type === "image_url");
    expect(imageBlocks).toHaveLength(3);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("surfaces an OpenAI error response", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "model not found" } }), {
          headers: { "content-type": "application/json" },
          status: 404
        })
      )
    );
    await expect(assessTimelineMirror(baseInput)).rejects.toThrow();
  });
});
