/**
 * The extra actions the AI coach (text chat) can propose beyond the core
 * task/plan/report/metric/journal/memory tools — these mirror the voice agent's
 * action layer so the coach can modify any part of the app (nutrition, workouts,
 * notes, goals). They are validated loosely server-side (the payload is passed
 * through) and executed client-side via executeVoiceTool after the user confirms,
 * which does the real validation + persistence.
 *
 * Server-safe: no client/browser imports, so both the server prompt/validation
 * and the client executor can share it.
 */

export const COACH_ACTION_TOOL_NAMES = [
  "log_food",
  "update_food",
  "remove_food",
  "log_metric",
  "log_cardio",
  "log_strength",
  "log_martial_arts",
  "create_quest",
  "complete_quest",
  "add_journal_entry",
  "save_note",
  "set_nutrition_goal",
  "set_health_goal",
  "create_goal"
] as const;

export type CoachActionToolName = (typeof COACH_ACTION_TOOL_NAMES)[number];

export function isCoachActionTool(name: string): name is CoachActionToolName {
  return (COACH_ACTION_TOOL_NAMES as readonly string[]).includes(name);
}

/**
 * Short behavioral guidance for the coach. The actual tool schemas are supplied
 * via OpenAI tool-calling (COACH_TOOL_DEFINITIONS), so this no longer documents
 * payload shapes — it just tells the model to actually CALL the tools.
 */
export const COACH_ACTIONS_PROMPT = [
  "You can modify any part of the app by CALLING the provided tools — log/update/remove food, log workouts (cardio/strength/martial arts), log vitals, create/complete quests, create strategic goals, add journal entries, save notes, set nutrition/health targets, and save memory.",
  "When the user asks you to do, add, change, fix, or remove something, CALL the matching tool. Never just say 'I've added it' or 'I can't' without calling the tool. The user confirms each tool call before it applies.",
  "Sodium is always in milligrams (mg), never grams — a label's 0.6 g of sodium is 600 mg."
].join(" ");
