"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import { SectionHeader } from "@/components/SectionHeader";
import type { CreateRealtimeSessionResponse, VoiceSessionMode } from "@/domain";
import { createVoiceSession, voiceSessionReducer } from "@/domain/voiceSessions";

type VoiceSessionPanelProps = {
  mode: VoiceSessionMode;
  onFallbackToText(): void;
  onTranscriptHandoff(transcript: string): void;
};

type PermissionState = "unknown" | "unsupported" | "requesting" | "granted" | "denied";
type LiveCaptureState = "ready" | "listening" | "stopped" | "unsupported";

/** Minimal shape of the Web Speech API we rely on (not in TS DOM libs). */
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
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
  const [liveCapture, setLiveCapture] = useState<LiveCaptureState>(() =>
    getSpeechRecognitionCtor() ? "ready" : "unsupported"
  );
  const [error, setError] = useState<string | null>(null);
  const [credentialSource, setCredentialSource] =
    useState<CreateRealtimeSessionResponse["credentialSource"]>();

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Final (committed) transcript text captured so far this session. Interim
  // results are appended on top of this for a live preview.
  const finalTextRef = useRef<string>("");

  const transcript = session.transcript ?? "";
  const canStart =
    session.status === "idle" || session.status === "ended" || session.status === "failed";
  const canStop = session.status === "connecting" || session.status === "active";
  const canHandoff = session.status === "ended" && transcript.trim().length > 0;

  function stopRecognition() {
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // Already stopped — ignore.
      }
      recognitionRef.current = null;
    }
  }

  // Stop any live capture if the component unmounts mid-session.
  useEffect(() => () => stopRecognition(), []);

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

  function startLiveTranscription() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setLiveCapture("unsupported");
      return;
    }
    try {
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) {
            finalTextRef.current = `${finalTextRef.current} ${text}`.trim();
          } else {
            interim += text;
          }
        }
        const combined = `${finalTextRef.current} ${interim}`.trim();
        dispatch({ type: "transcript_updated", transcript: combined, now: nowIso() });
      };
      recognition.onerror = () => {
        // Audio unavailable (e.g. headless/test) — fall back to manual entry.
        setLiveCapture("unsupported");
        recognitionRef.current = null;
      };
      recognition.onend = () => {
        setLiveCapture((prev) => (prev === "listening" ? "stopped" : prev));
      };
      recognition.start();
      recognitionRef.current = recognition;
      setLiveCapture("listening");
    } catch {
      setLiveCapture("unsupported");
      recognitionRef.current = null;
    }
  }

  async function startVoiceSession() {
    setError(null);
    setCredentialSource(undefined);
    finalTextRef.current = transcript.trim();
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
      // Begin live on-device transcription where the browser supports it.
      startLiveTranscription();
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
    stopRecognition();
    setLiveCapture((prev) => (prev === "listening" ? "stopped" : prev));
    dispatch({ type: "stop_requested", now: nowIso() });
  }

  function handoffTranscript() {
    const trimmedTranscript = transcript.trim();

    if (!trimmedTranscript) {
      return;
    }

    onTranscriptHandoff(trimmedTranscript);
  }

  const liveSupported = liveCapture !== "unsupported";

  return (
    <section className="dashboard-section voice-session-panel" aria-label={`${mode} voice session`}>
      <SectionHeader eyebrow="Voice Alpha" title="Voice Session" />
      <p className="voice-session-note">
        {liveSupported
          ? "Live transcription uses your browser's on-device speech engine. Speak after starting — words appear below. You can edit before handing off to the text AI."
          : "Live transcription isn't available in this browser. Type or paste what you discussed, then hand it off to the text AI."}
      </p>
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
          <dt>Live capture</dt>
          <dd>{liveCapture}</dd>
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
          placeholder={
            liveSupported
              ? "Spoken words appear here. Edit freely before handing off."
              : "Type or paste what you said, then hand off to the text AI."
          }
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
