import { COACH_MODEL, LIVE_BACKEND_MODEL, LIVE_VOICE_MODEL } from "@/config/ai";
import {
  activeCoachModel,
  isModelAccessError,
  markPrimaryCoachModelUnavailable,
  readOpenAIErrorText
} from "@/server/ai/modelFallback";
import { AINotConfiguredError, buildOpenAIError } from "@/server/ai/openaiClient";

/**
 * GPT-Live voice sessions (POST /v1/live/sessions, WebRTC transport).
 *
 * The client (Android app / browser) creates a WebRTC offer and sends it here
 * together with its app context and the function tools it can execute locally.
 * We create the GPT-Live session with the project API key (never exposed) and
 * return the SDP answer. GPT-Live does the talking; reasoning and tool calls
 * are delegated to LIVE_BACKEND_MODEL through Responses delegation. Function
 * calls surface to the client on the "oai-events" data channel as
 * `response.event` → `response.output_item.done` (function_call items); the
 * client runs the tool against its local data and replies with
 * `response.item.create` (function_call_output) + `response.create`.
 */

export type LiveVoiceMode = "general" | "morning" | "evening";

export type LiveFunctionTool = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type LiveSessionRequest = {
  sdp: string;
  mode: LiveVoiceMode;
  heroName?: string;
  context?: string;
  tools: LiveFunctionTool[];
};

export type LiveSessionResponse = {
  sessionId: string;
  sdp: string;
  model: string;
  backendModel: string;
  credentialSource: "openai" | "mock";
};

export type LiveSessionValidationResult =
  | { ok: true; value: LiveSessionRequest }
  | { ok: false; message: string };

const MAX_SDP = 30_000;
const MAX_CONTEXT = 12_000;
const MAX_TOOLS = 32;
const MAX_TOOL_DESCRIPTION = 800;
const MAX_TOOL_SCHEMA_CHARS = 6_000;
const TOOL_NAME = /^[a-z][a-z0-9_]{0,47}$/;
const MODES: LiveVoiceMode[] = ["general", "morning", "evening"];

/** Validate the client's request body (defensive: it comes from an authenticated user's device). */
export function validateLiveSessionRequest(body: unknown): LiveSessionValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Request body is required." };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.sdp !== "string" || !b.sdp.trimStart().startsWith("v=0") || b.sdp.length > MAX_SDP) {
    return { ok: false, message: "A WebRTC SDP offer is required." };
  }
  const mode = b.mode ?? "general";
  if (typeof mode !== "string" || !MODES.includes(mode as LiveVoiceMode)) {
    return { ok: false, message: "Mode must be morning, evening, or general." };
  }
  if (b.context !== undefined && (typeof b.context !== "string" || b.context.length > MAX_CONTEXT)) {
    return { ok: false, message: `Context must be text under ${MAX_CONTEXT} characters.` };
  }
  if (b.heroName !== undefined && (typeof b.heroName !== "string" || b.heroName.length > 48)) {
    return { ok: false, message: "Hero name must be under 48 characters." };
  }

  const rawTools = b.tools ?? [];
  if (!Array.isArray(rawTools) || rawTools.length > MAX_TOOLS) {
    return { ok: false, message: `Tools must be a list of at most ${MAX_TOOLS} functions.` };
  }
  const tools: LiveFunctionTool[] = [];
  const seen = new Set<string>();
  for (const raw of rawTools) {
    const t = raw as Record<string, unknown> | null;
    if (!t || t.type !== "function" || typeof t.name !== "string" || !TOOL_NAME.test(t.name) || seen.has(t.name)) {
      return { ok: false, message: "Each tool needs type \"function\" and a unique snake_case name." };
    }
    if (typeof t.description !== "string" || t.description.length > MAX_TOOL_DESCRIPTION) {
      return { ok: false, message: `Tool ${t.name} needs a description under ${MAX_TOOL_DESCRIPTION} characters.` };
    }
    if (!t.parameters || typeof t.parameters !== "object" || Array.isArray(t.parameters) ||
        JSON.stringify(t.parameters).length > MAX_TOOL_SCHEMA_CHARS) {
      return { ok: false, message: `Tool ${t.name} needs a JSON-schema parameters object.` };
    }
    seen.add(t.name);
    tools.push({
      type: "function",
      name: t.name,
      description: t.description,
      parameters: t.parameters as Record<string, unknown>
    });
  }

  return {
    ok: true,
    value: {
      sdp: b.sdp,
      mode: mode as LiveVoiceMode,
      heroName: typeof b.heroName === "string" ? b.heroName.trim() || undefined : undefined,
      context: typeof b.context === "string" ? b.context : undefined,
      tools
    }
  };
}

const MODE_FOCUS: Record<LiveVoiceMode, string> = {
  general: "Help with whatever the user needs today.",
  morning: "Run a quick morning stand-up: energy, vitals, the main quest and an intention for the day.",
  evening: "Run a short evening review: wins, one lesson, and tomorrow's focus."
};

/** Instructions for the GPT-Live voice layer (it speaks; the backend thinks and acts). */
export function liveVoiceInstructions(req: LiveSessionRequest): string {
  const name = req.heroName ?? "the user";
  return [
    `You are Coach, the voice of LifeQuest, a personal health, training and life-quest app. You are talking with ${name}.`,
    "Speak like a warm, sharp coach: short sentences, one idea at a time, no lists read aloud, no markdown.",
    "Delegate to your backend for anything that needs the user's app data, calculations, planning, current information, or an action in the app (logging workouts, food, vitals, quests, journal, notes, goals, memories).",
    "Never say something was logged, changed or saved unless the backend reports it succeeded. If it fails, say so briefly and offer the next step.",
    "Keep talking naturally while the backend works; don't go silent.",
    "Health data is for personal tracking, not medical advice. For alarming vitals (for example blood pressure above 180/120 or very low or high glucose) calmly suggest contacting a healthcare provider or emergency services if they have symptoms.",
    MODE_FOCUS[req.mode]
  ].join("\n");
}

/** Instructions for the Responses backend model (reasoning + tools). */
export function liveBackendInstructions(req: LiveSessionRequest): string {
  const lines = [
    "You are the reasoning backend for LifeQuest's voice coach. Your output is spoken aloud by the voice model, so return concise, plain-language results (no markdown, no tables).",
    "Use the provided function tools to read and change the user's LifeQuest data on their device. Call get_context first when you need today's state. Prefer one precise action over several guesses; ask for missing required details instead of inventing values.",
    "Only report an action as done when the tool result says it succeeded. Deleting data is limited to the explicit remove/forget tools and only when the user clearly asked.",
    "Tool tips: use quest ids from get_context or list_quests for complete_quest and set_daily_plan; use log_lifts for named exercises with sets, reps and weight; navigate only queues a screen that opens when the call ends, so say that.",
    "Use web search only for current outside information (weather, travel, opening hours), never for the user's personal data.",
    "Not medical advice: give general, safety-first guidance and point to a clinician for concerning health values."
  ];
  if (req.context?.trim()) {
    lines.push("", "User context from the app (their own data):", req.context.trim());
  }
  return lines.join("\n");
}

/** Build the POST /v1/live/sessions body. Exported for tests. */
export function buildLiveSessionBody(req: LiveSessionRequest, backendModel: string = LIVE_BACKEND_MODEL): Record<string, unknown> {
  return {
    session: {
      model: LIVE_VOICE_MODEL,
      instructions: liveVoiceInstructions(req),
      delegation: {
        type: "responses",
        responses: {
          model: backendModel,
          instructions: liveBackendInstructions(req),
          tools: [...req.tools, { type: "web_search" }],
          tool_choice: "auto",
          parallel_tool_calls: false,
          reasoning: { effort: "low" }
        }
      }
    },
    transport: { type: "webrtc", sdp: req.sdp }
  };
}

export type CreateLiveSession = (req: LiveSessionRequest) => Promise<LiveSessionResponse>;

let testCreateLiveSession: CreateLiveSession | undefined;

export function setLiveSessionForTests(creator: CreateLiveSession | undefined) {
  testCreateLiveSession = creator;
}

export async function createLiveSession(req: LiveSessionRequest): Promise<LiveSessionResponse> {
  if (testCreateLiveSession) return testCreateLiveSession(req);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AINotConfiguredError();

  // The backend follows the coach model (and its fallback) unless overridden by env.
  const followsCoach = LIVE_BACKEND_MODEL === COACH_MODEL;
  const post = (backendModel: string) =>
    fetch("https://api.openai.com/v1/live/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildLiveSessionBody(req, backendModel))
    });

  let backendModel = followsCoach ? activeCoachModel() : LIVE_BACKEND_MODEL;
  let response = await post(backendModel);
  if (!response.ok && followsCoach && backendModel === COACH_MODEL) {
    const detail = await readOpenAIErrorText(response);
    // Retry once on the fallback backend if the *backend* model is the problem (not gpt-live itself).
    if (isModelAccessError(response.status, detail) && detail.includes(COACH_MODEL) && !detail.includes(LIVE_VOICE_MODEL)) {
      markPrimaryCoachModelUnavailable();
      if (activeCoachModel() !== backendModel) {
        backendModel = activeCoachModel();
        response = await post(backendModel);
      }
    }
  }
  if (!response.ok) {
    throw await buildOpenAIError(response, "GPT-Live session request");
  }
  return parseLiveSessionResponse(await response.json(), backendModel);
}

/** Read `session.id` + `transport.sdp` from the OpenAI response. Exported for tests. */
export function parseLiveSessionResponse(payload: unknown, backendModel: string = LIVE_BACKEND_MODEL): LiveSessionResponse {
  const p = (payload ?? {}) as { session?: { id?: unknown; model?: unknown }; transport?: { sdp?: unknown } };
  const sdp = p.transport?.sdp;
  if (typeof sdp !== "string" || !sdp.trim()) {
    throw new Error("GPT-Live session response was missing the SDP answer.");
  }
  return {
    sessionId: typeof p.session?.id === "string" ? p.session.id : "",
    sdp,
    model: typeof p.session?.model === "string" ? p.session.model : LIVE_VOICE_MODEL,
    backendModel,
    credentialSource: "openai"
  };
}
