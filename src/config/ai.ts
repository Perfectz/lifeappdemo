/**
 * OpenAI model selection for LifeQuest OS.
 *
 * Model ids are a product decision, NOT a secret, so they live in code here
 * rather than in environment variables. The only secret is OPENAI_API_KEY.
 *
 * If your OpenAI account exposes one of these under a slightly different id,
 * change the string here — it's the single source of truth for both the
 * server coach route and the realtime voice route.
 */

/** Text model powering the AI Coach (chat, planning, vision, reports). */
export const COACH_MODEL = process.env.OPENAI_COACH_MODEL?.trim() || "gpt-5.5";

/** Realtime ("v2" GA) model powering the hands-free voice agent. */
export const REALTIME_VOICE_MODEL = process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime-2";

/**
 * GPT-5 / o-series ("reasoning") models reject a custom `temperature` and the
 * legacy `max_tokens` field, and benefit from a `reasoning_effort` hint. Older
 * chat models (gpt-4o, etc.) want `temperature` and don't accept those. This
 * lets one request builder serve both families.
 */
export function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/i.test(model.trim());
}
