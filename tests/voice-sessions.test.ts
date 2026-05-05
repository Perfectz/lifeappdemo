import { describe, expect, it } from "vitest";

import {
  createVoiceSession,
  validateRealtimeSessionRequestBody,
  voiceSessionReducer
} from "@/domain/voiceSessions";

describe("voice session domain", () => {
  it("accepts supported realtime session modes", () => {
    expect(validateRealtimeSessionRequestBody({ mode: "morning" })).toEqual({
      ok: true,
      value: { mode: "morning" }
    });
    expect(validateRealtimeSessionRequestBody({ mode: "evening" })).toEqual({
      ok: true,
      value: { mode: "evening" }
    });
    expect(validateRealtimeSessionRequestBody({ mode: "general" })).toEqual({
      ok: true,
      value: { mode: "general" }
    });
  });

  it("rejects unsupported realtime session modes", () => {
    expect(validateRealtimeSessionRequestBody({ mode: "admin" })).toEqual({
      ok: false,
      message: "Mode must be morning, evening, or general."
    });
    expect(validateRealtimeSessionRequestBody(null)).toEqual({
      ok: false,
      message: "Request body is required."
    });
  });

  it("tracks start, transcript, and stop transitions", () => {
    const idle = createVoiceSession("morning", "2026-05-05T09:00:00.000Z");
    const connecting = voiceSessionReducer(idle, {
      type: "start_requested",
      now: "2026-05-05T09:01:00.000Z"
    });
    const active = voiceSessionReducer(connecting, {
      type: "start_succeeded",
      now: "2026-05-05T09:01:01.000Z"
    });
    const withTranscript = voiceSessionReducer(active, {
      type: "transcript_updated",
      transcript: "Plan the main quest.",
      now: "2026-05-05T09:02:00.000Z"
    });
    const ended = voiceSessionReducer(withTranscript, {
      type: "stop_requested",
      now: "2026-05-05T09:03:00.000Z"
    });

    expect(connecting.status).toBe("connecting");
    expect(active.status).toBe("active");
    expect(withTranscript.transcript).toBe("Plan the main quest.");
    expect(ended).toMatchObject({
      status: "ended",
      endedAt: "2026-05-05T09:03:00.000Z"
    });
  });

  it("records failed starts without becoming active", () => {
    const failed = voiceSessionReducer(
      createVoiceSession("evening", "2026-05-05T21:00:00.000Z"),
      {
        type: "start_failed",
        message: "Microphone permission was denied. Use text mode instead.",
        now: "2026-05-05T21:01:00.000Z"
      }
    );

    expect(failed).toMatchObject({
      status: "failed",
      transcript: "Microphone permission was denied. Use text mode instead.",
      endedAt: "2026-05-05T21:01:00.000Z"
    });
  });
});
