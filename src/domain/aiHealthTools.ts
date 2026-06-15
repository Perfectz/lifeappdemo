import type {
  AIHealthToolName,
  AIToolProposal,
  BiometricReading,
  FoodEntry,
  Goal,
  IsoDateTime,
  Workout
} from "@/domain/types";
import { createBiometricReading, type BiometricReadingInput } from "@/domain/biometrics";
import { createFoodEntry, type FoodEntryInput } from "@/domain/nutrition";
import { createGoal, type GoalInput } from "@/domain/goals";
import { createWorkout, type WorkoutInput } from "@/domain/workouts";

export const aiHealthToolNames: AIHealthToolName[] = [
  "set_goal",
  "log_workout",
  "log_food",
  "log_biometric"
];

export function isHealthToolName(value: unknown): value is AIHealthToolName {
  return typeof value === "string" && aiHealthToolNames.includes(value as AIHealthToolName);
}

/** Collections the health tools read from and write to. */
export type HealthToolState = {
  goals: Goal[];
  workouts: Workout[];
  foodEntries: FoodEntry[];
  biometricReadings: BiometricReading[];
};

export type HealthToolApplyResult =
  | (HealthToolState & { ok: true; appliedChangeSummary: string })
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Apply a confirmed health-tool proposal to the supplied state, returning new
 * collections. The model only ever *proposes* these; nothing mutates until the
 * user confirms (same gate as the task tools).
 */
export function applyAIHealthToolProposal(
  proposal: AIToolProposal,
  state: HealthToolState,
  now: IsoDateTime = new Date().toISOString()
): HealthToolApplyResult {
  if (!isHealthToolName(proposal.toolName)) {
    return { ok: false, message: "Tool name is not a supported health tool." };
  }

  try {
    if (proposal.toolName === "set_goal") {
      if (!isRecord(proposal.payload)) {
        return { ok: false, message: "Goal payload is invalid." };
      }
      const goal = createGoal(proposal.payload as unknown as GoalInput, now);
      return {
        ok: true,
        ...state,
        goals: [goal, ...state.goals],
        appliedChangeSummary: `Set ${goal.pillar} goal: ${goal.title}`
      };
    }

    if (proposal.toolName === "log_workout") {
      if (!isRecord(proposal.payload)) {
        return { ok: false, message: "Workout payload is invalid." };
      }
      const workout = createWorkout(proposal.payload as unknown as WorkoutInput, now);
      return {
        ok: true,
        ...state,
        workouts: [workout, ...state.workouts],
        appliedChangeSummary: `Logged ${workout.type.replace("_", " ")} workout: ${workout.date}`
      };
    }

    if (proposal.toolName === "log_food") {
      if (!isRecord(proposal.payload)) {
        return { ok: false, message: "Food payload is invalid." };
      }
      const entry = createFoodEntry(proposal.payload as unknown as FoodEntryInput, now);
      return {
        ok: true,
        ...state,
        foodEntries: [entry, ...state.foodEntries],
        appliedChangeSummary: `Logged ${entry.mealType}: ${entry.description}`
      };
    }

    if (proposal.toolName === "log_biometric") {
      if (!isRecord(proposal.payload)) {
        return { ok: false, message: "Biometric payload is invalid." };
      }
      const reading = createBiometricReading(
        proposal.payload as unknown as BiometricReadingInput,
        now
      );
      return {
        ok: true,
        ...state,
        biometricReadings: [reading, ...state.biometricReadings],
        appliedChangeSummary: `Logged ${reading.kind.replace("_", " ")} reading`
      };
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Health tool proposal failed."
    };
  }

  return { ok: false, message: "Tool name is not a supported health tool." };
}
