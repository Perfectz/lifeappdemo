import type { IsoDateTime, VoiceSession, VoiceSessionMode } from "./types";

export type CreateRealtimeSessionRequest = {
  mode: VoiceSessionMode;
};

export type CreateRealtimeSessionResponse = {
  clientSecret: string;
  expiresAt?: IsoDateTime;
  mode: VoiceSessionMode;
  credentialSource?: "openai" | "mock";
};

export type RealtimeSessionRequestValidationResult =
  | { ok: true; value: CreateRealtimeSessionRequest }
  | { ok: false; message: string };

export type VoiceSessionAction =
  | { type: "start_requested"; now: IsoDateTime }
  | { type: "start_succeeded"; now: IsoDateTime }
  | { type: "start_failed"; message: string; now: IsoDateTime }
  | { type: "transcript_updated"; transcript: string; now: IsoDateTime }
  | { type: "stop_requested"; now: IsoDateTime };

export const voiceSessionModes: VoiceSessionMode[] = ["morning", "evening", "general"];

export function isVoiceSessionMode(value: unknown): value is VoiceSessionMode {
  return typeof value === "string" && voiceSessionModes.includes(value as VoiceSessionMode);
}

export function validateRealtimeSessionRequestBody(
  body: unknown
): RealtimeSessionRequestValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Request body is required." };
  }

  const mode = (body as { mode?: unknown }).mode;

  if (!isVoiceSessionMode(mode)) {
    return { ok: false, message: "Mode must be morning, evening, or general." };
  }

  return { ok: true, value: { mode } };
}

export function createVoiceSession(mode: VoiceSessionMode, now: IsoDateTime): VoiceSession {
  return {
    id: `voice-${mode}-${now}`,
    mode,
    status: "idle"
  };
}

export function voiceSessionReducer(
  session: VoiceSession,
  action: VoiceSessionAction
): VoiceSession {
  switch (action.type) {
    case "start_requested":
      return {
        ...session,
        status: "connecting",
        startedAt: action.now
      };
    case "start_succeeded":
      return {
        ...session,
        status: "active",
        startedAt: session.startedAt ?? action.now
      };
    case "start_failed":
      return {
        ...session,
        status: "failed",
        transcript: action.message,
        endedAt: action.now
      };
    case "transcript_updated":
      return {
        ...session,
        transcript: action.transcript
      };
    case "stop_requested":
      return {
        ...session,
        status: "ended",
        endedAt: action.now
      };
    default:
      return session;
  }
}
