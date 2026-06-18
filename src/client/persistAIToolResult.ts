import type { ConfirmToolResponse } from "@/client/aiApiClient";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalDailyReportRepository } from "@/data/dailyReportRepository";
import { createLocalJournalRepository } from "@/data/journalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";

/**
 * Persists every entity array present on a confirmed AI tool result.
 * Centralized so the AI surfaces (coach, morning) can't drift and
 * silently drop an entity type on save-back.
 */
export function persistAIToolResult(storage: Storage, payload: ConfirmToolResponse): void {
  if (payload.tasks) {
    createLocalTaskRepository(storage).save(payload.tasks);
  }
  if (payload.dailyPlans) {
    createLocalDailyPlanRepository(storage).save(payload.dailyPlans);
  }
  if (payload.dailyReports) {
    createLocalDailyReportRepository(storage).save(payload.dailyReports);
  }
  if (payload.metricEntries) {
    createLocalMetricRepository(storage).save(payload.metricEntries);
  }
  if (payload.journalEntries) {
    createLocalJournalRepository(storage).save(payload.journalEntries);
  }
}
