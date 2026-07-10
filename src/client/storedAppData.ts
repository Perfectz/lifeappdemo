import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalDailyReportRepository } from "@/data/dailyReportRepository";
import { createLocalJournalRepository } from "@/data/journalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { loadNutritionGoals } from "@/data/nutritionGoalsRepository";
import { loadHealthGoals } from "@/data/healthGoalsRepository";
import { createLocalGoalRepository } from "@/data/goalRepository";
import { createLocalNoteRepository } from "@/data/noteRepository";
import { loadTrainingProfile } from "@/data/trainingProfileRepository";
import type { AIStoredAppData } from "@/domain";

export function loadStoredAppData(storage: Storage): AIStoredAppData {
  return {
    tasks: createLocalTaskRepository(storage).load(),
    dailyPlans: createLocalDailyPlanRepository(storage).load(),
    metricEntries: createLocalMetricRepository(storage).load(),
    journalEntries: createLocalJournalRepository(storage).load(),
    dailyReports: createLocalDailyReportRepository(storage).load(),
    workouts: createLocalWorkoutRepository(storage).load(),
    foodEntries: createLocalFoodEntryRepository(storage).load(),
    nutritionGoals: loadNutritionGoals(storage),
    healthGoals: loadHealthGoals(storage),
    goals: createLocalGoalRepository(storage).load(),
    notes: createLocalNoteRepository(storage).load(),
    trainingProfile: loadTrainingProfile(storage)
  };
}
