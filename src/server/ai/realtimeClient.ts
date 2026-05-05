import type { CreateRealtimeSessionResponse, VoiceSessionMode } from "@/domain";

export type RealtimeClientSecretInput = {
  mode: VoiceSessionMode;
};

export type CreateRealtimeClientSecret = (
  input: RealtimeClientSecretInput
) => Promise<CreateRealtimeSessionResponse>;

let testRealtimeClientSecret: CreateRealtimeClientSecret | undefined;

export function setRealtimeClientSecretForTests(
  creator: CreateRealtimeClientSecret | undefined
) {
  testRealtimeClientSecret = creator;
}

export async function createRealtimeClientSecret(
  input: RealtimeClientSecretInput
): Promise<CreateRealtimeSessionResponse> {
  if (testRealtimeClientSecret) {
    return testRealtimeClientSecret(input);
  }

  if (process.env.NODE_ENV === "test" || process.env.LIFEQUEST_MOCK_REALTIME_SESSION === "1") {
    return createMockRealtimeClientSecret(input.mode);
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      return createMockRealtimeClientSecret(input.mode);
    }

    throw new Error("OpenAI API key is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      expires_after: {
        anchor: "created_at",
        seconds: 600
      },
      session: {
        type: "realtime",
        model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime",
        instructions:
          "You are the LifeQuest OS voice coach. Keep responses concise and hand off transcript summaries to the text confirmation flow."
      }
    })
  });

  if (!response.ok) {
    throw new Error("Realtime client secret request failed.");
  }

  return parseRealtimeClientSecretResponse(await response.json(), input.mode);
}

function createMockRealtimeClientSecret(mode: VoiceSessionMode): CreateRealtimeSessionResponse {
  return {
    clientSecret: `ek_lifequest_mock_${mode}_${Date.now()}`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    mode,
    credentialSource: "mock"
  };
}

export function parseRealtimeClientSecretResponse(
  payload: unknown,
  mode: VoiceSessionMode
): CreateRealtimeSessionResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Realtime client secret response was empty.");
  }

  const responseBody = payload as {
    client_secret?: { value?: unknown; expires_at?: unknown };
    expires_at?: unknown;
    session?: { client_secret?: { value?: unknown; expires_at?: unknown } };
    value?: unknown;
  };
  const nestedClientSecret =
    responseBody.client_secret ?? responseBody.session?.client_secret;
  const value = responseBody.value ?? nestedClientSecret?.value;
  const expiresAt = responseBody.expires_at ?? nestedClientSecret?.expires_at;

  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Realtime client secret response was missing a token.");
  }

  return {
    clientSecret: value,
    expiresAt:
      typeof expiresAt === "number" ? new Date(expiresAt * 1000).toISOString() : undefined,
    mode,
    credentialSource: "openai"
  };
}
