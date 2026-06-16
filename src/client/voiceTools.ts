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
import { checkInTypes, createMetricEntry, getLatestMetricEntry, type MetricInput } from "@/domain/metrics";
import { createJournalEntry, journalEntryTypes } from "@/domain/journal";
import { createLocalNoteRepository } from "@/data/noteRepository";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createNote, getRecentNotes, searchNotes } from "@/domain/notes";
import { getDailyFitnessStatus } from "@/domain/dailyFitness";
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

export type VoiceToolResult = {
  ok: boolean;
  message: string;
  navigateTo?: string;
  /** Read/context tools: data goes to the model but isn't shown as an "action" in the UI. */
  silent?: boolean;
};

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
    name: "save_note",
    description:
      "Save a note from the conversation so the user can read it later on the Notes screen. Use when the user shares something worth remembering or asks you to note it.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title; inferred from content if omitted." },
        content: { type: "string" },
        tags: { type: "array", items: { type: "string" } }
      },
      required: ["content"]
    }
  },
  {
    type: "function",
    name: "get_context",
    description:
      "Get a snapshot of the user's day — fitness progress, open quests, today's intention, latest health check-in, note count. Call this to ground coaching/advice in their real data before responding.",
    parameters: { type: "object", properties: {} }
  },
  {
    type: "function",
    name: "list_quests",
    description: "List the user's open quests/tasks.",
    parameters: { type: "object", properties: {} }
  },
  {
    type: "function",
    name: "list_recent_workouts",
    description: "List recently logged workouts (strength, cardio, martial arts).",
    parameters: {
      type: "object",
      properties: { limit: { type: "number", description: "How many (default 5)." } }
    }
  },
  {
    type: "function",
    name: "read_notes",
    description: "Read the user's saved notes, optionally filtered by a search query.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Optional text to search notes for." } }
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

function saveNote(args: Record<string, unknown>): VoiceToolResult {
  const content = asText(args.content);
  if (!content) return { ok: false, message: "What should I write in the note?" };
  const title = asText(args.title) || `${content.slice(0, 56)}${content.length > 56 ? "…" : ""}`;
  const tags = Array.isArray(args.tags)
    ? args.tags.map((tag) => String(tag))
    : asText(args.tags)
      ? asText(args.tags).split(",")
      : [];
  const repo = createLocalNoteRepository(store());
  const note = createNote({ title, content, tags });
  repo.save([note, ...repo.load()]);
  return { ok: true, message: `Saved note "${note.title}".` };
}

function getContext(): VoiceToolResult {
  const day = today();
  const openTasks = createLocalTaskRepository(store())
    .load()
    .filter((task) => task.status === "todo");
  const fitness = getDailyFitnessStatus(createLocalWorkoutRepository(store()).load(), day);
  const latest = getLatestMetricEntry(createLocalMetricRepository(store()).load());
  const noteCount = createLocalNoteRepository(store()).load().length;
  const plan = createLocalDailyPlanRepository(store())
    .load()
    .find((entry) => entry.date === day);

  const checkIn = latest
    ? [
        latest.energyLevel ? `energy ${latest.energyLevel}/5` : "",
        latest.moodLevel ? `mood ${latest.moodLevel}/5` : "",
        latest.bloodPressureSystolic
          ? `BP ${latest.bloodPressureSystolic}/${latest.bloodPressureDiastolic}`
          : ""
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const parts = [
    `Today is ${day}.`,
    `Fitness ${fitness.completedCount}/3 — strength ${fitness.byType.strength ? "done" : "to do"}, cardio ${fitness.byType.cardio ? "done" : "to do"}, martial arts ${fitness.byType.martial_arts ? "done" : "to do"}.`,
    openTasks.length
      ? `${openTasks.length} open quest(s): ${openTasks.slice(0, 5).map((t) => t.title).join("; ")}.`
      : "No open quests.",
    plan?.intention ? `Today's intention: ${plan.intention}.` : "",
    checkIn ? `Latest check-in: ${checkIn}.` : "",
    `${noteCount} saved note(s).`
  ].filter(Boolean);

  return { ok: true, silent: true, message: parts.join(" ") };
}

function listQuests(): VoiceToolResult {
  const open = createLocalTaskRepository(store())
    .load()
    .filter((task) => task.status === "todo");
  return {
    ok: true,
    silent: true,
    message: open.length
      ? `Open quests: ${open.map((task) => task.title).join("; ")}.`
      : "No open quests."
  };
}

function listRecentWorkouts(args: Record<string, unknown>): VoiceToolResult {
  const limit = asNumber(args.limit) ?? 5;
  const workouts = createLocalWorkoutRepository(store())
    .load()
    .slice()
    .sort((a, b) => (b.recordedAt > a.recordedAt ? 1 : -1))
    .slice(0, limit);
  return {
    ok: true,
    silent: true,
    message: workouts.length
      ? `Recent workouts: ${workouts.map((w) => `${w.title ?? w.type} (${w.date})`).join("; ")}.`
      : "No workouts logged yet."
  };
}

function readNotes(args: Record<string, unknown>): VoiceToolResult {
  const query = asText(args.query);
  const all = createLocalNoteRepository(store()).load();
  const found = query ? searchNotes(all, query) : getRecentNotes(all, 5);
  if (!found.length) {
    return { ok: true, silent: true, message: query ? `No notes match "${query}".` : "No notes yet." };
  }
  const summary = found
    .slice(0, 5)
    .map((note) => `"${note.title}": ${note.content.slice(0, 160)}`)
    .join(" | ");
  return { ok: true, silent: true, message: summary };
}

const HANDLERS: Record<string, (args: Record<string, unknown>) => VoiceToolResult> = {
  create_quest: createQuest,
  complete_quest: completeQuest,
  log_cardio: logCardio,
  log_strength: logStrength,
  log_martial_arts: logMartialArts,
  log_metric: logMetric,
  add_journal_entry: addJournalEntry,
  save_note: saveNote,
  get_context: getContext,
  list_quests: listQuests,
  list_recent_workouts: listRecentWorkouts,
  read_notes: readNotes,
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
