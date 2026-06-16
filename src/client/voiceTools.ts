import { createLocalJournalRepository } from "@/data/journalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import {
  cardioOptions,
  equipmentForVariant,
  getExerciseVariant,
  martialArtsOptions,
  strengthVariants,
  strengthWorkouts,
  type StrengthVariant
} from "@/config/fitness";
import { toLocalIsoDate } from "@/domain/dates";
import { completeTask, createTask, taskPriorities, taskTags } from "@/domain/tasks";
import { createWorkout } from "@/domain/workouts";
import { checkInTypes, createMetricEntry, type MetricInput } from "@/domain/metrics";
import { createJournalEntry, journalEntryTypes } from "@/domain/journal";
import type { JournalEntryType, TaskPriority, TaskTag } from "@/domain";

/**
 * The action layer for the voice agent. Each tool maps a spoken intent onto a
 * real mutation against the local-first repositories (which dispatch the
 * data-changed event → live UI refresh + cloud sync). Tool definitions are
 * sent to the OpenAI Realtime session; executeVoiceTool runs the calls.
 *
 * Scope is intentionally additive + safe: create/log/complete/navigate. No
 * delete or archive over voice.
 */

export type VoiceToolResult = { ok: boolean; message: string; navigateTo?: string };

const PAGE_PATHS: Record<string, string> = {
  dashboard: "/dashboard",
  fitness: "/fitness",
  quests: "/tasks",
  metrics: "/metrics",
  journal: "/journal",
  trends: "/trends",
  coach: "/coach",
  reports: "/reports",
  morning_standup: "/standup/morning",
  evening_postmortem: "/standup/evening",
  settings: "/settings"
};

export const VOICE_TOOL_DEFINITIONS = [
  {
    type: "function",
    name: "create_quest",
    description: "Add a new task/quest to the user's quest log.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title of the quest." },
        priority: { type: "string", enum: taskPriorities },
        tags: { type: "array", items: { type: "string", enum: taskTags } }
      },
      required: ["title"]
    }
  },
  {
    type: "function",
    name: "complete_quest",
    description: "Mark an existing open quest as done, matched by title text.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Part of the quest title to match." }
      },
      required: ["title"]
    }
  },
  {
    type: "function",
    name: "log_cardio",
    description: "Log today's cardio session.",
    parameters: {
      type: "object",
      properties: {
        activity: { type: "string", enum: cardioOptions.map((o) => o.id) },
        minutes: { type: "number" },
        distanceMiles: { type: "number" },
        weightVestLbs: { type: "number" }
      },
      required: ["activity"]
    }
  },
  {
    type: "function",
    name: "log_strength",
    description: "Log today's strength session for one of the five split days.",
    parameters: {
      type: "object",
      properties: {
        day: { type: "number", enum: [1, 2, 3, 4, 5], description: "Split day 1-5." },
        variant: { type: "string", enum: strengthVariants }
      },
      required: ["day"]
    }
  },
  {
    type: "function",
    name: "log_martial_arts",
    description: "Log today's martial-arts session.",
    parameters: {
      type: "object",
      properties: {
        session: { type: "string", enum: martialArtsOptions.map((o) => o.id) },
        minutes: { type: "number" }
      },
      required: ["session"]
    }
  },
  {
    type: "function",
    name: "log_metric",
    description: "Log a health/energy check-in. Provide only the fields the user mentions.",
    parameters: {
      type: "object",
      properties: {
        checkInType: { type: "string", enum: checkInTypes },
        energyLevel: { type: "number", description: "1-5" },
        moodLevel: { type: "number", description: "1-5" },
        sleepHours: { type: "number" },
        steps: { type: "number" },
        weightLbs: { type: "number" },
        bloodPressureSystolic: { type: "number" },
        bloodPressureDiastolic: { type: "number" },
        notes: { type: "string" }
      }
    }
  },
  {
    type: "function",
    name: "add_journal_entry",
    description: "Capture a journal entry or lesson.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string" },
        type: { type: "string", enum: journalEntryTypes }
      },
      required: ["content"]
    }
  },
  {
    type: "function",
    name: "navigate",
    description: "Open a screen in the app.",
    parameters: {
      type: "object",
      properties: { page: { type: "string", enum: Object.keys(PAGE_PATHS) } },
      required: ["page"]
    }
  }
] as const;

export const voiceToolNames = VOICE_TOOL_DEFINITIONS.map((tool) => tool.name);

function store(): Storage {
  return window.localStorage;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function today(): string {
  return toLocalIsoDate(new Date());
}

function createQuest(args: Record<string, unknown>): VoiceToolResult {
  const title = asText(args.title);
  if (!title) return { ok: false, message: "I need a title to create a quest." };
  const priority = taskPriorities.includes(args.priority as TaskPriority)
    ? (args.priority as TaskPriority)
    : "medium";
  const tags = Array.isArray(args.tags)
    ? (args.tags.filter((tag) => taskTags.includes(tag as TaskTag)) as TaskTag[])
    : [];
  const repo = createLocalTaskRepository(store());
  const task = createTask({ title, priority, tags });
  repo.save([task, ...repo.load()]);
  return { ok: true, message: `Added quest "${task.title}".` };
}

function completeQuest(args: Record<string, unknown>): VoiceToolResult {
  const query = asText(args.title).toLowerCase();
  if (!query) return { ok: false, message: "Which quest should I complete?" };
  const repo = createLocalTaskRepository(store());
  const tasks = repo.load();
  const match = tasks.find(
    (task) => task.status === "todo" && task.title.toLowerCase().includes(query)
  );
  if (!match) return { ok: false, message: `I couldn't find an open quest matching "${args.title}".` };
  const updated = completeTask(match);
  repo.save(tasks.map((task) => (task.id === updated.id ? updated : task)));
  return { ok: true, message: `Completed "${match.title}".` };
}

function logCardio(args: Record<string, unknown>): VoiceToolResult {
  const id = asText(args.activity).toLowerCase();
  const option =
    cardioOptions.find((o) => o.id === id) ??
    cardioOptions.find((o) => o.label.toLowerCase().includes(id));
  const repo = createLocalWorkoutRepository(store());
  const workout = createWorkout({
    date: today(),
    type: "cardio",
    title: option?.label ?? asText(args.activity) ?? "Cardio",
    durationMinutes: asNumber(args.minutes),
    distanceMiles: asNumber(args.distanceMiles),
    weightVestLbs: asNumber(args.weightVestLbs)
  });
  repo.save([workout, ...repo.load()]);
  return { ok: true, message: `Logged cardio: ${workout.title}.` };
}

function logStrength(args: Record<string, unknown>): VoiceToolResult {
  const day = asNumber(args.day);
  const workout = strengthWorkouts.find((w) => w.day === day) ?? strengthWorkouts[0];
  const variant = strengthVariants.includes(args.variant as StrengthVariant)
    ? (args.variant as StrengthVariant)
    : "Free Weight";
  const repo = createLocalWorkoutRepository(store());
  const logged = createWorkout({
    date: today(),
    type: "strength",
    title: `Day ${workout.day} — ${workout.name} · ${variant}`,
    equipment: equipmentForVariant(variant),
    sets: workout.exercises.map((exercise) => {
      const detail = getExerciseVariant(exercise, variant);
      return { exercise: `${detail.name} (${exercise.scheme})` };
    })
  });
  repo.save([logged, ...repo.load()]);
  return { ok: true, message: `Logged strength: ${logged.title}.` };
}

function logMartialArts(args: Record<string, unknown>): VoiceToolResult {
  const id = asText(args.session).toLowerCase();
  const option =
    martialArtsOptions.find((o) => o.id === id) ??
    martialArtsOptions.find((o) => o.label.toLowerCase().includes(id));
  const repo = createLocalWorkoutRepository(store());
  const workout = createWorkout({
    date: today(),
    type: "martial_arts",
    title: option?.label ?? asText(args.session) ?? "Martial arts",
    durationMinutes: asNumber(args.minutes)
  });
  repo.save([workout, ...repo.load()]);
  return { ok: true, message: `Logged martial arts: ${workout.title}.` };
}

function logMetric(args: Record<string, unknown>): VoiceToolResult {
  const input: MetricInput = {
    date: today(),
    checkInType: checkInTypes.includes(args.checkInType as MetricInput["checkInType"])
      ? (args.checkInType as MetricInput["checkInType"])
      : "freeform",
    energyLevel: asNumber(args.energyLevel),
    moodLevel: asNumber(args.moodLevel),
    sleepHours: asNumber(args.sleepHours),
    steps: asNumber(args.steps),
    weightLbs: asNumber(args.weightLbs),
    bloodPressureSystolic: asNumber(args.bloodPressureSystolic),
    bloodPressureDiastolic: asNumber(args.bloodPressureDiastolic),
    notes: asText(args.notes) || undefined
  };
  const repo = createLocalMetricRepository(store());
  const entry = createMetricEntry(input); // throws on invalid → caught by executeVoiceTool
  repo.save([entry, ...repo.load()]);
  return { ok: true, message: "Logged your check-in." };
}

function addJournalEntry(args: Record<string, unknown>): VoiceToolResult {
  const content = asText(args.content);
  if (!content) return { ok: false, message: "What should I write in the journal?" };
  const type = journalEntryTypes.includes(args.type as JournalEntryType)
    ? (args.type as JournalEntryType)
    : "freeform";
  const repo = createLocalJournalRepository(store());
  const entry = createJournalEntry({ date: today(), type, content });
  repo.save([entry, ...repo.load()]);
  return { ok: true, message: "Saved a journal entry." };
}

function navigate(args: Record<string, unknown>): VoiceToolResult {
  const page = asText(args.page);
  const path = PAGE_PATHS[page];
  if (!path) return { ok: false, message: `I don't know the screen "${args.page}".` };
  return { ok: true, message: `Opening ${page.replace(/_/g, " ")}.`, navigateTo: path };
}

const HANDLERS: Record<string, (args: Record<string, unknown>) => VoiceToolResult> = {
  create_quest: createQuest,
  complete_quest: completeQuest,
  log_cardio: logCardio,
  log_strength: logStrength,
  log_martial_arts: logMartialArts,
  log_metric: logMetric,
  add_journal_entry: addJournalEntry,
  navigate
};

/** Execute a tool call from the voice agent. Never throws — returns a result. */
export function executeVoiceTool(name: string, args: Record<string, unknown>): VoiceToolResult {
  const handler = HANDLERS[name];
  if (!handler) return { ok: false, message: `Unknown action "${name}".` };
  try {
    return handler(args ?? {});
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "That action failed."
    };
  }
}
