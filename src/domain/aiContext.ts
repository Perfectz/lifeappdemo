import type {
  AIAppContext,
  AIChatMode,
  DailyPlan,
  DailyReport,
  IsoDate,
  JournalEntry,
  MetricEntry,
  Task
} from "@/domain/types";
import { isDailyPlan } from "@/domain/dailyPlans";
import { isJournalEntry } from "@/domain/journal";
import { isMetricEntry } from "@/domain/metrics";
import { isDailyReport } from "@/domain/reports";
import { isTask } from "@/domain/tasks";

export const aiChatModes: AIChatMode[] = ["general", "morning", "evening", "report"];

export type AIStoredAppData = {
  tasks?: Task[];
  dailyPlans?: DailyPlan[];
  metricEntries?: MetricEntry[];
  journalEntries?: JournalEntry[];
  dailyReports?: DailyReport[];
};

export type AIChatRequestInput = {
  message: string;
  mode: AIChatMode;
  appData?: AIStoredAppData;
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
      : undefined
  };
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

  return {
    ok: true,
    value: {
      message,
      mode: mode as AIChatMode,
      appData: normalizeStoredAppData(body.appData)
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

  return {
    today,
    openTasks,
    todaysPlan,
    recentMetrics,
    recentJournalEntries,
    latestReport
  };
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
      entry.steps !== undefined ? `${entry.steps} steps` : undefined
    ].filter(Boolean);

    return `- ${parts.join(" | ")}`;
  });
  const journalLines = context.recentJournalEntries.map(
    (entry) => `- ${entry.date} ${entry.type}: ${entry.content.slice(0, 500)}`
  );

  return [
    `Today: ${context.today}`,
    "Open tasks:",
    taskLines.length > 0 ? taskLines.join("\n") : "- None",
    "Today's plan:",
    context.todaysPlan
      ? `- Status ${context.todaysPlan.status}; intention: ${context.todaysPlan.intention ?? "none"}`
      : "- Not logged",
    "Recent metrics:",
    metricLines.length > 0 ? metricLines.join("\n") : "- None",
    "Recent journal entries:",
    journalLines.length > 0 ? journalLines.join("\n") : "- None",
    "Latest report:",
    context.latestReport
      ? context.latestReport.markdownContent.slice(0, 1_200)
      : "- No report generated"
  ].join("\n");
}
