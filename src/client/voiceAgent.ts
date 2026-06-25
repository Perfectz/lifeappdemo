import { RealtimeAgent, RealtimeSession, tool } from "@openai/agents-realtime";

import { REALTIME_VOICE_MODEL } from "@/config/ai";
import { executeVoiceTool, VOICE_TOOL_DEFINITIONS } from "@/client/voiceTools";

/**
 * Real-time voice agent built on the OpenAI Agents SDK (`@openai/agents-realtime`).
 *
 * Flow: mint an ephemeral key from /api/realtime/session → create a
 * `RealtimeAgent` (instructions + tools) and a `RealtimeSession` → `connect`
 * with the ephemeral key. In the browser the session uses the WebRTC transport
 * automatically (mic up, model audio down) — we no longer hand-roll the peer
 * connection, data channel, or SDP exchange. When the model calls a tool the
 * SDK invokes our `execute`, which runs the action locally (mutating the app
 * via the repositories) and returns the result for the model to confirm.
 *
 * NOTE: the audio loop must be exercised on a real device with a mic and a
 * valid key — it can't be tested headlessly. Adjust REALTIME_VOICE_MODEL in
 * src/config/ai.ts if your account exposes a different realtime id.
 */

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

export function isVoiceAgentSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof RTCPeerConnection !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/**
 * Wrap our existing JSON-Schema voice tools as OpenAI Agents SDK tools. The
 * schema is reused verbatim (non-strict); the SDK runs `execute` when the model
 * calls a tool, and our local executor applies the change + surfaces UI/nav
 * callbacks. We return the tool result so the model can speak a confirmation.
 */
function buildRealtimeTools(callbacks: VoiceAgentCallbacks) {
  return VOICE_TOOL_DEFINITIONS.map((def) => {
    const schema = def.parameters as {
      properties: Record<string, unknown>;
      required?: readonly string[];
    };
    const params = {
      type: "object" as const,
      properties: schema.properties,
      required: schema.required ?? [],
      additionalProperties: true as const
    };
    return tool({
      name: def.name,
      description: def.description,
      parameters: params,
      strict: false,
      execute: async (args: unknown) => {
        const result = executeVoiceTool(
          def.name,
          args && typeof args === "object" ? (args as Record<string, unknown>) : {}
        );
        if (!result.silent) callbacks.onAction?.(result.message, result.ok);
        if (result.navigateTo) callbacks.onNavigate?.(result.navigateTo);
        return JSON.stringify(result);
      }
    } as unknown as Parameters<typeof tool>[0]);
  });
}

/** Pull the most recent assistant transcript out of the realtime history. */
function latestAssistantTranscript(history: unknown): string | undefined {
  if (!Array.isArray(history)) return undefined;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const item = history[i] as {
      type?: string;
      role?: string;
      content?: Array<{ transcript?: unknown; text?: unknown }>;
    };
    if (item?.type === "message" && item.role === "assistant" && Array.isArray(item.content)) {
      const text = item.content
        .map((part) =>
          typeof part?.transcript === "string"
            ? part.transcript
            : typeof part?.text === "string"
              ? part.text
              : ""
        )
        .join(" ")
        .trim();
      if (text) return text;
    }
  }
  return undefined;
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

  const agent = new RealtimeAgent({
    name: "LifeQuest Voice",
    instructions: AGENT_INSTRUCTIONS,
    voice: "marin",
    tools: buildRealtimeTools(callbacks)
  });

  // In a browser the session defaults to the WebRTC transport, which manages
  // the mic + model audio playback for us.
  const session = new RealtimeSession(agent, { model: REALTIME_VOICE_MODEL });

  session.on("error", (event) => {
    const message =
      event && typeof event === "object" && "error" in event
        ? extractErrorMessage((event as { error: unknown }).error)
        : "Voice session error.";
    callbacks.onError?.(message);
  });

  session.on("history_updated", (history) => {
    const text = latestAssistantTranscript(history);
    if (text) callbacks.onAssistant?.(text);
  });

  try {
    await session.connect({ apiKey: token.clientSecret });
  } catch (error) {
    session.close();
    throw new Error(
      error instanceof Error ? error.message : "The realtime voice service refused the connection."
    );
  }

  callbacks.onStatus?.("listening");

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try {
      session.close();
    } catch {
      /* ignore */
    }
    callbacks.onStatus?.("ended");
  };

  return { stop };
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Voice session error.";
}
