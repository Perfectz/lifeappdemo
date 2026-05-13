export type EntityId = string;
export type IsoDateTime = string;
export type IsoDate = string;

export type TimestampedEntity = {
  id: EntityId;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type TaskStatus = "todo" | "done" | "archived";
export type TaskPriority = "low" | "medium" | "high";
export type TaskTag =
  | "health"
  | "work"
  | "content"
  | "social"
  | "admin"
  | "learning";

export type Task = TimestampedEntity & {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: TaskTag[];
  dueDate?: IsoDate;
  plannedForDate?: IsoDate;
  completedAt?: IsoDateTime;
  archivedAt?: IsoDateTime;
};

export type DailyPlanStatus = "planned" | "closed";

export type DailyPlan = TimestampedEntity & {
  date: IsoDate;
  mainQuestTaskId?: EntityId;
  sideQuestTaskIds: EntityId[];
  intention?: string;
  status: DailyPlanStatus;
};

export type TaskOutcome = "completed" | "deferred" | "left_open";

export type EveningTaskOutcome = {
  taskId: EntityId;
  outcome: TaskOutcome;
  note?: string;
};

export type EveningPostmortem = TimestampedEntity & {
  date: IsoDate;
  dailyPlanId?: EntityId;
  taskOutcomes: EveningTaskOutcome[];
  wins?: string;
  friction?: string;
  lessonsLearned?: string;
  tomorrowFollowUps?: string;
};

export type CheckInType = "morning" | "evening" | "freeform";
export type MetricSource = "manual" | "samsung_export" | "health_connect" | "demo";
export type MetricLevel = 1 | 2 | 3 | 4 | 5;

export type MetricEntry = TimestampedEntity & {
  date: IsoDate;
  checkInType: CheckInType;
  source: MetricSource;
  weightLbs?: number;
  sleepHours?: number;
  energyLevel?: MetricLevel;
  moodLevel?: MetricLevel;
  steps?: number;
  workoutSummary?: string;
  kettlebellSwingsTotal?: number;
  karateClass?: boolean;
  distanceWalkedMiles?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  notes?: string;
  recordedAt: IsoDateTime;
};

export type JournalEntryType =
  | "morning_intention"
  | "evening_reflection"
  | "lesson"
  | "freeform";
export type JournalSource = "manual" | "ai_assisted" | "voice_transcript" | "demo";

export type JournalEntry = TimestampedEntity & {
  date: IsoDate;
  type: JournalEntryType;
  prompt?: string;
  content: string;
  linkedDailyPlanId?: EntityId;
  linkedPostmortemId?: EntityId;
  source: JournalSource;
};

export type DailyReport = TimestampedEntity & {
  date: IsoDate;
  markdownContent: string;
  generatedBy: "deterministic" | "ai";
};

export type AIChatMode = "general" | "morning" | "evening" | "report";

export type AIAppContext = {
  today: IsoDate;
  openTasks: Task[];
  todaysPlan?: DailyPlan;
  recentMetrics: MetricEntry[];
  recentJournalEntries: JournalEntry[];
  latestReport?: DailyReport;
};

export type AIToolProposalStatus = "pending" | "confirmed" | "rejected" | "applied" | "failed";

export type AITaskToolName =
  | "create_task"
  | "update_task"
  | "complete_task"
  | "defer_task"
  | "archive_task"
  | "log_metric"
  | "create_journal_entry"
  | "propose_daily_plan"
  | "generate_daily_report";

export type AIToolProposal = TimestampedEntity & {
  toolName: AITaskToolName;
  summary: string;
  payload: unknown;
  status: AIToolProposalStatus;
};

export type VoiceSessionMode = "morning" | "evening" | "general";
export type VoiceSessionStatus = "idle" | "connecting" | "active" | "ended" | "failed";

export type VoiceSession = {
  id: string;
  mode: VoiceSessionMode;
  status: VoiceSessionStatus;
  transcript?: string;
  startedAt?: IsoDateTime;
  endedAt?: IsoDateTime;
};

export type HealthImportBatch = {
  id: string;
  source: "samsung_export" | "health_connect" | "demo";
  fileNames: string[];
  status: "previewed" | "imported" | "failed";
  recordsParsed: number;
  recordsImported: number;
  errors: string[];
  createdAt: IsoDateTime;
};

export type ImportedHealthRecordSourceType =
  | "steps"
  | "sleep"
  | "heart_rate"
  | "workout"
  | "blood_pressure"
  | "unknown";

export type ImportedHealthRecord = {
  id: string;
  batchId: string;
  sourceType: ImportedHealthRecordSourceType;
  startTime?: IsoDateTime;
  endTime?: IsoDateTime;
  value?: number;
  unit?: string;
  raw: unknown;
};
