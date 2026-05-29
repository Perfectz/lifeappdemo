import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import type { DailyReport } from "@/domain";
import { isDailyReport } from "@/domain/reports";

const storageKey = "lifequest.dailyReports.v1";

export type DailyReportRepository = LocalRepository<DailyReport>;

export function createLocalDailyReportRepository(storage: Storage): DailyReportRepository {
  return createLocalRepository<DailyReport>(storage, storageKey, isDailyReport);
}

export const dailyReportStorageKey = storageKey;
