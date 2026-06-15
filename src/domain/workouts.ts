import type {
  Equipment,
  IsoDate,
  IsoDateTime,
  StrengthSet,
  Workout,
  WorkoutSource,
  WorkoutType
} from "@/domain/types";

export const workoutTypes: WorkoutType[] = ["martial_arts", "strength", "cardio"];
export const workoutSources: WorkoutSource[] = ["manual", "ai", "health_connect", "demo"];
export const equipmentOptions: Equipment[] = [
  "bodyweight",
  "adjustable_dumbbells",
  "kettlebell",
  "adjustable_bench"
];

/**
 * The user's actual home setup: an adjustable bench, two adjustable dumbbells
 * (up to 25 lb each) and a 25 lb kettlebell. Used to constrain the workout
 * generator so it never programs equipment that isn't on hand.
 */
export const homeStrengthInventory = {
  adjustableBench: true,
  dumbbellPairMaxLbs: 25,
  kettlebellLbs: 25
} as const;

/** Starter exercise library limited to the home inventory above. */
export const homeStrengthExercises: { name: string; equipment: Equipment[] }[] = [
  { name: "Dumbbell bench press", equipment: ["adjustable_dumbbells", "adjustable_bench"] },
  { name: "Dumbbell incline press", equipment: ["adjustable_dumbbells", "adjustable_bench"] },
  { name: "One-arm dumbbell row", equipment: ["adjustable_dumbbells", "adjustable_bench"] },
  { name: "Dumbbell Romanian deadlift", equipment: ["adjustable_dumbbells"] },
  { name: "Goblet squat", equipment: ["kettlebell"] },
  { name: "Kettlebell swing", equipment: ["kettlebell"] },
  { name: "Kettlebell snatch", equipment: ["kettlebell"] },
  { name: "Turkish get-up", equipment: ["kettlebell"] },
  { name: "Bulgarian split squat", equipment: ["adjustable_dumbbells", "adjustable_bench"] },
  { name: "Dumbbell shoulder press", equipment: ["adjustable_dumbbells"] },
  { name: "Push-up", equipment: ["bodyweight"] },
  { name: "Bench dip", equipment: ["adjustable_bench", "bodyweight"] }
];

export type StrengthSetInput = {
  exercise: string;
  reps?: number;
  weightLbs?: number;
  tempo?: string;
  rpe?: number;
  durationSeconds?: number;
};

export type WorkoutInput = {
  date: IsoDate;
  type: WorkoutType;
  title?: string;
  durationMinutes?: number;
  intensityRpe?: number;
  caloriesBurned?: number;
  notes?: string;
  source?: WorkoutSource;
  equipment?: Equipment[];
  sets?: StrengthSetInput[];
  techniques?: string[];
  rounds?: number;
  distanceMiles?: number;
  avgHeartRate?: number;
};

export type WorkoutValidationResult =
  | { ok: true; value: Required<Pick<WorkoutInput, "date" | "type" | "source">> & WorkoutInput }
  | { ok: false; message: string };

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionalFiniteNumber(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clampRpe(value: number | undefined): number | undefined {
  const num = optionalFiniteNumber(value);
  if (num === undefined) {
    return undefined;
  }
  return Math.max(1, Math.min(10, num));
}

function normalizeSets(sets: StrengthSetInput[] | undefined): StrengthSet[] | undefined {
  if (!Array.isArray(sets)) {
    return undefined;
  }

  const cleaned = sets
    .map((set): StrengthSet | undefined => {
      const exercise = set.exercise?.trim();
      if (!exercise) {
        return undefined;
      }
      return {
        exercise,
        reps: optionalFiniteNumber(set.reps),
        weightLbs: optionalFiniteNumber(set.weightLbs),
        tempo: normalizeOptionalText(set.tempo),
        rpe: clampRpe(set.rpe),
        durationSeconds: optionalFiniteNumber(set.durationSeconds)
      };
    })
    .filter((set): set is StrengthSet => set !== undefined);

  return cleaned.length > 0 ? cleaned : undefined;
}

function normalizeStringList(value: string[] | undefined): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const cleaned = value.map((item) => item?.trim()).filter((item): item is string => Boolean(item));
  return cleaned.length > 0 ? cleaned : undefined;
}

function normalizeEquipment(value: Equipment[] | undefined): Equipment[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const cleaned = value.filter((item): item is Equipment => equipmentOptions.includes(item));
  return cleaned.length > 0 ? cleaned : undefined;
}

export function validateWorkoutInput(input: WorkoutInput): WorkoutValidationResult {
  const date = input.date?.trim();

  if (!date) {
    return { ok: false, message: "Workout date is required." };
  }

  if (!workoutTypes.includes(input.type)) {
    return { ok: false, message: "Workout type is invalid." };
  }

  const source = input.source && workoutSources.includes(input.source) ? input.source : "manual";

  return {
    ok: true,
    value: {
      date,
      type: input.type,
      source,
      title: normalizeOptionalText(input.title),
      durationMinutes: optionalFiniteNumber(input.durationMinutes),
      intensityRpe: clampRpe(input.intensityRpe),
      caloriesBurned: optionalFiniteNumber(input.caloriesBurned),
      notes: normalizeOptionalText(input.notes),
      equipment: normalizeEquipment(input.equipment),
      sets: normalizeSets(input.sets),
      techniques: normalizeStringList(input.techniques),
      rounds: optionalFiniteNumber(input.rounds),
      distanceMiles: optionalFiniteNumber(input.distanceMiles),
      avgHeartRate: optionalFiniteNumber(input.avgHeartRate)
    }
  };
}

export function createWorkout(
  input: WorkoutInput,
  now: IsoDateTime = new Date().toISOString()
): Workout {
  const validation = validateWorkoutInput(input);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const { value } = validation;

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `workout-${now}`,
    date: value.date,
    type: value.type,
    title: value.title,
    durationMinutes: value.durationMinutes,
    intensityRpe: value.intensityRpe,
    caloriesBurned: value.caloriesBurned,
    notes: value.notes,
    source: value.source,
    equipment: value.equipment,
    sets: value.sets,
    techniques: value.techniques,
    rounds: value.rounds,
    distanceMiles: value.distanceMiles,
    avgHeartRate: value.avgHeartRate,
    recordedAt: now,
    createdAt: now,
    updatedAt: now
  };
}

export function isWorkout(value: unknown): value is Workout {
  if (!value || typeof value !== "object") {
    return false;
  }

  const workout = value as Partial<Workout>;

  return (
    typeof workout.id === "string" &&
    typeof workout.date === "string" &&
    workout.type !== undefined &&
    workoutTypes.includes(workout.type) &&
    workout.source !== undefined &&
    workoutSources.includes(workout.source) &&
    typeof workout.recordedAt === "string" &&
    typeof workout.createdAt === "string" &&
    typeof workout.updatedAt === "string"
  );
}
