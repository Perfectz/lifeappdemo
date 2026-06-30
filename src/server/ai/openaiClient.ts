import {
  Agent,
  assistant,
  run,
  setDefaultOpenAIKey,
  tool,
  user,
  type AgentInputItem,
  type ModelSettings,
  type RunToolApprovalItem,
  type Tool
} from "@openai/agents";

import type { AIToolProposal } from "@/domain";
import { COACH_MODEL, isReasoningModel } from "@/config/ai";
import { validateAIToolProposalInput, validateAIToolProposals } from "@/domain/aiTaskTools";
import { COACH_ACTIONS_PROMPT } from "@/domain/coachActions";
import { COACH_TOOL_DEFINITIONS } from "@/domain/coachToolDefinitions";

export type CoachHistoryTurn = { role: "user" | "assistant"; content: string };

export type OpenAIChatCompletionInput = {
  message: string;
  mode: string;
  context: string;
  heroName?: string;
  history?: CoachHistoryTurn[];
};

type ChatMessage = { role: "system" | "user" | "assistant"; content: unknown };

/**
 * A failed OpenAI call that carries the upstream status + reason, so routes can
 * surface an actionable message ("model not found", "invalid key", "quota")
 * instead of a generic "unavailable".
 */
export class OpenAIRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "OpenAIRequestError";
    this.status = status;
  }
}

/** Read OpenAI's error body and build a descriptive, user-safe error. */
export async function buildOpenAIError(response: Response, label: string): Promise<OpenAIRequestError> {
  let detail = "";
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    if (typeof body?.error?.message === "string") {
      detail = body.error.message;
    }
  } catch {
    // No JSON body — fall back to the status-based message.
  }
  const base =
    response.status === 401
      ? "OpenAI rejected the API key — check OPENAI_API_KEY in your environment."
      : response.status === 429
        ? "OpenAI rate limit or quota reached — try again shortly."
        : response.status === 400 || response.status === 404
          ? "OpenAI rejected the request — the model id or parameters may be unsupported on your key."
          : `${label} failed (HTTP ${response.status}).`;
  return new OpenAIRequestError(detail ? `${base} (${detail})` : base, response.status);
}

/**
 * Build a Chat Completions body that works for both reasoning models (gpt-5 /
 * o-series: need max_completion_tokens + reasoning_effort, reject temperature)
 * and classic chat models (gpt-4o: want temperature).
 */
export function chatCompletionBody(opts: {
  model: string;
  messages: ChatMessage[];
  maxCompletionTokens: number;
  temperature?: number;
  responseFormat?: { type: "json_object" };
  tools?: unknown[];
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    max_completion_tokens: opts.maxCompletionTokens
  };
  if (isReasoningModel(opts.model)) {
    body.reasoning_effort = "low";
  } else if (opts.temperature !== undefined) {
    body.temperature = opts.temperature;
  }
  if (opts.responseFormat) {
    body.response_format = opts.responseFormat;
  }
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools;
    body.tool_choice = "auto";
  }
  return body;
}

export type OpenAICoachResult = {
  message: string;
  proposals?: AIToolProposal[];
};

export type OpenAIChatCompletion = (
  input: OpenAIChatCompletionInput
) => Promise<string | OpenAICoachResult>;

let testCompletion: OpenAIChatCompletion | undefined;

export function setOpenAIChatCompletionForTests(completion: OpenAIChatCompletion | undefined) {
  testCompletion = completion;
}

export class AINotConfiguredError extends Error {
  constructor() {
    super("OpenAI API key is not configured.");
    this.name = "AINotConfiguredError";
  }
}

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * The coach's action tools, expressed for the OpenAI Agents SDK.
 *
 * We reuse the exact JSON Schemas from COACH_TOOL_DEFINITIONS (non-strict) so
 * the tool surface stays identical to the previous hand-rolled tool-calling.
 * Every tool is `needsApproval: true`: the Agents SDK pauses the run and
 * surfaces the call as an interruption instead of executing it — which is
 * precisely our propose-then-confirm flow (the real mutation runs client-side
 * via executeVoiceTool after the user confirms). So `execute` never runs on the
 * server; it exists only to satisfy the tool contract.
 */
const COACH_AGENT_TOOLS: Tool[] = COACH_TOOL_DEFINITIONS.map((def) => {
  // Normalize the existing Chat-Completions JSON Schema into the Agents SDK's
  // non-strict shape (it requires `required` + `additionalProperties: true`).
  // Non-strict keeps the lenient validation the app already relies on — the
  // real validation happens client-side on confirm.
  const params = {
    type: "object" as const,
    properties: def.function.parameters.properties,
    required: def.function.parameters.required ?? [],
    additionalProperties: true as const
  };
  return tool({
    name: def.function.name,
    description: def.function.description,
    parameters: params,
    strict: false,
    needsApproval: true,
    execute: async () => "Proposed — awaiting user confirmation."
  } as unknown as Parameters<typeof tool>[0]);
});

let coachKeyConfigured = false;

/** Point the Agents SDK at our key once (it otherwise reads OPENAI_API_KEY). */
function ensureCoachKeyConfigured(apiKey: string) {
  if (!coachKeyConfigured) {
    setDefaultOpenAIKey(apiKey);
    coachKeyConfigured = true;
  }
}

/**
 * Reasoning models (gpt-5 / o-series) reject a custom temperature and take a
 * reasoning-effort hint; classic chat models want temperature. Mirror the prior
 * request-builder behavior through the SDK's ModelSettings.
 */
function coachModelSettings(maxTokens: number): ModelSettings {
  return isReasoningModel(COACH_MODEL)
    ? { reasoning: { effort: "low" }, maxTokens }
    : { temperature: 0.4, maxTokens };
}

/** Convert Agents SDK approval interruptions into validated coach proposals. */
function interruptionsToProposals(interruptions: RunToolApprovalItem[]): AIToolProposal[] {
  const asToolCalls = interruptions.map((item) => {
    const raw = item.rawItem as { name?: unknown; arguments?: unknown } | undefined;
    return { function: { name: raw?.name, arguments: raw?.arguments } };
  });
  return toolCallsToProposals(asToolCalls);
}

export async function completeReadOnlyCoachChat(
  input: OpenAIChatCompletionInput
): Promise<OpenAICoachResult> {
  if (testCompletion) {
    return normalizeCoachResult(await testCompletion(input));
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new AINotConfiguredError();
  }

  ensureCoachKeyConfigured(apiKey);

  // Cost + safety guards: cap output tokens and abort hung requests.
  const maxTokens = intFromEnv("OPENAI_MAX_TOKENS", 1_200);
  const timeoutMs = intFromEnv("OPENAI_TIMEOUT_MS", 30_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const systemPrompt = [
    "You are the LifeQuest OS coach — part personal trainer, part life coach, part assistant.",
    "Use the supplied app context to answer concisely and conversationally.",
    "The user is working to become a specific future version of themselves, described in their About Me / self-profile when present in the context.",
    "Frame guidance around that identity: when it helps, ask 'what would that future self do?' and connect today's choices (food, training, sleep, vitals, focus) to that goal.",
    "Be encouraging and honest, never flattering; prioritize the user's stated top health priorities first.",
    "The context includes a derived 'Health status' (latest blood pressure category, glucose band, weight vs goal) and their health targets — treat these as ground truth about the user's conditions (e.g. hypertension-range BP, diabetes-range glucose) and tailor food, training, and lifestyle advice to them, even if their written profile is sparse.",
    "For task changes, only propose actions; never claim they are already applied.",
    "When proposing task or data changes, return JSON with message and proposals. Otherwise reply with plain conversational text.",
    "Supported toolName values are create_task, update_task, complete_task, defer_task, archive_task, log_metric, create_journal_entry, propose_daily_plan, generate_daily_report, save_memory.",
    "Use save_memory ({ key, content, category }) to remember durable coaching facts so the user never has to fill out a profile. PROACTIVELY propose it (they confirm) the moment they mention an injury, medication, condition, equipment, schedule constraint, food like/dislike, what has worked, a goal, or a preference — pick the matching category (medication, condition, injury, training, nutrition, equipment, schedule, preference, goal, general). One fact per memory; reuse a key to update it.",
    "The context includes a 'What I know about you' section of saved memories. Treat medication, condition, and injury memories as SAFETY GROUND TRUTH: tailor every training and nutrition suggestion around them, never contradict them, and defer to the user's doctor for medical specifics.",
    COACH_ACTIONS_PROMPT,
    "When recent sleep or energy is low, recommend a realistic workload and avoid overload.",
    "Do not invent missing metrics, reflections, lessons, or outcomes; label absent data clearly.",
    "For health metrics, log values without diagnosis or treatment advice.",
    "For concerning health values, use bounded language like consider discussing with a healthcare professional.",
    "If data is missing, say so directly."
  ].join(" ");

  // The system prompt becomes the agent's instructions; prior turns + the
  // current question become the run input. Tool calls are gated behind
  // `needsApproval`, so the run pauses and returns them as interruptions
  // instead of executing — which we surface to the client as proposals.
  const inputItems: AgentInputItem[] = [
    ...(input.history ?? [])
      .filter((turn) => turn.content.trim())
      .slice(-10)
      .map((turn) => (turn.role === "user" ? user(turn.content) : assistant(turn.content))),
    user(
      `Mode: ${input.mode}\n\nApp context:\n${input.context}\n\n${
        input.heroName?.trim() || "The user"
      } asks:\n${input.message}`
    )
  ];

  const coachAgent = new Agent({
    name: "LifeQuest Coach",
    instructions: systemPrompt,
    model: COACH_MODEL,
    modelSettings: coachModelSettings(maxTokens),
    tools: COACH_AGENT_TOOLS
  });

  let result;
  try {
    result = await run(coachAgent, inputItems, {
      signal: controller.signal,
      maxTurns: 4
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || /abort/i.test(error.message))) {
      throw new Error("OpenAI request timed out.");
    }
    throw toOpenAIRequestError(error);
  } finally {
    clearTimeout(timeout);
  }

  const proposals = interruptionsToProposals(result.interruptions ?? []);
  const content = typeof result.finalOutput === "string" ? result.finalOutput.trim() : "";

  if (proposals.length > 0) {
    return {
      message: content || "Here's the change — confirm below.",
      proposals
    };
  }
  if (content) {
    return normalizeCoachResult(content);
  }

  throw new Error("OpenAI response was empty.");
}

/**
 * Best-effort mapping of an Agents SDK / OpenAI error into our OpenAIRequestError
 * so routes can surface an actionable message (bad key, quota, model id) rather
 * than a generic failure. Falls back to a 502-style wrapper.
 */
function toOpenAIRequestError(error: unknown): OpenAIRequestError {
  if (error instanceof OpenAIRequestError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const statusMatch = /\b(401|403|429|400|404)\b/.exec(message);
  const status = statusMatch ? Number(statusMatch[1]) : 502;
  const base =
    status === 401 || status === 403
      ? "OpenAI rejected the API key — check OPENAI_API_KEY in your environment."
      : status === 429
        ? "OpenAI rate limit or quota reached — try again shortly."
        : status === 400 || status === 404
          ? "OpenAI rejected the request — the model id or parameters may be unsupported on your key."
          : "OpenAI request failed.";
  return new OpenAIRequestError(`${base} (${message})`, status);
}

type RawToolCall = { function?: { name?: unknown; arguments?: unknown } };

function summarizeToolCall(name: string, args: Record<string, unknown>): string {
  const text = (value: unknown) => (typeof value === "string" ? value : String(value ?? ""));
  switch (name) {
    case "log_food":
      return `Log ${text(args.mealType) || "food"}: ${text(args.description)}`;
    case "update_food":
      return `Update food: ${text(args.description)}`;
    case "remove_food":
      return `Remove food: ${text(args.description)}`;
    case "log_metric":
      return "Log a vitals check-in";
    case "log_cardio":
      return `Log cardio: ${text(args.activity)}`;
    case "log_strength":
      return `Log strength — day ${text(args.day)}`;
    case "log_martial_arts":
      return `Log martial arts: ${text(args.session)}`;
    case "create_quest":
      return `Add quest: ${text(args.title)}`;
    case "complete_quest":
      return `Complete quest: ${text(args.title)}`;
    case "add_journal_entry":
      return "Add a journal entry";
    case "save_note":
      return `Save note${args.title ? `: ${text(args.title)}` : ""}`;
    case "set_nutrition_goal":
      return "Update nutrition goals";
    case "set_health_goal":
      return "Update health goals";
    case "save_memory":
      return `Remember: ${text(args.key)}`;
    default:
      return name.replace(/_/g, " ");
  }
}

/** Convert OpenAI tool_calls into validated coach proposals. */
export function toolCallsToProposals(toolCalls: unknown): AIToolProposal[] {
  if (!Array.isArray(toolCalls)) return [];
  const proposals: AIToolProposal[] = [];
  for (const call of toolCalls as RawToolCall[]) {
    const name = typeof call?.function?.name === "string" ? call.function.name : "";
    if (!name) continue;
    let args: Record<string, unknown> = {};
    try {
      const raw = call.function?.arguments;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        args = parsed as Record<string, unknown>;
      }
    } catch {
      // ignore malformed args; validation below will reject if needed
    }
    const validation = validateAIToolProposalInput({
      toolName: name,
      summary: summarizeToolCall(name, args),
      payload: args
    });
    if (validation.ok) proposals.push(validation.value);
  }
  return proposals;
}

function normalizeCoachResult(result: string | OpenAICoachResult): OpenAICoachResult {
  if (typeof result !== "string") {
    return {
      message: result.message,
      proposals: validateAIToolProposals(result.proposals)
    };
  }

  const trimmed = result.trim();

  try {
    const parsed: unknown = JSON.parse(trimmed);

    if (parsed && typeof parsed === "object" && "message" in parsed) {
      const message = (parsed as { message?: unknown }).message;
      const proposals = (parsed as { proposals?: unknown }).proposals;

      if (typeof message === "string" && message.trim()) {
        return {
          message: message.trim(),
          proposals: validateAIToolProposals(proposals)
        };
      }
    }
  } catch {
    return { message: trimmed };
  }

  return { message: trimmed };
}
