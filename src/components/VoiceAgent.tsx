"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  isVoiceAgentSupported,
  startVoiceAgent,
  type VoiceAgentSession,
  type VoiceAgentStatus
} from "@/client/voiceAgent";

/**
 * Always-available voice assistant: a floating mic button that opens a live
 * realtime conversation. The agent can run app actions (create/log/navigate)
 * by calling tools — see src/client/voiceTools.ts.
 */
export function VoiceAgent() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<VoiceAgentStatus>("idle");
  const [assistant, setAssistant] = useState("");
  const [action, setAction] = useState<{ text: string; ok: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<VoiceAgentSession | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => sessionRef.current?.stop();
  }, []);

  const active = status === "connecting" || status === "listening";

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setAssistant("");
    setAction(null);
    try {
      sessionRef.current = await startVoiceAgent({
        onStatus: setStatus,
        onAssistant: setAssistant,
        onAction: (text, ok) => setAction({ text, ok }),
        onNavigate: (path) => router.push(path),
        onError: (message) => setError(message)
      });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Couldn't start the voice assistant.");
      setStatus("error");
    }
  }, [router]);

  if (!mounted || !isVoiceAgentSupported()) return null;

  const showOverlay = active || Boolean(error) || Boolean(assistant) || Boolean(action);

  return (
    <>
      <button
        type="button"
        className={active ? "voice-fab voice-fab-active" : "voice-fab"}
        onClick={active ? stop : start}
        aria-label={active ? "Stop voice assistant" : "Start voice assistant"}
        aria-pressed={active}
      >
        <span aria-hidden="true">🎙️</span>
      </button>

      {showOverlay ? (
        <div className="voice-overlay" role="status" aria-live="polite">
          <div className="voice-overlay-head">
            <strong>Voice assistant</strong>
            <span className="voice-overlay-status">{status}</span>
          </div>
          {error ? <p className="voice-overlay-error">{error}</p> : null}
          {action ? (
            <p className={action.ok ? "voice-overlay-action" : "voice-overlay-action voice-overlay-action-err"}>
              {action.text}
            </p>
          ) : null}
          {assistant ? <p className="voice-overlay-assistant">“{assistant}”</p> : null}
          {active ? (
            <button type="button" className="command-button" onClick={stop}>
              <span>Stop</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
