import { COACH_FALLBACK_MODEL, COACH_MODEL, requiresNoReasoningForChatTools } from "@/config/ai";

/**
 * Coach-model fallback.
 *
 * COACH_MODEL (gpt-6-sol) is the preferred brain for the PWA and the Android
 * app. If the project's OpenAI key can't use it yet (model not found / no
 * access), requests transparently retry on COACH_FALLBACK_MODEL (the model the
 * app shipped with) and the rest of this server instance skips the doomed
 * first attempt. Nothing else changes: prompts, schemas and tools are identical.
 */

let primaryUnavailable = false;

/** The coach model requests should use right now. */
export function activeCoachModel(): string {
  return primaryUnavailable && hasFallback() ? COACH_FALLBACK_MODEL : COACH_MODEL;
}

function hasFallback(): boolean {
  return Boolean(COACH_FALLBACK_MODEL) && COACH_FALLBACK_MODEL !== COACH_MODEL;
}

/** Remember that the primary model is unavailable on this key (per server instance). */
export function markPrimaryCoachModelUnavailable(): void {
  if (hasFallback()) primaryUnavailable = true;
}

/** True when an OpenAI error says the model itself is unknown or not enabled for this key. */
export function isModelAccessError(status: number, message: string): boolean {
  if (status !== 400 && status !== 403 && status !== 404) return false;
  return (
    /model_not_found/i.test(message) ||
    (/model/i.test(message) &&
      /(not found|does not exist|do not have access|not have access|no access|not available|unsupported model|invalid model)/i.test(message))
  );
}

/** OpenAI's error `code` + `message` from a failed response (reads a clone; "" when unreadable). */
export async function readOpenAIErrorText(response: Response): Promise<string> {
  try {
    const err = (await response.clone().json()) as { error?: { message?: unknown; code?: unknown } };
    return [err?.error?.code, err?.error?.message].filter((v) => typeof v === "string").join(" ");
  } catch {
    return "";
  }
}

/** For tests. */
export function resetCoachModelFallbackForTests(): void {
  primaryUnavailable = false;
}

/** Swap the primary coach model for the fallback inside a Chat Completions / Responses body. */
function withFallbackModel(body: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...body, model: COACH_FALLBACK_MODEL };
  // "none" is only forced for GPT-6 + Chat Completions tools; restore the prior default.
  if (next.reasoning_effort === "none" && !requiresNoReasoningForChatTools(COACH_FALLBACK_MODEL)) {
    next.reasoning_effort = "low";
  }
  return next;
}

/**
 * `fetch` for OpenAI JSON endpoints whose body carries `model: COACH_MODEL`.
 * Retries once on the fallback model when the primary model is unavailable.
 * Other requests (different model, non-JSON body) pass straight through.
 */
export async function openAIFetch(url: string, init: RequestInit): Promise<Response> {
  let body: Record<string, unknown> | undefined;
  if (typeof init.body === "string") {
    try {
      const parsed = JSON.parse(init.body) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
    } catch {
      body = undefined;
    }
  }
  const usesPrimary = body?.model === COACH_MODEL && hasFallback();
  if (!body || !usesPrimary) return fetch(url, init);

  if (primaryUnavailable) {
    return fetch(url, { ...init, body: JSON.stringify(withFallbackModel(body)) });
  }

  const response = await fetch(url, init);
  if (response.ok || (response.status !== 400 && response.status !== 403 && response.status !== 404)) {
    return response;
  }
  const message = await readOpenAIErrorText(response);
  if (!isModelAccessError(response.status, message)) return response;

  markPrimaryCoachModelUnavailable();
  console.warn(`[ai] ${COACH_MODEL} unavailable on this key — falling back to ${COACH_FALLBACK_MODEL}.`);
  return fetch(url, { ...init, body: JSON.stringify(withFallbackModel(body)) });
}
