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
  bloodGlucoseMgDl?: number;
  glucoseContext?: GlucoseContext;
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

export type Note = TimestampedEntity & {
  title: string;
  content: string;
  tags: string[];
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
  /** Derived behavioral patterns so the coach can reference real history. */
  insightHighlights: string[];
  /** Today's nutrition summary (calorie budget, macros, logged foods). */
  todaysNutrition?: string;
  /** Today's training status + recent workouts. */
  todaysTraining?: string;
  /** Derived health status from latest vitals (BP category, glucose band, weight). */
  healthStatus?: string;
  /** The user's health targets (BP, glucose, weight, sleep). */
  goalsSummary?: string;
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
  | "generate_daily_report"
  | "save_memory";

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

/* ----------------------------------------------------------------------------
 * Goals (the three pillars + OKR-style hierarchy)
 * ------------------------------------------------------------------------- */

export type GoalPillar = "fitness" | "personal" | "professional";
export type GoalHorizon = "vision" | "yearly" | "quarterly" | "weekly";
export type GoalStatus = "active" | "achieved" | "paused" | "dropped";

export type Goal = TimestampedEntity & {
  pillar: GoalPillar;
  horizon: GoalHorizon;
  title: string;
  description?: string;
  /** Parent in the vision -> yearly -> quarterly -> weekly cascade. */
  parentGoalId?: EntityId;
  targetDate?: IsoDate;
  /** Optional measurable target, e.g. metricName "body_weight", targetValue 180. */
  metricName?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  status: GoalStatus;
};

/* ----------------------------------------------------------------------------
 * Workouts (martial arts / home strength / cardio)
 * ------------------------------------------------------------------------- */

export type WorkoutType = "martial_arts" | "strength" | "cardio";
export type WorkoutSource = "manual" | "ai" | "health_connect" | "demo";
export type Equipment =
  | "bodyweight"
  | "adjustable_dumbbells"
  | "kettlebell"
  | "adjustable_bench";

export type StrengthSet = {
  exercise: string;
  reps?: number;
  weightLbs?: number;
  /** e.g. "3-1-1" tempo so we can progress without adding load past 25 lb. */
  tempo?: string;
  /** Rate of perceived exertion, 1-10. */
  rpe?: number;
  durationSeconds?: number;
};

export type Workout = TimestampedEntity & {
  date: IsoDate;
  type: WorkoutType;
  title?: string;
  durationMinutes?: number;
  /** Overall session intensity, 1-10. */
  intensityRpe?: number;
  caloriesBurned?: number;
  notes?: string;
  source: WorkoutSource;
  // Strength-specific
  equipment?: Equipment[];
  sets?: StrengthSet[];
  // Martial-arts-specific
  techniques?: string[];
  rounds?: number;
  // Cardio-specific
  distanceMiles?: number;
  avgHeartRate?: number;
  /** Added load carried during cardio, e.g. a weight vest (lb). */
  weightVestLbs?: number;
  recordedAt: IsoDateTime;
};

/* ----------------------------------------------------------------------------
 * Nutrition (manual, photo-AI, or barcode)
 * ------------------------------------------------------------------------- */

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type NutritionEstimateSource = "manual" | "photo_ai" | "barcode" | "restaurant_db";
export type EstimateConfidence = "low" | "medium" | "high";

export type Macros = {
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
};

export type FoodEntry = TimestampedEntity & {
  date: IsoDate;
  mealType: MealType;
  description: string;
  macros: Macros;
  estimateSource: NutritionEstimateSource;
  confidence?: EstimateConfidence;
  /** Storage key / blob ref for an attached food photo. */
  photoRef?: string;
  recordedAt: IsoDateTime;
};

/* ----------------------------------------------------------------------------
 * Biometrics (multiple time-stamped readings per day; glucose, BP, etc.)
 * ------------------------------------------------------------------------- */

export type BiometricKind =
  | "blood_glucose"
  | "blood_pressure"
  | "resting_heart_rate"
  | "body_weight"
  | "spo2";
export type GlucoseContext = "fasting" | "pre_meal" | "post_meal" | "random" | "bedtime";
export type BiometricSource = "manual" | "device" | "health_connect" | "demo";

export type BiometricReading = TimestampedEntity & {
  kind: BiometricKind;
  recordedAt: IsoDateTime;
  // blood_glucose
  glucoseMgDl?: number;
  glucoseContext?: GlucoseContext;
  // blood_pressure
  systolic?: number;
  diastolic?: number;
  pulseBpm?: number;
  // generic (resting_heart_rate, body_weight, spo2)
  value?: number;
  unit?: string;
  source: BiometricSource;
  notes?: string;
};
