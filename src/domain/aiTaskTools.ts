import type {
  AITaskToolName,
  AIToolProposal,
  DailyPlan,
  DailyReport,
  EntityId,
  EveningPostmortem,
  IsoDate,
  IsoDateTime,
  JournalEntry,
  JournalEntryType,
  MetricEntry,
  MetricLevel,
  Task,
  TaskPriority,
  TaskTag
} from "@/domain/types";
import type { DailyPlanInput } from "@/domain/dailyPlans";
import type { JournalEntryInput } from "@/domain/journal";
import type { TaskInput } from "@/domain/tasks";
import type { MetricInput } from "@/domain/metrics";
import { upsertDailyPlanForDate, validateDailyPlanInput } from "@/domain/dailyPlans";
import {
  generateDailyReport,
  upsertDailyReport,
  validateGenerateDailyReportPayload
} from "@/domain/reports";
import { checkInTypes, createMetricEntry, metricLevels, validateMetricInput } from "@/domain/metrics";
import { createJournalEntry, journalEntryTypes, validateJournalEntryInput } from "@/domain/journal";
import {
  archiveTask,
  completeTask,
  createTask,
  taskPriorities,
  taskTags,
  updateTask
} from "@/domain/tasks";

export const aiTaskToolNames: AITaskToolName[] = [
  "create_task",
  "update_task",
  "complete_task",
  "defer_task",
  "archive_task",
  "log_metric",
  "create_journal_entry",
  "propose_daily_plan",
  "generate_daily_report"
];

type CreateTaskPayload = TaskInput;

type UpdateTaskPayload = {
  taskId: EntityId;
  title?: string;
  description?: string;
  priority?: TaskPriority;
  tags?: TaskTag[];
  dueDate?: IsoDate;
  plannedForDate?: IsoDate;
};

type TaskIdPayload = {
  taskId: EntityId;
};

type DeferTaskPayload = TaskIdPayload & {
  plannedForDate?: IsoDate;
};

export type ProposeDailyPlanPayload = DailyPlanInput & {
  rationale: string;
};

export type AIToolProposalValidationResult =
  | { ok: true; value: AIToolProposal }
  | { ok: false; message: string };

export type ConfirmTaskToolRequestInput = {
  dailyPlans: DailyPlan[];
  dailyReports: DailyReport[];
  eveningPostmortems: EveningPostmortem[];
  journalEntries: JournalEntry[];
  metricEntries: MetricEntry[];
  proposal: AIToolProposal;
  tasks: Task[];
};

export type ConfirmTaskToolValidationResult =
  | { ok: true; value: ConfirmTaskToolRequestInput }
  | { ok: false; message: string };

export type AITaskToolApplyResult =
  | {
      ok: true;
      dailyPlans: DailyPlan[];
      dailyReports: DailyReport[];
      eveningPostmortems: EveningPostmortem[];
      journalEntries: JournalEntry[];
      metricEntries: MetricEntry[];
      tasks: Task[];
      appliedChangeSummary: string;
    }
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalTags(value: unknown): TaskTag[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const tags = value.filter((tag): tag is TaskTag => taskTags.includes(tag as TaskTag));
  return tags.length === value.length ? tags : undefined;
}

function normalizePriority(value: unknown, fallback: TaskPriority): TaskPriority {
  return taskPriorities.includes(value as TaskPriority) ? (value as TaskPriority) : fallback;
}

function validateTaskId(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function validateCreateTaskPayload(payload: unknown): CreateTaskPayload | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const title = optionalText(payload.title);

  if (!title) {
    return undefined;
  }

  const tags = optionalTags(payload.tags);

  if (payload.tags !== undefined && !tags) {
    return undefined;
  }

  return {
    title,
    description: optionalText(payload.description),
    priority: normalizePriority(payload.priority, "medium"),
    tags: tags ?? [],
    dueDate: optionalText(payload.dueDate),
    plannedForDate: optionalText(payload.plannedForDate)
  };
}

function validateUpdateTaskPayload(payload: unknown): UpdateTaskPayload | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const taskId = validateTaskId(payload.taskId);

  if (!taskId) {
    return undefined;
  }

  const tags = optionalTags(payload.tags);

  if (payload.tags !== undefined && !tags) {
    return undefined;
  }

  return {
    taskId,
    title: optionalText(payload.title),
    description: optionalText(payload.description),
    priority: taskPriorities.includes(payload.priority as TaskPriority)
      ? (payload.priority as TaskPriority)
      : undefined,
    tags,
    dueDate: optionalText(payload.dueDate),
    plannedForDate: optionalText(payload.plannedForDate)
  };
}

function validateTaskIdPayload(payload: unknown): TaskIdPayload | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const taskId = validateTaskId(payload.taskId);
  return taskId ? { taskId } : undefined;
}

function validateDeferTaskPayload(payload: unknown): DeferTaskPayload | undefined {
  const base = validateTaskIdPayload(payload);

  if (!base || !isRecord(payload)) {
    return undefined;
  }

  return {
    ...base,
    plannedForDate: optionalText(payload.plannedForDate)
  };
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function validateLogMetricPayload(payload: unknown): MetricInput | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const date = optionalText(payload.date);
  const checkInType = payload.checkInType;

  if (!date || typeof checkInType !== "string" || !checkInTypes.includes(checkInType as MetricInput["checkInType"])) {
    return undefined;
  }

  const input: MetricInput = {
    date,
    checkInType: checkInType as MetricInput["checkInType"],
    weightLbs: optionalNumber(payload.weightLbs),
    sleepHours: optionalNumber(payload.sleepHours),
    energyLevel: optionalNumber(payload.energyLevel),
    moodLevel: optionalNumber(payload.moodLevel),
    steps: optionalNumber(payload.steps),
    workoutSummary: optionalText(payload.workoutSummary),
    kettlebellSwingsTotal: optionalNumber(payload.kettlebellSwingsTotal),
    karateClass: typeof payload.karateClass === "boolean" ? payload.karateClass : undefined,
    distanceWalkedMiles: optionalNumber(payload.distanceWalkedMiles),
    bloodPressureSystolic: optionalNumber(payload.bloodPressureSystolic),
    bloodPressureDiastolic: optionalNumber(payload.bloodPressureDiastolic),
    notes: optionalText(payload.notes)
  };
  const validation = validateMetricInput(input);

  return validation.ok ? validation.value : undefined;
}

function validateCreateJournalEntryPayload(payload: unknown): JournalEntryInput | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const date = optionalText(payload.date);
  const type = payload.type;
  const content = optionalText(payload.content);

  if (!date || typeof type !== "string" || !journalEntryTypes.includes(type as JournalEntryType) || !content) {
    return undefined;
  }

  const input: JournalEntryInput = {
    date,
    type: type as JournalEntryType,
    prompt: optionalText(payload.prompt),
    content
  };
  const validation = validateJournalEntryInput(input);

  return validation.ok ? validation.value : undefined;
}

export function validateDailyPlanProposalPayload(
  payload: unknown,
  tasks?: Task[]
): ProposeDailyPlanPayload | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const date = optionalText(payload.date);
  const rationale = optionalText(payload.rationale);
  const mainQuestTaskId = optionalText(payload.mainQuestTaskId);
  const sideQuestTaskIds = Array.isArray(payload.sideQuestTaskIds)
    ? payload.sideQuestTaskIds.filter(
        (taskId): taskId is string => typeof taskId === "string" && Boolean(taskId.trim())
      )
    : undefined;

  if (!date || !rationale || !sideQuestTaskIds) {
    return undefined;
  }

  const input: DailyPlanInput = {
    date,
    mainQuestTaskId,
    sideQuestTaskIds,
    intention: optionalText(payload.intention)
  };

  if (tasks) {
    const validation = validateDailyPlanInput(input, tasks);
    return validation.ok ? { ...validation.value, rationale } : undefined;
  }

  if (sideQuestTaskIds.length > 3) {
    return undefined;
  }

  if (mainQuestTaskId && sideQuestTaskIds.includes(mainQuestTaskId)) {
    return undefined;
  }

  return {
    ...input,
    sideQuestTaskIds: [...new Set(sideQuestTaskIds)],
    rationale
  };
}

export function validateAIToolProposalInput(
  value: unknown,
  now: IsoDateTime = new Date().toISOString()
): AIToolProposalValidationResult {
  if (!isRecord(value)) {
    return { ok: false, message: "Tool proposal must be an object." };
  }

  const toolName = value.toolName;
  const summary = optionalText(value.summary);

  if (typeof toolName !== "string" || !aiTaskToolNames.includes(toolName as AITaskToolName)) {
    return { ok: false, message: "Tool name is not supported." };
  }

  if (!summary) {
    return { ok: false, message: "Tool proposal summary is required." };
  }

  const payload = sanitizePayload(toolName as AITaskToolName, value.payload);

  if (!payload) {
    return { ok: false, message: "Tool proposal payload is invalid." };
  }

  return {
    ok: true,
    value: {
      id: optionalText(value.id) ?? globalThis.crypto?.randomUUID?.() ?? `proposal-${now}`,
      toolName: toolName as AITaskToolName,
      summary,
      payload,
      status: "pending",
      createdAt: optionalText(value.createdAt) ?? now,
      updatedAt: now
    }
  };
}

export function validateAIToolProposals(values: unknown): AIToolProposal[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.flatMap((value) => {
    const validation = validateAIToolProposalInput(value);
    return validation.ok ? [validation.value] : [];
  });
}

export function validateConfirmTaskToolRequest(
  value: unknown
): ConfirmTaskToolValidationResult {
  if (!isRecord(value)) {
    return { ok: false, message: "Request body must be an object." };
  }

  const proposalValidation = validateAIToolProposalInput(value.proposal);

  if (!proposalValidation.ok) {
    return { ok: false, message: proposalValidation.message };
  }

  if (!Array.isArray(value.tasks)) {
    return { ok: false, message: "Task list is required." };
  }

  return {
    ok: true,
    value: {
      dailyPlans: Array.isArray(value.dailyPlans)
        ? value.dailyPlans.filter(isDailyPlanLike)
        : [],
      dailyReports: Array.isArray(value.dailyReports)
        ? value.dailyReports.filter(isDailyReportLike)
        : [],
      eveningPostmortems: Array.isArray(value.eveningPostmortems)
        ? value.eveningPostmortems.filter(isEveningPostmortemLike)
        : [],
      journalEntries: Array.isArray(value.journalEntries)
        ? value.journalEntries.filter(isJournalEntryLike)
        : [],
      metricEntries: Array.isArray(value.metricEntries)
        ? value.metricEntries.filter(isMetricEntryLike)
        : [],
      proposal: proposalValidation.value,
      tasks: value.tasks.filter((task): task is Task => isTaskLike(task))
    }
  };
}

function sanitizePayload(toolName: AITaskToolName, payload: unknown): unknown {
  if (toolName === "create_task") {
    return validateCreateTaskPayload(payload);
  }

  if (toolName === "update_task") {
    return validateUpdateTaskPayload(payload);
  }

  if (toolName === "complete_task" || toolName === "archive_task") {
    return validateTaskIdPayload(payload);
  }

  if (toolName === "defer_task") {
    return validateDeferTaskPayload(payload);
  }

  if (toolName === "log_metric") {
    return validateLogMetricPayload(payload);
  }

  if (toolName === "create_journal_entry") {
    return validateCreateJournalEntryPayload(payload);
  }

  if (toolName === "propose_daily_plan") {
    return validateDailyPlanProposalPayload(payload);
  }

  if (toolName === "generate_daily_report") {
    const validation = validateGenerateDailyReportPayload(payload);
    return validation.ok ? validation.value : undefined;
  }

  return undefined;
}

function isTaskLike(value: unknown): value is Task {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    ["todo", "done", "archived"].includes(String(value.status)) &&
    taskPriorities.includes(value.priority as TaskPriority) &&
    Array.isArray(value.tags)
  );
}

function isMetricEntryLike(value: unknown): value is MetricEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.date === "string" &&
    typeof value.checkInType === "string" &&
    checkInTypes.includes(value.checkInType as MetricInput["checkInType"]) &&
    typeof value.source === "string" &&
    typeof value.recordedAt === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    (value.energyLevel === undefined || metricLevels.includes(value.energyLevel as MetricLevel)) &&
    (value.moodLevel === undefined || metricLevels.includes(value.moodLevel as MetricLevel)) &&
    (value.kettlebellSwingsTotal === undefined ||
      typeof value.kettlebellSwingsTotal === "number") &&
    (value.karateClass === undefined || typeof value.karateClass === "boolean") &&
    (value.distanceWalkedMiles === undefined || typeof value.distanceWalkedMiles === "number")
  );
}

function isJournalEntryLike(value: unknown): value is JournalEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.date === "string" &&
    typeof value.type === "string" &&
    journalEntryTypes.includes(value.type as JournalEntryType) &&
    typeof value.content === "string" &&
    typeof value.source === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isDailyPlanLike(value: unknown): value is DailyPlan {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.date === "string" &&
    Array.isArray(value.sideQuestTaskIds) &&
    value.sideQuestTaskIds.every((taskId) => typeof taskId === "string") &&
    (value.mainQuestTaskId === undefined || typeof value.mainQuestTaskId === "string") &&
    (value.intention === undefined || typeof value.intention === "string") &&
    ["planned", "closed"].includes(String(value.status)) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isDailyReportLike(value: unknown): value is DailyReport {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.date === "string" &&
    typeof value.markdownContent === "string" &&
    ["deterministic", "ai"].includes(String(value.generatedBy)) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isEveningPostmortemLike(value: unknown): value is EveningPostmortem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.date === "string" &&
    Array.isArray(value.taskOutcomes) &&
    value.taskOutcomes.every(
      (outcome) =>
        isRecord(outcome) &&
        typeof outcome.taskId === "string" &&
        ["completed", "deferred", "left_open"].includes(String(outcome.outcome))
    ) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function replaceTask(tasks: Task[], updatedTask: Task): Task[] {
  return tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task));
}

function findTask(tasks: Task[], taskId: EntityId): Task | undefined {
  return tasks.find((task) => task.id === taskId);
}

export function applyAITaskToolProposal(
  proposal: AIToolProposal,
  tasks: Task[],
  now: IsoDateTime = new Date().toISOString(),
  metricEntries: MetricEntry[] = [],
  journalEntries: JournalEntry[] = [],
  dailyPlans: DailyPlan[] = [],
  dailyReports: DailyReport[] = [],
  eveningPostmortems: EveningPostmortem[] = []
): AITaskToolApplyResult {
  const validation = validateAIToolProposalInput(proposal, now);

  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const validatedProposal = validation.value;

  try {
    if (validatedProposal.toolName === "create_task") {
      const task = createTask(validatedProposal.payload as CreateTaskPayload, now);
      return {
        ok: true,
        dailyPlans,
        dailyReports,
        eveningPostmortems,
        journalEntries,
        metricEntries,
        tasks: [task, ...tasks],
        appliedChangeSummary: `Created task: ${task.title}`
      };
    }

    if (validatedProposal.toolName === "update_task") {
      const payload = validatedProposal.payload as UpdateTaskPayload;
      const task = findTask(tasks, payload.taskId);

      if (!task) {
        return { ok: false, message: "Task was not found." };
      }

      const updatedTask = updateTask(
        task,
        {
          title: payload.title ?? task.title,
          description: payload.description ?? task.description,
          priority: payload.priority ?? task.priority,
          tags: payload.tags ?? task.tags,
          dueDate: payload.dueDate ?? task.dueDate,
          plannedForDate: payload.plannedForDate ?? task.plannedForDate
        },
        now
      );

      return {
        ok: true,
        dailyPlans,
        dailyReports,
        eveningPostmortems,
        journalEntries,
        metricEntries,
        tasks: replaceTask(tasks, updatedTask),
        appliedChangeSummary: `Updated task: ${updatedTask.title}`
      };
    }

    if (validatedProposal.toolName === "complete_task") {
      const payload = validatedProposal.payload as TaskIdPayload;
      const task = findTask(tasks, payload.taskId);

      if (!task) {
        return { ok: false, message: "Task was not found." };
      }

      const updatedTask = completeTask(task, now);
      return {
        ok: true,
        dailyPlans,
        dailyReports,
        eveningPostmortems,
        journalEntries,
        metricEntries,
        tasks: replaceTask(tasks, updatedTask),
        appliedChangeSummary: `Completed task: ${updatedTask.title}`
      };
    }

    if (validatedProposal.toolName === "defer_task") {
      const payload = validatedProposal.payload as DeferTaskPayload;
      const task = findTask(tasks, payload.taskId);

      if (!task) {
        return { ok: false, message: "Task was not found." };
      }

      const updatedTask: Task = {
        ...task,
        status: "todo",
        completedAt: undefined,
        archivedAt: undefined,
        plannedForDate: payload.plannedForDate,
        updatedAt: now
      };

      return {
        ok: true,
        dailyPlans,
        dailyReports,
        eveningPostmortems,
        journalEntries,
        metricEntries,
        tasks: replaceTask(tasks, updatedTask),
        appliedChangeSummary: `Deferred task: ${updatedTask.title}`
      };
    }

    if (validatedProposal.toolName === "archive_task") {
      const payload = validatedProposal.payload as TaskIdPayload;
      const task = findTask(tasks, payload.taskId);

      if (!task) {
        return { ok: false, message: "Task was not found." };
      }

      const updatedTask = archiveTask(task, now);
      return {
        ok: true,
        dailyPlans,
        dailyReports,
        eveningPostmortems,
        journalEntries,
        metricEntries,
        tasks: replaceTask(tasks, updatedTask),
        appliedChangeSummary: `Archived task: ${updatedTask.title}`
      };
    }

    if (validatedProposal.toolName === "log_metric") {
      const entry = createMetricEntry(validatedProposal.payload as MetricInput, now);
      return {
        ok: true,
        dailyPlans,
        dailyReports,
        eveningPostmortems,
        journalEntries,
        metricEntries: [entry, ...metricEntries],
        tasks,
        appliedChangeSummary: `Logged metric entry: ${entry.date} ${entry.checkInType}`
      };
    }

    if (validatedProposal.toolName === "create_journal_entry") {
      const entry = createJournalEntry(validatedProposal.payload as JournalEntryInput, now);
      return {
        ok: true,
        dailyPlans,
        dailyReports,
        eveningPostmortems,
        journalEntries: [entry, ...journalEntries],
        metricEntries,
        tasks,
        appliedChangeSummary: `Created journal entry: ${entry.type.replace("_", " ")}`
      };
    }

    if (validatedProposal.toolName === "propose_daily_plan") {
      const payload = validateDailyPlanProposalPayload(validatedProposal.payload, tasks);

      if (!payload) {
        return { ok: false, message: "DailyPlan proposal is invalid." };
      }

      return {
        ok: true,
        dailyPlans: upsertDailyPlanForDate(dailyPlans, payload, tasks, now),
        dailyReports,
        eveningPostmortems,
        journalEntries,
        metricEntries,
        tasks,
        appliedChangeSummary: `Saved DailyPlan: ${payload.date}`
      };
    }

    if (validatedProposal.toolName === "generate_daily_report") {
      const payloadValidation = validateGenerateDailyReportPayload(validatedProposal.payload);

      if (!payloadValidation.ok) {
        return { ok: false, message: payloadValidation.message };
      }

      const payload = payloadValidation.value;
      const report = generateDailyReport(
        {
          date: payload.date,
          tasks,
          dailyPlan: dailyPlans.find((plan) => plan.date === payload.date),
          eveningPostmortem: eveningPostmortems.find(
            (postmortem) => postmortem.date === payload.date
          ),
          metricEntries,
          journalEntries,
          generatedBy: payload.style === "ai_assisted" ? "ai" : "deterministic",
          includeLinkedInSourceMaterial: payload.includeLinkedInSourceMaterial
        },
        now
      );

      return {
        ok: true,
        dailyPlans,
        dailyReports: upsertDailyReport(dailyReports, report),
        eveningPostmortems,
        journalEntries,
        metricEntries,
        tasks,
        appliedChangeSummary: `Generated ${payload.style.replace("_", "-")} report: ${payload.date}`
      };
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Tool proposal failed."
    };
  }

  return { ok: false, message: "Tool name is not supported." };
}
