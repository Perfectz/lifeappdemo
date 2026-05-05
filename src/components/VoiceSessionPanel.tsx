"use client";

import { useReducer, useState } from "react";

import { SectionHeader } from "@/components/SectionHeader";
import type { CreateRealtimeSessionResponse, VoiceSessionMode } from "@/domain";
import { createVoiceSession, voiceSessionReducer } from "@/domain/voiceSessions";

type VoiceSessionPanelProps = {
  mode: VoiceSessionMode;
  onFallbackToText(): void;
  onTranscriptHandoff(transcript: string): void;
};

type PermissionState = "unknown" | "unsupported" | "requesting" | "granted" | "denied";

function nowIso(): string {
  return new Date().toISOString();
}

function initialTranscript(mode: VoiceSessionMode): string {
  return `Voice transcript placeholder for ${mode} session. Replace this with captured notes before handing off to text AI.`;
}

export function VoiceSessionPanel({
  mode,
  onFallbackToText,
  onTranscriptHandoff
}: VoiceSessionPanelProps) {
  const [session, dispatch] = useReducer(
    voiceSessionReducer,
    createVoiceSession(mode, nowIso())
  );
  const [permissionState, setPermissionState] = useState<PermissionState>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [credentialSource, setCredentialSource] =
    useState<CreateRealtimeSessionResponse["credentialSource"]>();
  const transcript = session.transcript ?? "";
  const canStart = session.status === "idle" || session.status === "ended" || session.status === "failed";
  const canStop = session.status === "connecting" || session.status === "active";
  const canHandoff = session.status === "ended" && transcript.trim().length > 0;

  async function requestMicrophone(): Promise<MediaStream | null> {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionState("unsupported");
      throw new Error("This browser does not support microphone capture. Use text mode instead.");
    }

    setPermissionState("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionState("granted");
      return stream;
    } catch {
      setPermissionState("denied");
      throw new Error("Microphone permission was denied. Use text mode instead.");
    }
  }

  async function startVoiceSession() {
    setError(null);
    setCredentialSource(undefined);
    dispatch({ type: "start_requested", now: nowIso() });

    let stream: MediaStream | null = null;

    try {
      stream = await requestMicrophone();
      const response = await fetch("/api/realtime/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ mode })
      });
      const payload = (await response.json()) as CreateRealtimeSessionResponse & {
        error?: string;
      };

      if (!response.ok || !payload.clientSecret) {
        throw new Error(payload.error ?? "Voice session could not start.");
      }

      setCredentialSource(payload.credentialSource);
      dispatch({ type: "start_succeeded", now: nowIso() });
      dispatch({ type: "transcript_updated", transcript: initialTranscript(mode), now: nowIso() });
    } catch (startError) {
      const message =
        startError instanceof Error ? startError.message : "Voice session could not start.";
      setError(message);
      dispatch({ type: "start_failed", message, now: nowIso() });
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }

  function stopVoiceSession() {
    const nextTranscript = transcript.trim() ? transcript : initialTranscript(mode);
    dispatch({ type: "transcript_updated", transcript: nextTranscript, now: nowIso() });
    dispatch({ type: "stop_requested", now: nowIso() });
  }

  function handoffTranscript() {
    const trimmedTranscript = transcript.trim();

    if (!trimmedTranscript) {
      return;
    }

    onTranscriptHandoff(trimmedTranscript);
  }

  return (
    <section className="dashboard-section voice-session-panel" aria-label={`${mode} voice session`}>
      <SectionHeader eyebrow="Voice Alpha" title="Voice Session" />
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <dl className="voice-session-status">
        <div>
          <dt>Session</dt>
          <dd>{session.status}</dd>
        </div>
        <div>
          <dt>Mic permission</dt>
          <dd>{permissionState}</dd>
        </div>
        <div>
          <dt>Credential</dt>
          <dd>{credentialSource ?? "not requested"}</dd>
        </div>
      </dl>
      <div className="standup-actions">
        <button disabled={!canStart} onClick={startVoiceSession} type="button">
          Start Voice Session
        </button>
        <button disabled={!canStop} onClick={stopVoiceSession} type="button">
          Stop Voice Session
        </button>
        <button onClick={onFallbackToText} type="button">
          Fallback to text mode
        </button>
      </div>
      <label className="voice-transcript-field">
        <span>Transcript</span>
        <textarea
          onChange={(event) =>
            dispatch({
              type: "transcript_updated",
              transcript: event.target.value,
              now: nowIso()
            })
          }
          placeholder="Voice transcript will appear here when available."
          value={transcript}
        />
      </label>
      <div className="standup-actions">
        <button disabled={!canHandoff} onClick={handoffTranscript} type="button">
          Hand off to text AI
        </button>
      </div>
    </section>
  );
}
