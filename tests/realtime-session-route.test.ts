import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/realtime/session/route";
import {
  parseRealtimeClientSecretResponse,
  setRealtimeClientSecretForTests
} from "@/server/ai/realtimeClient";

function request(body: unknown): Request {
  return new Request("http://localhost/api/realtime/session", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json"
    }
  });
}

describe("/api/realtime/session", () => {
  afterEach(() => {
    setRealtimeClientSecretForTests(undefined);
    vi.restoreAllMocks();
  });

  it("rejects invalid modes before creating a session", async () => {
    const createClientSecret = vi.fn();
    setRealtimeClientSecretForTests(createClientSecret);

    const response = await POST(request({ mode: "nightly" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: "Mode must be morning, evening, or general." });
    expect(createClientSecret).not.toHaveBeenCalled();
  });

  it("returns only an ephemeral realtime credential", async () => {
    setRealtimeClientSecretForTests(
      vi.fn().mockResolvedValue({
        clientSecret: "ek_test_ephemeral_morning",
        expiresAt: "2026-05-05T09:10:00.000Z",
        mode: "morning",
        credentialSource: "mock"
      })
    );

    const response = await POST(request({ mode: "morning" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      clientSecret: "ek_test_ephemeral_morning",
      expiresAt: "2026-05-05T09:10:00.000Z",
      mode: "morning",
      credentialSource: "mock"
    });
    expect(JSON.stringify(payload)).not.toContain("OPENAI_API_KEY");
  });

  it("uses the mock credential path during tests", async () => {
    const response = await POST(request({ mode: "general" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("general");
    expect(payload.credentialSource).toBe("mock");
    expect(payload.clientSecret).toMatch(/^ek_lifequest_mock_general_/);
  });

  it("parses the documented OpenAI realtime client secret response shape", () => {
    expect(
      parseRealtimeClientSecretResponse(
        {
          value: "ek_openai_ephemeral",
          expires_at: 1_779_999_000,
          session: {
            type: "realtime",
            model: "gpt-realtime"
          }
        },
        "evening"
      )
    ).toEqual({
      clientSecret: "ek_openai_ephemeral",
      expiresAt: "2026-05-28T20:10:00.000Z",
      mode: "evening",
      credentialSource: "openai"
    });
  });
});
