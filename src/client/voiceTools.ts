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
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { createFoodEntry, mealTypes } from "@/domain/nutrition";
import { loadNutritionGoals, saveNutritionGoals } from "@/data/nutritionGoalsRepository";
import { withNutritionGoalEdits } from "@/domain/nutritionGoals";
import { loadHealthGoals, saveHealthGoals } from "@/data/healthGoalsRepository";
import { withGoalEdits } from "@/domain/healthGoals";
import { createNote, getRecentNotes, searchNotes } from "@/domain/notes";
import { loadWiki } from "@/data/wikiRepository";
import { formatWikiForPrompt } from "@/domain/personalWiki";
import { createLocalMemoryRepository } from "@/data/memoryRepository";
import { findMemory, isMemoryCategory, removeMemory, upsertMemory } from "@/domain/memory";
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
  nutrition: "/nutrition",
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
        bloodGlucoseMgDl: { type: "number", description: "Blood glucose in mg/dL" },
        notes: { type: "string" }
      }
    }
  },
  {
    type: "function",
    name: "log_food",
    description:
      "Log a food/meal the user ate, with calories and macros when known (e.g. from a meal photo or description). Estimate reasonable values when the user doesn't give exact numbers.",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string", description: "What was eaten." },
        mealType: { type: "string", enum: mealTypes },
        calories: { type: "number" },
        proteinG: { type: "number" },
        carbsG: { type: "number" },
        fatG: { type: "number" },
        fiberG: { type: "number" },
        sugarG: { type: "number" },
        sodiumMg: { type: "number", description: "Sodium in milligrams (mg), e.g. 600 — never grams." },
        confidence: { type: "string", enum: ["low", "medium", "high"] }
      },
      required: ["description"]
    }
  },
  {
    type: "function",
    name: "update_food",
    description:
      "Update an already-logged food entry, matched by part of its description. Provide only the fields to change (calories/macros, mealType, or newDescription). Sodium is in mg.",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string", description: "Part of the existing food's name to match." },
        newDescription: { type: "string" },
        mealType: { type: "string", enum: mealTypes },
        calories: { type: "number" },
        proteinG: { type: "number" },
        carbsG: { type: "number" },
        fatG: { type: "number" },
        fiberG: { type: "number" },
        sugarG: { type: "number" },
        sodiumMg: { type: "number", description: "Sodium in milligrams (mg)." }
      },
      required: ["description"]
    }
  },
  {
    type: "function",
    name: "remove_food",
    description: "Delete a logged food entry, matched by part of its description.",
    parameters: {
      type: "object",
      properties: { description: { type: "string" } },
      required: ["description"]
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
    name: "read_about_me",
    description:
      "Read the user's personal profile — health, goals, training, nutrition, preferences, people, constraints. Use it to ground advice in who they are.",
    parameters: { type: "object", properties: {} }
  },
  {
    type: "function",
    name: "remember",
    description:
      "Store a durable coaching fact about the user in long-term memory so you (and the app) recall it in future sessions — injuries, medications, conditions, equipment, schedule, food likes/dislikes, what worked, goals, preferences. Proactively remember such facts when mentioned. Re-using the same key overwrites that memory.",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "Short topic/title, e.g. 'right knee' or 'lisinopril'." },
        content: { type: "string", description: "What to remember." },
        category: {
          type: "string",
          enum: [
            "medication",
            "condition",
            "injury",
            "training",
            "nutrition",
            "equipment",
            "schedule",
            "preference",
            "goal",
            "general"
          ],
          description: "Bucket for the fact; use medication/condition/injury for health-critical facts."
        }
      },
      required: ["key", "content"]
    }
  },
  {
    type: "function",
    name: "forget",
    description: "Delete a stored memory by its key.",
    parameters: {
      type: "object",
      properties: { key: { type: "string" } },
      required: ["key"]
    }
  },
  {
    type: "function",
    name: "read_memory",
    description:
      "Recall the user's stored long-term memories, optionally filtered by a query. Call this early to ground yourself in what you've saved about them.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Optional text to filter memories." } }
    }
  },
  {
    type: "function",
    name: "set_nutrition_goal",
    description:
      "Update the user's daily nutrition targets. Provide only the fields they want to change.",
    parameters: {
      type: "object",
      properties: {
        calorieTarget: { type: "number" },
        proteinTargetG: { type: "number" },
        carbsTargetG: { type: "number" },
        fatTargetG: { type: "number" },
        waterTargetOz: { type: "number" }
      }
    }
  },
  {
    type: "function",
    name: "set_health_goal",
    description:
      "Update the user's health targets (weight goal, blood-pressure target, fasting-glucose target, sleep target). Provide only the fields they want to change.",
    parameters: {
      type: "object",
      properties: {
        weightTargetLbs: { type: "number" },
        bpSystolicTarget: { type: "number" },
        bpDiastolicTarget: { type: "number" },
        fastingGlucoseTarget: { type: "number" },
        sleepHoursTarget: { type: "number" }
      }
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
    bloodGlucoseMgDl: asNumber(args.bloodGlucoseMgDl),
    notes: asText(args.notes) || undefined
  };
  const repo = createLocalMetricRepository(store());
  const entry = createMetricEntry(input); // throws on invalid → caught by executeVoiceTool
  repo.save([entry, ...repo.load()]);
  return { ok: true, message: "Logged your check-in." };
}

function logFood(args: Record<string, unknown>): VoiceToolResult {
  const description = asText(args.description);
  if (!description) return { ok: false, message: "What food should I log?" };
  const mealType = mealTypes.includes(args.mealType as (typeof mealTypes)[number])
    ? (args.mealType as (typeof mealTypes)[number])
    : "snack";
  const confidence = ["low", "medium", "high"].includes(asText(args.confidence))
    ? (asText(args.confidence) as "low" | "medium" | "high")
    : undefined;
  const repo = createLocalFoodEntryRepository(store());
  const entry = createFoodEntry({
    date: today(),
    mealType,
    description,
    macros: {
      calories: asNumber(args.calories),
      proteinG: asNumber(args.proteinG),
      carbsG: asNumber(args.carbsG),
      fatG: asNumber(args.fatG),
      fiberG: asNumber(args.fiberG),
      sugarG: asNumber(args.sugarG),
      sodiumMg: asNumber(args.sodiumMg)
    },
    estimateSource: "photo_ai",
    confidence
  });
  repo.save([entry, ...repo.load()]);
  const kcal = entry.macros.calories;
  return {
    ok: true,
    message: `Logged ${mealType}: ${description}${kcal ? ` (~${kcal} cal)` : ""}.`
  };
}

/** Most recent food entry whose description contains the query (today first). */
function findFoodMatch(query: string) {
  const q = query.trim().toLowerCase();
  const all = createLocalFoodEntryRepository(store()).load();
  const matches = all
    .filter((entry) => entry.description.toLowerCase().includes(q))
    .sort((a, b) => (b.recordedAt > a.recordedAt ? 1 : -1));
  // Prefer today's entries, else the most recent overall.
  return matches.find((entry) => entry.date === today()) ?? matches[0];
}

function updateFood(args: Record<string, unknown>): VoiceToolResult {
  const query = asText(args.description);
  if (!query) return { ok: false, message: "Which food should I update? Name part of it." };
  const repo = createLocalFoodEntryRepository(store());
  const match = findFoodMatch(query);
  if (!match) return { ok: false, message: `I couldn't find a logged food matching "${query}".` };

  const macros = { ...match.macros };
  for (const field of ["calories", "proteinG", "carbsG", "fatG", "fiberG", "sugarG", "sodiumMg"] as const) {
    const value = asNumber(args[field]);
    if (value !== undefined) macros[field] = value;
  }
  const mealType = mealTypes.includes(args.mealType as (typeof mealTypes)[number])
    ? (args.mealType as (typeof mealTypes)[number])
    : match.mealType;
  const description = asText(args.newDescription) || match.description;
  const updated = { ...match, description, mealType, macros, updatedAt: new Date().toISOString() };
  repo.save(repo.load().map((entry) => (entry.id === match.id ? updated : entry)));
  return { ok: true, message: `Updated ${updated.description}.` };
}

function removeFood(args: Record<string, unknown>): VoiceToolResult {
  const query = asText(args.description);
  if (!query) return { ok: false, message: "Which food should I remove? Name part of it." };
  const repo = createLocalFoodEntryRepository(store());
  const match = findFoodMatch(query);
  if (!match) return { ok: false, message: `I couldn't find a logged food matching "${query}".` };
  repo.save(repo.load().filter((entry) => entry.id !== match.id));
  return { ok: true, message: `Removed ${match.description}.` };
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

function setNutritionGoal(args: Record<string, unknown>): VoiceToolResult {
  const edits: Record<string, number> = {};
  for (const field of ["calorieTarget", "proteinTargetG", "carbsTargetG", "fatTargetG", "waterTargetOz"]) {
    const value = asNumber(args[field]);
    if (value !== undefined && value > 0) edits[field] = value;
  }
  if (Object.keys(edits).length === 0) {
    return { ok: false, message: "Tell me which nutrition target to set (e.g. calories)." };
  }
  saveNutritionGoals(store(), withNutritionGoalEdits(loadNutritionGoals(store()), edits));
  return { ok: true, message: `Updated nutrition goals: ${Object.keys(edits).join(", ")}.` };
}

function setHealthGoal(args: Record<string, unknown>): VoiceToolResult {
  const edits: Record<string, number> = {};
  for (const field of [
    "weightTargetLbs",
    "bpSystolicTarget",
    "bpDiastolicTarget",
    "fastingGlucoseTarget",
    "sleepHoursTarget"
  ]) {
    const value = asNumber(args[field]);
    if (value !== undefined && value > 0) edits[field] = value;
  }
  if (Object.keys(edits).length === 0) {
    return { ok: false, message: "Tell me which health target to set (e.g. weight or blood pressure)." };
  }
  saveHealthGoals(store(), withGoalEdits(loadHealthGoals(store()), edits));
  return { ok: true, message: `Updated health goals: ${Object.keys(edits).join(", ")}.` };
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

function readAboutMe(): VoiceToolResult {
  const text = formatWikiForPrompt(loadWiki(store()));
  return {
    ok: true,
    silent: true,
    message: text || "No personal profile saved yet — the user can add one on the About Me screen."
  };
}

function remember(args: Record<string, unknown>): VoiceToolResult {
  const key = asText(args.key);
  const content = asText(args.content);
  if (!key || !content) return { ok: false, message: "I need a key and something to remember." };
  const category = isMemoryCategory(args.category) ? args.category : undefined;
  const repo = createLocalMemoryRepository(store());
  repo.save(upsertMemory(repo.load(), { key, content, category, source: "agent" }));
  return { ok: true, message: `Got it — I'll remember "${key}".` };
}

function forget(args: Record<string, unknown>): VoiceToolResult {
  const key = asText(args.key);
  if (!key) return { ok: false, message: "Which memory should I forget?" };
  const repo = createLocalMemoryRepository(store());
  const before = repo.load();
  const after = removeMemory(before, key);
  if (after.length === before.length) return { ok: false, message: `I don't have a memory called "${key}".` };
  repo.save(after);
  return { ok: true, message: `Forgot "${key}".` };
}

function readMemory(args: Record<string, unknown>): VoiceToolResult {
  const query = asText(args.query);
  const all = createLocalMemoryRepository(store()).load();
  const found = query ? findMemory(all, query) : all;
  if (!found.length) {
    return { ok: true, silent: true, message: query ? `No memories match "${query}".` : "No saved memories yet." };
  }
  const summary = found
    .slice(0, 12)
    .map((entry) => `${entry.key}: ${entry.content}`)
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
  log_food: logFood,
  update_food: updateFood,
  remove_food: removeFood,
  add_journal_entry: addJournalEntry,
  save_note: saveNote,
  get_context: getContext,
  list_quests: listQuests,
  list_recent_workouts: listRecentWorkouts,
  read_notes: readNotes,
  read_about_me: readAboutMe,
  remember,
  forget,
  read_memory: readMemory,
  set_nutrition_goal: setNutritionGoal,
  set_health_goal: setHealthGoal,
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
