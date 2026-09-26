import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COACH_FALLBACK_MODEL, COACH_MODEL, LIVE_VOICE_MODEL } from "@/config/ai";
import { createLiveSession } from "@/server/ai/liveClient";
import {
  activeCoachModel,
  isModelAccessError,
  openAIFetch,
  resetCoachModelFallbackForTests
} from "@/server/ai/modelFallback";

const URL = "https://api.openai.com/v1/chat/completions";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const modelMissing = () =>
  json(404, { error: { code: "model_not_found", message: `The model \`${COACH_MODEL}\` does not exist or you do not have access to it.` } });

function sentBody(mock: ReturnType<typeof vi.fn>, call: number): Record<string, unknown> {
  return JSON.parse((mock.mock.calls[call][1] as RequestInit).body as string) as Record<string, unknown>;
}

describe("coach model fallback", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    resetCoachModelFallbackForTests();
    process.env.OPENAI_API_KEY = "sk-test";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetCoachModelFallbackForTests();
    process.env.OPENAI_API_KEY = originalKey;
  });

  it("uses a different fallback model than the preferred one", () => {
    expect(COACH_FALLBACK_MODEL).not.toBe(COACH_MODEL);
    expect(activeCoachModel()).toBe(COACH_MODEL);
  });

  it("recognises model-access errors only", () => {
    expect(isModelAccessError(404, "model_not_found The model `x` does not exist")).toBe(true);
    expect(isModelAccessError(403, "You do not have access to model gpt-6-sol")).toBe(true);
    expect(isModelAccessError(400, "Unsupported parameter: 'temperature' is not supported with this model.")).toBe(false);
    expect(isModelAccessError(429, "model_not_found")).toBe(false);
  });

  it("retries once on the fallback model and remembers it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(modelMissing())
      .mockResolvedValue(json(200, { choices: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const body = JSON.stringify({ model: COACH_MODEL, reasoning_effort: "none", tools: [{}] });
    const first = await openAIFetch(URL, { method: "POST", body });
    expect(first.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(fetchMock, 1)).toMatchObject({ model: COACH_FALLBACK_MODEL, reasoning_effort: "low" });
    expect(activeCoachModel()).toBe(COACH_FALLBACK_MODEL);

    // Later requests skip the doomed first attempt.
    await openAIFetch(URL, { method: "POST", body });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sentBody(fetchMock, 2).model).toBe(COACH_FALLBACK_MODEL);
  });

  it("returns other errors untouched and leaves other models alone", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(400, { error: { message: "Invalid messages" } }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await openAIFetch(URL, { method: "POST", body: JSON.stringify({ model: COACH_MODEL }) });
    expect(res.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(activeCoachModel()).toBe(COACH_MODEL);

    await openAIFetch(URL, { method: "POST", body: JSON.stringify({ model: "gpt-4o-mini" }) });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back the GPT-Live backend model, not the voice model", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(modelMissing())
      .mockResolvedValue(json(200, { session: { id: "sess_1", model: LIVE_VOICE_MODEL }, transport: { sdp: "v=0\r\nanswer" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createLiveSession({ sdp: "v=0\r\noffer", mode: "general", tools: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retried = sentBody(fetchMock, 1) as { session: { model: string; delegation: { responses: { model: string } } } };
    expect(retried.session.model).toBe(LIVE_VOICE_MODEL);
    expect(retried.session.delegation.responses.model).toBe(COACH_FALLBACK_MODEL);
    expect(result.backendModel).toBe(COACH_FALLBACK_MODEL);
  });

  it("does not retry when GPT-Live itself is unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(404, { error: { code: "model_not_found", message: `The model \`${LIVE_VOICE_MODEL}\` does not exist.` } })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createLiveSession({ sdp: "v=0\r\noffer", mode: "general", tools: [] })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(activeCoachModel()).toBe(COACH_MODEL);
  });
});
