import type {
  DailyPlan,
  DailyReport,
  IsoDate,
  IsoDateTime,
  JournalEntry,
  MetricEntry,
  Task
} from "@/domain/types";
import { isIsoTimestampOnDate } from "@/domain/dates";

export type DailyReportInput = {
  date: IsoDate;
  tasks: Task[];
  dailyPlan?: DailyPlan;
  metricEntries: MetricEntry[];
  journalEntries: JournalEntry[];
  generatedBy?: DailyReport["generatedBy"];
  includeLinkedInSourceMaterial?: boolean;
};

export type GenerateDailyReportPayload = {
  date: IsoDate;
  style: "deterministic" | "ai_assisted";
  includeLinkedInSourceMaterial: boolean;
};

export type GenerateDailyReportPayloadValidationResult =
  | { ok: true; value: GenerateDailyReportPayload }
  | { ok: false; message: string };

const notLogged = "Not logged";
const noEntryCaptured = "No entry captured";

function bullet(value: string): string {
  return `- ${value}`;
}

function titleForTask(task: Task | undefined, fallbackId: string): string {
  return task ? task.title : `Missing task record (${fallbackId})`;
}

function getPlannedTaskIds(dailyPlan: DailyPlan | undefined): string[] {
  if (!dailyPlan) {
    return [];
  }

  return [dailyPlan.mainQuestTaskId, ...dailyPlan.sideQuestTaskIds].filter(
    (taskId): taskId is string => Boolean(taskId)
  );
}

function formatTask(task: Task): string {
  const details = [
    task.priority ? `${task.priority} priority` : undefined,
    task.tags.length > 0 ? `tags: ${task.tags.join(", ")}` : undefined
  ].filter(Boolean);

  return details.length > 0 ? `${task.title} (${details.join("; ")})` : task.title;
}

function formatMetricEntry(entry: MetricEntry): string {
  const values = [
    `${entry.checkInType} check-in`,
    entry.energyLevel !== undefined ? `energy ${entry.energyLevel}/5` : undefined,
    entry.moodLevel !== undefined ? `mood ${entry.moodLevel}/5` : undefined,
    entry.sleepHours !== undefined ? `sleep ${entry.sleepHours}h` : undefined,
    entry.steps !== undefined ? `${entry.steps} steps` : undefined,
    entry.weightLbs !== undefined ? `${entry.weightLbs} lbs` : undefined,
    entry.kettlebellSwingsTotal !== undefined
      ? `${entry.kettlebellSwingsTotal} kettlebell swings`
      : undefined,
    entry.karateClass ? "karate class" : undefined,
    entry.distanceWalkedMiles !== undefined
      ? `${entry.distanceWalkedMiles} mi walked`
      : undefined,
    entry.workoutSummary ? `workout: ${entry.workoutSummary}` : undefined,
    entry.notes ? `notes: ${entry.notes}` : undefined
  ].filter(Boolean);

  return values.join(" | ");
}

function formatJournalEntry(entry: JournalEntry): string {
  const prompt = entry.prompt ? ` (${entry.prompt})` : "";
  return `${entry.type.replace("_", " ")}${prompt}: ${entry.content}`;
}

function getCompletedTasks(tasks: Task[], date: IsoDate): Task[] {
  return tasks.filter(
    (task) => task.status === "done" && isIsoTimestampOnDate(task.completedAt, date)
  );
}

function getLinkedInSourceMaterial(journalEntries: JournalEntry[]): string[] {
  return journalEntries.map((entry) => formatJournalEntry(entry));
}

function section(title: string, lines: string[]): string {
  return [`## ${title}`, "", ...lines].join("\n");
}

export function getDailyReportFilename(date: IsoDate): string {
  return `lifequest-report-${date}.md`;
}

export function validateGenerateDailyReportPayload(
  payload: unknown
): GenerateDailyReportPayloadValidationResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, message: "Report payload must be an object." };
  }

  const value = payload as Partial<GenerateDailyReportPayload>;
  const date = typeof value.date === "string" ? value.date.trim() : "";

  if (!date) {
    return { ok: false, message: "Report date is required." };
  }

  if (value.style !== "deterministic" && value.style !== "ai_assisted") {
    return { ok: false, message: "Report style is invalid." };
  }

  if (typeof value.includeLinkedInSourceMaterial !== "boolean") {
    return { ok: false, message: "LinkedIn source material flag is required." };
  }

  return {
    ok: true,
    value: {
      date,
      style: value.style,
      includeLinkedInSourceMaterial: value.includeLinkedInSourceMaterial
    }
  };
}

export function generateDailyReport(
  input: DailyReportInput,
  now: IsoDateTime = new Date().toISOString()
): DailyReport {
  const taskById = new Map(input.tasks.map((task) => [task.id, task]));
  const plannedTaskIds = getPlannedTaskIds(input.dailyPlan);
  const plannedTasks = plannedTaskIds.map((taskId) => titleForTask(taskById.get(taskId), taskId));
  const completedTasks = getCompletedTasks(input.tasks, input.date);
  const metricsForDate = input.metricEntries.filter((entry) => entry.date === input.date);
  const journalForDate = input.journalEntries.filter((entry) => entry.date === input.date);
  const lessonJournalEntries = journalForDate.filter((entry) => entry.type === "lesson");
  const linkedInSourceMaterial = input.includeLinkedInSourceMaterial ?? true
    ? getLinkedInSourceMaterial(journalForDate)
    : [];
  const missingNotes: string[] = [];

  if (!input.dailyPlan) {
    missingNotes.push("Daily plan not logged.");
  }

  if (plannedTasks.length === 0) {
    missingNotes.push("Planned tasks not captured.");
  }

  if (metricsForDate.length === 0) {
    missingNotes.push("Metrics not logged.");
  }

  if (journalForDate.length === 0) {
    missingNotes.push("Journal entries not captured.");
  }

  const sections = [
    `# LifeQuest Daily Report - ${input.date}`,
    "",
    input.generatedBy === "ai"
      ? section("AI-Assisted Report Notes", [
          bullet("Generated from stored LifeQuest facts only."),
          bullet("Missing sections are labeled instead of inferred.")
        ])
      : "",
    section("Daily Quest Summary", [
      input.dailyPlan
        ? bullet(
            `Plan status: ${input.dailyPlan.status}; Main Quest: ${
              input.dailyPlan.mainQuestTaskId
                ? titleForTask(taskById.get(input.dailyPlan.mainQuestTaskId), input.dailyPlan.mainQuestTaskId)
                : noEntryCaptured
            }; Side Quests: ${input.dailyPlan.sideQuestTaskIds.length}`
          )
        : notLogged,
      input.dailyPlan?.intention ? bullet(`Intention: ${input.dailyPlan.intention}`) : ""
    ].filter(Boolean)),
    section(
      "Tasks Planned",
      plannedTasks.length > 0 ? plannedTasks.map(bullet) : [notLogged]
    ),
    section(
      "Tasks Completed",
      completedTasks.length > 0 ? completedTasks.map((task) => bullet(formatTask(task))) : [noEntryCaptured]
    ),
    section(
      "Metrics Snapshot",
      metricsForDate.length > 0 ? metricsForDate.map((entry) => bullet(formatMetricEntry(entry))) : [notLogged]
    ),
    section(
      "Lessons Learned",
      lessonJournalEntries.length > 0
        ? lessonJournalEntries.map((entry) => bullet(formatJournalEntry(entry)))
        : [noEntryCaptured]
    ),
    section(
      "LinkedIn Source Material",
      linkedInSourceMaterial.length > 0 ? linkedInSourceMaterial.map(bullet) : [noEntryCaptured]
    ),
    section(
      "Missing Data Notes",
      missingNotes.length > 0 ? missingNotes.map(bullet) : [bullet("No missing data noted.")]
    )
  ].filter(Boolean);

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `daily-report-${input.date}-${now}`,
    date: input.date,
    markdownContent: sections.join("\n\n"),
    generatedBy: input.generatedBy ?? "deterministic",
    createdAt: now,
    updatedAt: now
  };
}

export function upsertDailyReport(reports: DailyReport[], report: DailyReport): DailyReport[] {
  const existing = reports.find((current) => current.date === report.date);

  if (!existing) {
    return [report, ...reports];
  }

  return reports.map((current) =>
    current.id === existing.id
      ? {
          ...report,
          id: existing.id,
          createdAt: existing.createdAt
        }
      : current
  );
}

export function getDailyReportForDate(
  reports: DailyReport[],
  date: IsoDate
): DailyReport | undefined {
  return reports.find((report) => report.date === date);
}

export function isDailyReport(value: unknown): value is DailyReport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const report = value as Partial<DailyReport>;

  return (
    typeof report.id === "string" &&
    typeof report.date === "string" &&
    typeof report.markdownContent === "string" &&
    report.generatedBy !== undefined &&
    ["deterministic", "ai"].includes(report.generatedBy) &&
    typeof report.createdAt === "string" &&
    typeof report.updatedAt === "string"
  );
}
