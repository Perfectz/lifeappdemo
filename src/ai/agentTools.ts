import { z } from "zod";

import { cardioOptions, martialArtsOptions, strengthVariants } from "@/config/fitness";
import { journalEntryTypes } from "@/domain/journal";
import { checkInTypes } from "@/domain/metrics";
import { mealTypes } from "@/domain/nutrition";
import { taskPriorities, taskTags } from "@/domain/tasks";

/**
 * Single source of truth for the AI agents' tools, defined once in Zod.
 *
 * Both the text coach (Vercel AI SDK) and the voice agent (OpenAI Agents SDK)
 * consume these specs, so a tool is described in exactly one place. Execution is
 * client-side and local-first (the data lives in the browser): the model emits a
 * tool call, the user confirms, and `executeVoiceTool(name, args)` applies it.
 *
 * `kind`:
 *  - "action" — mutates app data; surfaced as a confirm card in chat.
 *  - "read"   — returns context to the model (voice agent only); never confirmed.
 */

function literals<const T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values);
}

export type AgentToolKind = "action" | "read";

export type AgentToolSpec = {
  name: string;
  kind: AgentToolKind;
  description: string;
  inputSchema: z.ZodType;
};

const mealType = literals(mealTypes as unknown as [string, ...string[]]);
const cardioActivity = literals(cardioOptions.map((o) => o.id) as unknown as [string, ...string[]]);
const martialSession = literals(martialArtsOptions.map((o) => o.id) as unknown as [string, ...string[]]);
const strengthVariant = literals(strengthVariants as unknown as [string, ...string[]]);
const priority = literals(taskPriorities as unknown as [string, ...string[]]);
const journalType = literals(journalEntryTypes as unknown as [string, ...string[]]);
const checkIn = literals(checkInTypes as unknown as [string, ...string[]]);

const num = () => z.number().optional();

export const AGENT_TOOL_SPECS: AgentToolSpec[] = [
  {
    name: "log_food",
    kind: "action",
    description:
      "Log a food or meal the user ate; estimate calories/macros when not given. sodiumMg is in MILLIGRAMS (a label's 0.6 g = 600 mg), never grams.",
    inputSchema: z.object({
      description: z.string().describe("What was eaten."),
      mealType: mealType.optional(),
      calories: num(),
      proteinG: num(),
      carbsG: num(),
      fatG: num(),
      fiberG: num(),
      sugarG: num(),
      sodiumMg: z.number().optional().describe("Sodium in milligrams (mg).")
    })
  },
  {
    name: "update_food",
    kind: "action",
    description:
      "Update a previously logged food, matched by part of its description. Provide only fields to change. sodiumMg is in mg.",
    inputSchema: z.object({
      description: z.string().describe("Part of the existing food's name to match."),
      newDescription: z.string().optional(),
      mealType: mealType.optional(),
      calories: num(),
      proteinG: num(),
      carbsG: num(),
      fatG: num(),
      fiberG: num(),
      sugarG: num(),
      sodiumMg: num()
    })
  },
  {
    name: "remove_food",
    kind: "action",
    description: "Delete a logged food, matched by part of its description.",
    inputSchema: z.object({ description: z.string() })
  },
  {
    name: "log_metric",
    kind: "action",
    description:
      "Log a health check-in / vitals (blood pressure, glucose, weight, sleep, energy, mood, steps). Provide only what the user mentions.",
    inputSchema: z.object({
      checkInType: checkIn.optional(),
      energyLevel: z.number().optional().describe("1-5"),
      moodLevel: z.number().optional().describe("1-5"),
      sleepHours: num(),
      steps: num(),
      weightLbs: num(),
      bloodPressureSystolic: num(),
      bloodPressureDiastolic: num(),
      bloodGlucoseMgDl: z.number().optional().describe("Blood glucose in mg/dL."),
      notes: z.string().optional()
    })
  },
  {
    name: "log_cardio",
    kind: "action",
    description: "Log a cardio session.",
    inputSchema: z.object({
      activity: cardioActivity,
      minutes: num(),
      distanceMiles: num(),
      weightVestLbs: num()
    })
  },
  {
    name: "log_strength",
    kind: "action",
    description: "Log a strength session for one of the five split days.",
    inputSchema: z.object({
      day: z.number().describe("Split day 1-5."),
      variant: strengthVariant.optional()
    })
  },
  {
    name: "log_martial_arts",
    kind: "action",
    description: "Log a martial-arts session.",
    inputSchema: z.object({ session: martialSession, minutes: num() })
  },
  {
    name: "create_quest",
    kind: "action",
    description: "Add a task/quest to the user's quest log.",
    inputSchema: z.object({
      title: z.string(),
      priority: priority.optional(),
      tags: z.array(literals(taskTags as unknown as [string, ...string[]])).optional()
    })
  },
  {
    name: "complete_quest",
    kind: "action",
    description: "Mark an open quest as done, matched by part of its title.",
    inputSchema: z.object({ title: z.string() })
  },
  {
    name: "add_journal_entry",
    kind: "action",
    description: "Capture a journal entry or lesson.",
    inputSchema: z.object({ content: z.string(), type: journalType.optional() })
  },
  {
    name: "save_note",
    kind: "action",
    description: "Save a quick note the user can read later.",
    inputSchema: z.object({
      title: z.string().optional(),
      content: z.string(),
      tags: z.array(z.string()).optional()
    })
  },
  {
    name: "set_nutrition_goal",
    kind: "action",
    description: "Update daily nutrition targets. Provide only fields to change.",
    inputSchema: z.object({
      calorieTarget: num(),
      proteinTargetG: num(),
      carbsTargetG: num(),
      fatTargetG: num(),
      waterTargetOz: num()
    })
  },
  {
    name: "set_health_goal",
    kind: "action",
    description:
      "Update health targets (weight goal, blood-pressure target, fasting-glucose target, sleep target). Provide only fields to change.",
    inputSchema: z.object({
      weightTargetLbs: num(),
      bpSystolicTarget: num(),
      bpDiastolicTarget: num(),
      fastingGlucoseTarget: num(),
      sleepHoursTarget: num()
    })
  },
  {
    name: "save_memory",
    kind: "action",
    description:
      "Store or update a durable fact about the user in long-term memory (resume, preferences, conditions). Re-using a key updates it.",
    inputSchema: z.object({ key: z.string(), content: z.string() })
  },
  // Read-only context tools — voice agent only (the text coach gets context
  // injected server-side, so it never needs to call these).
  {
    name: "get_context",
    kind: "read",
    description: "Get a snapshot of today: fitness progress, open quests, intention, latest check-in, note count.",
    inputSchema: z.object({})
  },
  {
    name: "read_about_me",
    kind: "read",
    description: "Read the user's personal profile (health, goals, training, preferences, people, constraints).",
    inputSchema: z.object({})
  },
  {
    name: "read_memory",
    kind: "read",
    description: "Recall the user's stored long-term memories, optionally filtered by a query.",
    inputSchema: z.object({ query: z.string().optional() })
  }
];

export const AGENT_ACTION_TOOL_NAMES = AGENT_TOOL_SPECS.filter((t) => t.kind === "action").map(
  (t) => t.name
);

export function getAgentToolSpec(name: string): AgentToolSpec | undefined {
  return AGENT_TOOL_SPECS.find((spec) => spec.name === name);
}
