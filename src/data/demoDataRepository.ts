import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalDailyReportRepository } from "@/data/dailyReportRepository";
import { createLocalEveningPostmortemRepository } from "@/data/eveningPostmortemRepository";
import { createLocalJournalRepository } from "@/data/journalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import type { DemoDataSet } from "@/domain";
import { demoModeChangedEventName, demoModeStorageKey } from "@/domain/demoData";

export function loadLocalDemoDataSet(storage: Storage): DemoDataSet {
  return {
    dailyPlans: createLocalDailyPlanRepository(storage).load(),
    dailyReports: createLocalDailyReportRepository(storage).load(),
    eveningPostmortems: createLocalEveningPostmortemRepository(storage).load(),
    journalEntries: createLocalJournalRepository(storage).load(),
    metricEntries: createLocalMetricRepository(storage).load(),
    tasks: createLocalTaskRepository(storage).load()
  };
}

export function saveLocalDemoDataSet(storage: Storage, data: DemoDataSet) {
  createLocalDailyPlanRepository(storage).save(data.dailyPlans);
  createLocalDailyReportRepository(storage).save(data.dailyReports);
  createLocalEveningPostmortemRepository(storage).save(data.eveningPostmortems);
  createLocalJournalRepository(storage).save(data.journalEntries);
  createLocalMetricRepository(storage).save(data.metricEntries);
  createLocalTaskRepository(storage).save(data.tasks);
}

export function setDemoModeEnabled(storage: Storage, enabled: boolean) {
  if (enabled) {
    storage.setItem(demoModeStorageKey, "enabled");
  } else {
    storage.removeItem(demoModeStorageKey);
  }

  window.dispatchEvent(new Event(demoModeChangedEventName));
}

export function isDemoModeEnabled(storage: Storage): boolean {
  return storage.getItem(demoModeStorageKey) === "enabled";
}
