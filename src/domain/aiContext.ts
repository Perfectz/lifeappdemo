import type {
  AIAppContext,
  AIChatMode,
  DailyPlan,
  DailyReport,
  FoodEntry,
  Goal,
  IsoDate,
  JournalEntry,
  MetricEntry,
  Note,
  Task,
  Workout
} from "@/domain/types";
import { isDailyPlan } from "@/domain/dailyPlans";
import { getDailyFitnessStatus } from "@/domain/dailyFitness";
import { getInsightHighlights } from "@/domain/insights";
import { isJournalEntry } from "@/domain/journal";
import { isMetricEntry } from "@/domain/metrics";
import { isNote } from "@/domain/notes";
import {
  caloriesRemaining,
  getFoodEntriesForDate,
  groupEntriesByMeal,
  isFoodEntry,
  mealTypes,
  netCarbs,
  sumMacros
} from "@/domain/nutrition";
import { isNutritionGoals, type NutritionGoals } from "@/domain/nutritionGoals";
import { isHealthGoals, weightGoalProgressPercent, type HealthGoals } from "@/domain/healthGoals";
import {
  bloodPressureCategoryLabel,
  glucoseBandLabel,
  latestBloodPressure,
  latestGlucose,
  latestWeight
} from "@/domain/vitals";
import { isDailyReport } from "@/domain/reports";
import { isTask } from "@/domain/tasks";
import { isWorkout } from "@/domain/workouts";
import { isGoal } from "@/domain/goals";

export const aiChatModes: AIChatMode[] = [
  "general",
  "assistant",
  "planning",
  "review",
  "morning",
  "evening",
  "report"
];

export type AIStoredAppData = {
  tasks?: Task[];
  dailyPlans?: DailyPlan[];
  metricEntries?: MetricEntry[];
  journalEntries?: JournalEntry[];
  dailyReports?: DailyReport[];
  workouts?: Workout[];
  foodEntries?: FoodEntry[];
  nutritionGoals?: NutritionGoals;
  healthGoals?: HealthGoals;
  goals?: Goal[];
  notes?: Note[];
};

export type CoachHistoryTurn = { role: "user" | "assistant"; content: string };

export type AIChatRequestInput = {
  message: string;
  mode: AIChatMode;
  appData?: AIStoredAppData;
  heroName?: string;
  aboutMe?: string;
  history?: CoachHistoryTurn[];
};

export type AIChatRequestValidationResult =
  | { ok: true; value: AIChatRequestInput }
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeStoredAppData(value: unknown): AIStoredAppData | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    tasks: Array.isArray(value.tasks) ? value.tasks.filter(isTask) : undefined,
    dailyPlans: Array.isArray(value.dailyPlans) ? value.dailyPlans.filter(isDailyPlan) : undefined,
    metricEntries: Array.isArray(value.metricEntries)
      ? value.metricEntries.filter(isMetricEntry)
      : undefined,
    journalEntries: Array.isArray(value.journalEntries)
      ? value.journalEntries.filter(isJournalEntry)
      : undefined,
    dailyReports: Array.isArray(value.dailyReports)
      ? value.dailyReports.filter(isDailyReport)
      : undefined,
    workouts: Array.isArray(value.workouts) ? value.workouts.filter(isWorkout) : undefined,
    foodEntries: Array.isArray(value.foodEntries) ? value.foodEntries.filter(isFoodEntry) : undefined,
    nutritionGoals: isNutritionGoals(value.nutritionGoals) ? value.nutritionGoals : undefined,
    healthGoals: isHealthGoals(value.healthGoals) ? value.healthGoals : undefined,
    goals: Array.isArray(value.goals) ? value.goals.filter(isGoal) : undefined,
    notes: Array.isArray(value.notes) ? value.notes.filter(isNote) : undefined
  };
}

function normalizeHistory(value: unknown): CoachHistoryTurn[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const turns: CoachHistoryTurn[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const role = entry.role === "assistant" ? "assistant" : entry.role === "user" ? "user" : null;
    const content = typeof entry.content === "string" ? entry.content.trim().slice(0, 4_000) : "";
    if (role && content) {
      turns.push({ role, content });
    }
  }
  return turns.slice(-10);
}

function timestamp(value: string | undefined): number {
  const parsed = Date.parse(value ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function validateAIChatRequestBody(body: unknown): AIChatRequestValidationResult {
  if (!isRecord(body)) {
    return { ok: false, message: "Request body must be an object." };
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const mode = body.mode;

  if (!message) {
    return { ok: false, message: "Message is required." };
  }

  if (message.length > 4_000) {
    return { ok: false, message: "Message must be 4,000 characters or fewer." };
  }

  if (typeof mode !== "string" || !aiChatModes.includes(mode as AIChatMode)) {
    return { ok: false, message: "Mode is invalid." };
  }

  const heroName =
    typeof body.heroName === "string" && body.heroName.trim()
      ? body.heroName.trim().slice(0, 48)
      : undefined;

  const aboutMe =
    typeof body.aboutMe === "string" && body.aboutMe.trim()
      ? body.aboutMe.trim().slice(0, 8_000)
      : undefined;

  const history = normalizeHistory(body.history);

  return {
    ok: true,
    value: {
      message,
      mode: mode as AIChatMode,
      appData: normalizeStoredAppData(body.appData),
      heroName,
      aboutMe,
      history
    }
  };
}

export function buildAIAppContext(
  data: AIStoredAppData,
  today: IsoDate,
  limits = { tasks: 8, metrics: 5, journalEntries: 5 }
): AIAppContext {
  const openTasks = asArray(data.tasks)
    .filter((task) => task.status === "todo")
    .sort((left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt))
    .slice(0, limits.tasks);
  const todaysPlan = asArray(data.dailyPlans).find((plan) => plan.date === today);
  const recentMetrics = asArray(data.metricEntries)
    .sort((left, right) => timestamp(right.recordedAt) - timestamp(left.recordedAt))
    .slice(0, limits.metrics);
  const recentJournalEntries = asArray(data.journalEntries)
    .sort((left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt))
    .slice(0, limits.journalEntries);
  const latestReport = asArray(data.dailyReports).sort(
    (left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt)
  )[0];
  const recentNotes = asArray(data.notes)
    .sort((left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt))
    .slice(0, 8);

  const insightHighlights = getInsightHighlights(
    asArray(data.tasks),
    asArray(data.metricEntries),
    today
  );

  return {
    today,
    openTasks,
    todaysPlan,
    recentMetrics,
    recentJournalEntries,
    recentNotes,
    latestReport,
    insightHighlights,
    todaysNutrition: buildNutritionSummary(
      asArray(data.foodEntries),
      data.nutritionGoals,
      today
    ),
    todaysTraining: buildTrainingSummary(asArray(data.workouts), today),
    healthStatus: buildHealthStatus(asArray(data.metricEntries), data.healthGoals),
    goalsSummary: buildGoalsSummary(data.healthGoals, asArray(data.goals))
  };
}

function buildHealthStatus(metrics: MetricEntry[], goals: HealthGoals | undefined): string {
  const bp = latestBloodPressure(metrics);
  const glucose = latestGlucose(metrics);
  const weight = latestWeight(metrics);
  const lines = [
    bp
      ? `Blood pressure: latest ${bp.systolic}/${bp.diastolic} — ${bloodPressureCategoryLabel[bp.category]} (${bp.recordedAt.slice(0, 10)}).`
      : "Blood pressure: none logged yet.",
    glucose
      ? `Blood glucose: latest ${glucose.mgDl} mg/dL${glucose.band ? ` — ${glucoseBandLabel[glucose.band]} (fasting)` : ""}.`
      : "Blood glucose: none logged yet.",
    weight
      ? `Weight: ${weight.weightLbs} lb${
          goals?.weightTargetLbs
            ? ` (goal ${goals.weightTargetLbs} lb, ${weightGoalProgressPercent(goals, weight.weightLbs) ?? 0}% there)`
            : ""
        }.`
      : "Weight: none logged yet."
  ];
  return lines.join("\n");
}

function buildGoalsSummary(healthGoals: HealthGoals | undefined, goals: Goal[]): string {
  const lines: string[] = [];
  if (healthGoals) {
    lines.push(
      `Blood pressure target: ≤ ${healthGoals.bpSystolicTarget}/${healthGoals.bpDiastolicTarget}.`,
      `Fasting glucose target: ≤ ${healthGoals.fastingGlucoseTarget} mg/dL.`,
      healthGoals.weightTargetLbs
        ? `Weight goal: ${healthGoals.weightTargetLbs} lb${healthGoals.weightStartLbs ? ` (from ${healthGoals.weightStartLbs} lb).` : "."}`
        : "Weight goal: not set.",
      `Sleep target: ${healthGoals.sleepHoursTarget}h.`
    );
  }
  const active = goals.filter((goal) => goal.status === "active").slice(0, 8);
  if (active.length > 0) {
    lines.push(
      "Strategic goals:",
      ...active.map(
        (goal) =>
          `- [${goal.pillar}/${goal.horizon}] ${goal.title}${goal.targetDate ? ` (target ${goal.targetDate})` : ""}`
      )
    );
  }
  return lines.length > 0
    ? lines.join("\n")
    : "Targets not set (using standard health defaults); no strategic goals yet.";
}

function round(value: number): number {
  return Math.round(value);
}

function buildNutritionSummary(
  foods: FoodEntry[],
  goals: NutritionGoals | undefined,
  today: IsoDate
): string {
  const todayFoods = getFoodEntriesForDate(foods, today);
  const totals = sumMacros(todayFoods);
  const remaining = caloriesRemaining(goals?.calorieTarget, totals.calories);

  const budgetLine = goals?.calorieTarget
    ? `Calories: ${round(totals.calories)} eaten of ${goals.calorieTarget} target — ${remaining} remaining.`
    : `Calories eaten today: ${round(totals.calories)} (no calorie goal set).`;

  const macroLine = `Macros today: protein ${round(totals.proteinG)}g${
    goals?.proteinTargetG ? `/${goals.proteinTargetG}g` : ""
  }, carbs ${round(totals.carbsG)}g (net ${netCarbs(totals)}g), fat ${round(totals.fatG)}g, sugar ${round(
    totals.sugarG
  )}g, sodium ${round(totals.sodiumMg)}mg.`;

  const byMeal = groupEntriesByMeal(todayFoods);
  const mealLines = mealTypes
    .map((meal) => {
      const items = byMeal[meal];
      if (items.length === 0) return undefined;
      const names = items
        .map((item) => `${item.description}${item.macros.calories ? ` (${round(item.macros.calories)} cal)` : ""}`)
        .join(", ");
      return `  ${meal}: ${names}`;
    })
    .filter(Boolean);

  return [
    budgetLine,
    macroLine,
    mealLines.length > 0 ? `Logged today:\n${mealLines.join("\n")}` : "No food logged yet today."
  ].join("\n");
}

function buildTrainingSummary(workouts: Workout[], today: IsoDate): string {
  const status = getDailyFitnessStatus(workouts, today);
  const todayLine = `Training today ${status.completedCount}/3 — strength ${
    status.byType.strength ? "done" : "to do"
  }, cardio ${status.byType.cardio ? "done" : "to do"}, martial arts ${
    status.byType.martial_arts ? "done" : "to do"
  }.`;
  const recent = [...workouts]
    .sort((left, right) => timestamp(right.recordedAt) - timestamp(left.recordedAt))
    .slice(0, 5)
    .map((workout) => `- ${workout.date} ${workout.type}: ${workout.title ?? workout.type}`);
  return [todayLine, recent.length > 0 ? `Recent workouts:\n${recent.join("\n")}` : "No workouts logged yet."].join(
    "\n"
  );
}

export function summarizeAIAppContext(context: AIAppContext) {
  return {
    openTaskCount: context.openTasks.length,
    recentMetricCount: context.recentMetrics.length,
    recentJournalEntryCount: context.recentJournalEntries.length
  };
}

export function formatAIContextForPrompt(context: AIAppContext): string {
  const taskLines = context.openTasks.map(
    (task) =>
      `- ${task.title} (id: ${task.id}; ${task.priority}; tags: ${task.tags.join(", ") || "none"})`
  );
  const metricLines = context.recentMetrics.map((entry) => {
    const parts = [
      entry.date,
      entry.checkInType,
      entry.energyLevel !== undefined ? `energy ${entry.energyLevel}/5` : undefined,
      entry.moodLevel !== undefined ? `mood ${entry.moodLevel}/5` : undefined,
      entry.sleepHours !== undefined ? `sleep ${entry.sleepHours}h` : undefined,
      entry.steps !== undefined ? `${entry.steps} steps` : undefined,
      entry.kettlebellSwingsTotal !== undefined
        ? `${entry.kettlebellSwingsTotal} kettlebell swings`
        : undefined,
      entry.karateClass ? "karate class" : undefined,
      entry.distanceWalkedMiles !== undefined
        ? `${entry.distanceWalkedMiles} mi walked`
        : undefined
    ].filter(Boolean);

    return `- ${parts.join(" | ")}`;
  });
  const journalLines = context.recentJournalEntries.map(
    (entry) => `- ${entry.date} ${entry.type}: ${entry.content.slice(0, 500)}`
  );
  const noteLines = context.recentNotes.map(
    (note) => `- ${note.title}: ${note.content.slice(0, 400)}`
  );

  return [
    `Today: ${context.today}`,
    "Health status (derived from logged vitals):",
    context.healthStatus ?? "- Not available",
    "Your health goals / targets:",
    context.goalsSummary ?? "- Not available",
    "Open tasks:",
    taskLines.length > 0 ? taskLines.join("\n") : "- None",
    "Today's plan:",
    context.todaysPlan
      ? `- Status ${context.todaysPlan.status}; intention: ${context.todaysPlan.intention ?? "none"}`
      : "- Not logged",
    "Recent metrics (vitals):",
    metricLines.length > 0 ? metricLines.join("\n") : "- None",
    "Nutrition today:",
    context.todaysNutrition ?? "- Not available",
    "Training today:",
    context.todaysTraining ?? "- Not available",
    "Recent journal entries:",
    journalLines.length > 0 ? journalLines.join("\n") : "- None",
    "Recent notes and reference material:",
    noteLines.length > 0 ? noteLines.join("\n") : "- None",
    "Behavioral patterns (derived):",
    context.insightHighlights.length > 0
      ? context.insightHighlights.map((line) => `- ${line}`).join("\n")
      : "- None",
    "Latest report:",
    context.latestReport
      ? context.latestReport.markdownContent.slice(0, 1_200)
      : "- No report generated"
  ].join("\n");
}
