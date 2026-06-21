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
  "log_cardio",
  "log_strength",
  "log_martial_arts",
  "save_note",
  "set_nutrition_goal",
  "set_health_goal"
] as const;

export type CoachActionToolName = (typeof COACH_ACTION_TOOL_NAMES)[number];

export function isCoachActionTool(name: string): name is CoachActionToolName {
  return (COACH_ACTION_TOOL_NAMES as readonly string[]).includes(name);
}

/** Schema documentation injected into the coach system prompt. */
export const COACH_ACTIONS_PROMPT = [
  "You can ALSO propose these actions to modify any part of the app (user confirms each). Payload shapes:",
  "- log_food { description, mealType?: breakfast|lunch|dinner|snack, calories?, proteinG?, carbsG?, fatG?, fiberG?, sugarG?, sodiumMg? } — log a meal/food; estimate macros when not given. sodiumMg is in MILLIGRAMS (e.g. a slice of bread ~150, a fast-food meal ~1000-1500); never grams.",
  "- update_food { description (part of an existing food's name to match), newDescription?, mealType?, calories?, proteinG?, carbsG?, fatG?, fiberG?, sugarG?, sodiumMg? } — change an already-logged food. Use when the user asks to fix/adjust a meal.",
  "- remove_food { description } — delete a logged food.",
  "- log_cardio { activity: walk|run|jog|ddr|bike-vest, minutes?, distanceMiles?, weightVestLbs? }",
  "- log_strength { day: 1-5, variant?: Free Weight|Machine|Kettlebell }",
  "- log_martial_arts { session: bas-beginner|bas-advanced|shidokan-kickboxing|shidokan-karate, minutes? }",
  "- save_note { title?, content, tags? }",
  "- set_nutrition_goal { calorieTarget?, proteinTargetG?, carbsTargetG?, fatTargetG?, waterTargetOz? }",
  "- set_health_goal { weightTargetLbs?, bpSystolicTarget?, bpDiastolicTarget?, fastingGlucoseTarget?, sleepHoursTarget? }",
  "When the user asks to add a meal, log a workout, take a note, or change a goal/target, propose the matching action — don't say you can't."
].join("\n");
