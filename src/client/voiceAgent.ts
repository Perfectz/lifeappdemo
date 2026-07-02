import { executeVoiceTool, VOICE_TOOL_DEFINITIONS } from "@/client/voiceTools";

/**
 * Real-time voice agent over WebRTC against the OpenAI Realtime model.
 *
 * Flow: mint an ephemeral key from /api/realtime/session → open a WebRTC peer
 * connection (mic up, model audio down) + a data channel → configure the
 * session with our tool schema → when the model calls a tool, run it locally
 * (mutating the app via the repositories) and feed the result back so the
 * model can speak a confirmation.
 *
 * NOTE: the audio loop must be exercised on a real device with a mic and a
 * valid key — it can't be tested headlessly. The SDP endpoint + session config
 * follow the documented WebRTC pattern; adjust REALTIME_VOICE_MODEL in
 * src/config/ai.ts if your account exposes a different realtime id.
 */

// GA ("v2") Realtime WebRTC endpoint. The model is bound when the ephemeral
// key is minted server-side (src/server/ai/realtimeClient.ts), so it is NOT a
// query param here.
const REALTIME_URL = "https://api.openai.com/v1/realtime/calls";

const AGENT_INSTRUCTIONS = [
  "You are the user's LifeQuest assistant — their personal trainer, life coach, and personal assistant in one, speaking hands-free.",
  "At the START of every conversation, call read_about_me (their personal profile) and read_memory (durable facts you've saved — resume, favorite workouts, preferences, etc.), then get_context for today's status. These are your long-term memory of the user — always ground advice in them, and prioritize their stated top health priorities.",
  "When the user tells you something durable about themselves or asks you to remember it, call remember with a short key and the content (re-using a key updates it); use forget to remove a memory. This memory persists across sessions and devices.",
  "Use list_quests, list_recent_workouts, and read_notes when relevant before giving advice.",
  "Perform actions with tools: create/complete quests, log strength/cardio/martial-arts workouts, log food/meals (and update_food / remove_food to fix or delete a logged meal), log health check-ins, set nutrition/health goals, add journal entries, and navigate screens.",
  "Sodium is always in milligrams (mg), never grams — a label's '0.6 g' sodium is 600 mg.",
  "When the user shares a thought, plan, reflection, or anything worth keeping — or asks you to remember something — call save_note so they can read it later on the Notes screen.",
  "Coach proactively: encourage, suggest the next workout or quest based on what they've done, but keep spoken replies short and natural.",
  "Confirm actions briefly (e.g. 'Logged a 30 minute run'). If a required detail is missing, ask one short question instead of guessing.",
  "Never invent health numbers. Log health values without medical diagnosis or advice."
].join(" ");

export type VoiceAgentStatus = "idle" | "connecting" | "listening" | "ended" | "error";

export type VoiceAgentCallbacks = {
  onStatus?: (status: VoiceAgentStatus) => void;
  onAssistant?: (text: string) => void;
  onAction?: (message: string, ok: boolean) => void;
  onNavigate?: (path: string) => void;
  onError?: (message: string) => void;
};

export type VoiceAgentSession = { stop: () => void };

type RealtimeEvent = {
  type?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  transcript?: string;
  error?: { message?: string };
};

export function isVoiceAgentSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof RTCPeerConnection !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export async function startVoiceAgent(callbacks: VoiceAgentCallbacks): Promise<VoiceAgentSession> {
  callbacks.onStatus?.("connecting");

  const tokenResponse = await fetch("/api/realtime/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "general" })
  });
  const token = (await tokenResponse.json()) as { clientSecret?: string; error?: string };
  if (!tokenResponse.ok || !token.clientSecret) {
    throw new Error(token.error ?? "Could not start the voice session.");
  }

  const pc = new RTCPeerConnection();
  const audioEl = document.createElement("audio");
  audioEl.autoplay = true;
  pc.ontrack = (event) => {
    audioEl.srcObject = event.streams[0] ?? null;
  };

  const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
  mic.getTracks().forEach((track) => pc.addTrack(track, mic));

  // Shared teardown for the mic + peer connection — used by stop() and by the
  // failure path below so an aborted connect never leaves the mic live.
  const releaseMedia = () => {
    mic.getTracks().forEach((track) => track.stop());
    try {
      pc.close();
    } catch {
      /* ignore */
    }
  };

  const channel = pc.createDataChannel("oai-events");

  const send = (payload: unknown) => {
    if (channel.readyState === "open") channel.send(JSON.stringify(payload));
  };

  channel.addEventListener("open", () => {
    // GA session shape: type "realtime", audio config nested under `audio`.
    send({
      type: "session.update",
      session: {
        type: "realtime",
        instructions: AGENT_INSTRUCTIONS,
        tools: VOICE_TOOL_DEFINITIONS,
        tool_choice: "auto",
        audio: { output: { voice: "marin" } }
      }
    });
    callbacks.onStatus?.("listening");
  });

  channel.addEventListener("message", (event) => {
    let parsed: RealtimeEvent;
    try {
      parsed = JSON.parse(event.data as string) as RealtimeEvent;
    } catch {
      return;
    }

    if (parsed.type === "response.function_call_arguments.done") {
      let args: Record<string, unknown> = {};
      try {
        args = parsed.arguments ? (JSON.parse(parsed.arguments) as Record<string, unknown>) : {};
      } catch {
        args = {};
      }
      const result = executeVoiceTool(parsed.name ?? "", args);
      if (!result.silent) callbacks.onAction?.(result.message, result.ok);
      if (result.navigateTo) callbacks.onNavigate?.(result.navigateTo);
      send({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: parsed.call_id,
          output: JSON.stringify(result)
        }
      });
      send({ type: "response.create" });
      return;
    }

    if (parsed.type === "response.audio_transcript.done" && parsed.transcript) {
      callbacks.onAssistant?.(parsed.transcript);
      return;
    }

    if (parsed.type === "error") {
      callbacks.onError?.(parsed.error?.message ?? "Voice session error.");
    }
  });

  // Everything past getUserMedia can throw (SDP exchange, network) — release
  // the mic + peer connection on any failure so the mic indicator doesn't
  // stay lit after an aborted connect.
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpResponse = await fetch(REALTIME_URL, {
      method: "POST",
      body: offer.sdp ?? "",
      headers: {
        Authorization: `Bearer ${token.clientSecret}`,
        "Content-Type": "application/sdp"
      }
    });
    if (!sdpResponse.ok) {
      throw new Error("The realtime voice service refused the connection.");
    }
    const answerSdp = await sdpResponse.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  } catch (error) {
    releaseMedia();
    throw error;
  }

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try {
      channel.close();
    } catch {
      /* ignore */
    }
    releaseMedia();
    audioEl.srcObject = null;
    callbacks.onStatus?.("ended");
  };

  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
      callbacks.onError?.("Voice connection lost.");
      stop();
    }
  });

  return { stop };
}
