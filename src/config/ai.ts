/**
 * OpenAI model selection for LifeQuest OS.
 *
 * Model ids are a product decision, NOT a secret, so they live in code here
 * rather than in environment variables. The only secret is OPENAI_API_KEY.
 *
 * If your OpenAI account exposes one of these under a slightly different id,
 * change the string here (or set the env override) — it's the single source of
 * truth for the coach, the realtime voice route and the GPT-Live voice route.
 */

/** Text model powering the AI Coach (chat, planning, vision, reports). */
export const COACH_MODEL = process.env.OPENAI_COACH_MODEL?.trim() || "gpt-6-sol";

/**
 * Used automatically when the key can't use COACH_MODEL (model not found / no
 * access) — the model the coach shipped with, so nothing breaks. See
 * src/server/ai/modelFallback.ts.
 */
export const COACH_FALLBACK_MODEL = process.env.OPENAI_COACH_FALLBACK_MODEL?.trim() || "gpt-5.5";

/** Realtime ("v2" GA) model powering the legacy hands-free voice agent (web). */
export const REALTIME_VOICE_MODEL = process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime-2";

/**
 * GPT-Live full-duplex voice model (POST /v1/live/sessions, WebRTC). It talks;
 * reasoning and tool use are delegated to LIVE_BACKEND_MODEL via Responses
 * delegation.
 */
export const LIVE_VOICE_MODEL = process.env.OPENAI_LIVE_MODEL?.trim() || "gpt-live-1";

/** Backend (Responses) model GPT-Live hands reasoning + tool calls to. */
export const LIVE_BACKEND_MODEL = process.env.OPENAI_LIVE_BACKEND_MODEL?.trim() || COACH_MODEL;

/**
 * GPT-5+/o-series ("reasoning") models reject a custom `temperature` and the
 * legacy `max_tokens` field, and benefit from a `reasoning_effort` hint. Older
 * chat models (gpt-4o, etc.) want `temperature` and don't accept those. This
 * lets one request builder serve both families (gpt-5.x, gpt-6-sol, o3, …).
 */
export function isReasoningModel(model: string): boolean {
  return /^(gpt-([5-9]|\d{2,})|o\d)/i.test(model.trim());
}

/**
 * GPT-6 family models only allow function calling through Chat Completions
 * when `reasoning_effort` is "none" (the Responses API has no such limit).
 */
export function requiresNoReasoningForChatTools(model: string): boolean {
  return /^gpt-6/i.test(model.trim());
}
