import type { ConfirmToolResponse } from "@/client/aiApiClient";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalDailyReportRepository } from "@/data/dailyReportRepository";
import { createLocalEveningPostmortemRepository } from "@/data/eveningPostmortemRepository";
import { createLocalJournalRepository } from "@/data/journalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";

/**
 * Persists every entity array present on a confirmed AI tool result.
 * Centralized so the three AI surfaces (coach, morning, evening) can't
 * drift and silently drop an entity type on save-back — which is
 * exactly the class of bug that previously lost evening postmortems.
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
  if (payload.eveningPostmortems) {
    createLocalEveningPostmortemRepository(storage).save(payload.eveningPostmortems);
  }
  if (payload.metricEntries) {
    createLocalMetricRepository(storage).save(payload.metricEntries);
  }
  if (payload.journalEntries) {
    createLocalJournalRepository(storage).save(payload.journalEntries);
  }
}
