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

/** Text model powering the AI Coach (chat, morning/evening planning, reports). */
export const COACH_MODEL = "gpt-5.5";

/** Realtime model powering hands-free voice sessions. */
export const REALTIME_VOICE_MODEL = "gpt-realtime-2.0";
