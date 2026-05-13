import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalDailyReportRepository } from "@/data/dailyReportRepository";
import { createLocalJournalRepository } from "@/data/journalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import type { AIStoredAppData } from "@/domain";

export function loadStoredAppData(storage: Storage): AIStoredAppData {
  return {
    tasks: createLocalTaskRepository(storage).load(),
    dailyPlans: createLocalDailyPlanRepository(storage).load(),
    metricEntries: createLocalMetricRepository(storage).load(),
    journalEntries: createLocalJournalRepository(storage).load(),
    dailyReports: createLocalDailyReportRepository(storage).load()
  };
}
