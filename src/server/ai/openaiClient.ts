import type { AIToolProposal } from "@/domain";
import { COACH_MODEL, isReasoningModel } from "@/config/ai";
import { validateAIToolProposals } from "@/domain/aiTaskTools";
import { COACH_ACTIONS_PROMPT } from "@/domain/coachActions";

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
    "Use save_memory ({ key, content }) to store or update a durable fact about the user in long-term memory — resume, favorite workouts, preferences, schedule, anything they share or ask you to remember. Re-using a key updates that memory. Propose it (the user confirms) whenever you learn something worth keeping.",
    COACH_ACTIONS_PROMPT,
    "When recent sleep or energy is low, recommend a realistic workload and avoid overload.",
    "Do not invent missing metrics, reflections, lessons, or outcomes; label absent data clearly.",
    "For health metrics, log values without diagnosis or treatment advice.",
    "For concerning health values, use bounded language like consider discussing with a healthcare professional.",
    "If data is missing, say so directly."
  ].join(" ");

  const history = (input.history ?? [])
    .filter((turn) => turn.content.trim())
    .slice(-10)
    .map((turn) => ({ role: turn.role, content: turn.content }));

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    {
      role: "user",
      content: `Mode: ${input.mode}\n\nApp context:\n${input.context}\n\n${
        input.heroName?.trim() || "The user"
      } asks:\n${input.message}`
    }
  ];

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(
      chatCompletionBody({
        model: COACH_MODEL,
        messages,
        maxCompletionTokens: maxTokens,
        temperature: 0.4
      })
    )
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OpenAI request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw await buildOpenAIError(response, "OpenAI request");
  }

  const payload: unknown = await response.json();

  if (
    payload &&
    typeof payload === "object" &&
    "choices" in payload &&
    Array.isArray(payload.choices)
  ) {
    const firstChoice = payload.choices[0] as
      | { message?: { content?: unknown } }
      | undefined;
    const content = firstChoice?.message?.content;

    if (typeof content === "string" && content.trim()) {
      return normalizeCoachResult(content.trim());
    }
  }

  throw new Error("OpenAI response was empty.");
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
