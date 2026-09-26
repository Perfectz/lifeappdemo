import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/live/session/route";
import { isReasoningModel, LIVE_BACKEND_MODEL, LIVE_VOICE_MODEL, requiresNoReasoningForChatTools } from "@/config/ai";
import {
  buildLiveSessionBody,
  parseLiveSessionResponse,
  setLiveSessionForTests,
  validateLiveSessionRequest
} from "@/server/ai/liveClient";
import { chatCompletionBody } from "@/server/ai/openaiClient";

const SDP = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\n";
const TOOL = {
  type: "function",
  name: "log_cardio",
  description: "Log a cardio session.",
  parameters: { type: "object", properties: { minutes: { type: "number" } }, required: ["minutes"] }
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/live/session", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  });
}

describe("model config", () => {
  it("treats gpt-6 models as reasoning models", () => {
    expect(isReasoningModel("gpt-6-sol")).toBe(true);
    expect(isReasoningModel("gpt-5.5")).toBe(true);
    expect(isReasoningModel("o3")).toBe(true);
    expect(isReasoningModel("gpt-4o")).toBe(false);
  });

  it("uses reasoning_effort none when gpt-6 chat completions carry tools", () => {
    expect(requiresNoReasoningForChatTools("gpt-6-sol")).toBe(true);
    const withTools = chatCompletionBody({ model: "gpt-6-sol", messages: [], maxCompletionTokens: 100, tools: [{}] });
    expect(withTools.reasoning_effort).toBe("none");
    const noTools = chatCompletionBody({ model: "gpt-6-sol", messages: [], maxCompletionTokens: 100, temperature: 0.4 });
    expect(noTools.reasoning_effort).toBe("low");
    expect(noTools.temperature).toBeUndefined();
  });
});

describe("validateLiveSessionRequest", () => {
  it("accepts a valid offer with tools", () => {
    const result = validateLiveSessionRequest({ sdp: SDP, mode: "morning", heroName: "Hero", context: "ctx", tools: [TOOL] });
    expect(result.ok).toBe(true);
  });

  it("rejects missing SDP, bad modes, bad tools and oversized context", () => {
    expect(validateLiveSessionRequest({ mode: "general" }).ok).toBe(false);
    expect(validateLiveSessionRequest({ sdp: SDP, mode: "nightly" }).ok).toBe(false);
    expect(validateLiveSessionRequest({ sdp: SDP, tools: [{ ...TOOL, name: "Bad Name" }] }).ok).toBe(false);
    expect(validateLiveSessionRequest({ sdp: SDP, tools: [TOOL, TOOL] }).ok).toBe(false);
    expect(validateLiveSessionRequest({ sdp: SDP, tools: [{ ...TOOL, type: "code_interpreter" }] }).ok).toBe(false);
    expect(validateLiveSessionRequest({ sdp: SDP, context: "x".repeat(12_001) }).ok).toBe(false);
  });
});

describe("buildLiveSessionBody", () => {
  it("delegates reasoning and tools to the backend model over WebRTC", () => {
    const validation = validateLiveSessionRequest({ sdp: SDP, mode: "evening", heroName: "Hero", context: "Today: 2/3 workouts", tools: [TOOL] });
    if (!validation.ok) throw new Error(validation.message);
    const body = buildLiveSessionBody(validation.value) as {
      session: { model: string; instructions: string; delegation: { type: string; responses: { model: string; tools: { type: string; name?: string }[]; instructions: string } } };
      transport: { type: string; sdp: string };
    };
    expect(body.session.model).toBe(LIVE_VOICE_MODEL);
    expect(body.session.delegation.type).toBe("responses");
    expect(body.session.delegation.responses.model).toBe(LIVE_BACKEND_MODEL);
    expect(body.session.delegation.responses.tools.map((t) => t.name ?? t.type)).toEqual(["log_cardio", "web_search"]);
    expect(body.session.delegation.responses.instructions).toContain("Today: 2/3 workouts");
    expect(body.session.instructions).toContain("Hero");
    expect(body.transport).toEqual({ type: "webrtc", sdp: SDP });
  });

  it("parses the SDP answer from the OpenAI response", () => {
    const parsed = parseLiveSessionResponse({ session: { id: "live_123", model: "gpt-live-1" }, transport: { type: "webrtc", sdp: "v=0 answer" } });
    expect(parsed).toMatchObject({ sessionId: "live_123", sdp: "v=0 answer", model: "gpt-live-1" });
    expect(() => parseLiveSessionResponse({ session: { id: "x" } })).toThrow();
  });
});

describe("/api/live/session", () => {
  afterEach(() => {
    setLiveSessionForTests(undefined);
    vi.restoreAllMocks();
  });

  it("rejects invalid bodies before creating a session", async () => {
    const create = vi.fn();
    setLiveSessionForTests(create);
    const response = await POST(request({ mode: "general" }));
    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns only the SDP answer and session metadata", async () => {
    setLiveSessionForTests(
      vi.fn().mockResolvedValue({ sessionId: "live_1", sdp: "v=0 answer", model: "gpt-live-1", backendModel: "gpt-6-sol", credentialSource: "mock" })
    );
    const response = await POST(request({ sdp: SDP, mode: "general", tools: [TOOL] }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toEqual({ sessionId: "live_1", sdp: "v=0 answer", model: "gpt-live-1", backendModel: "gpt-6-sol", credentialSource: "mock" });
    expect(JSON.stringify(payload)).not.toContain("OPENAI_API_KEY");
  });
});
