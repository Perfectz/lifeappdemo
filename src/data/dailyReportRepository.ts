import type { DailyReport } from "@/domain";
import { isDailyReport } from "@/domain/reports";

const storageKey = "lifequest.dailyReports.v1";

export type DailyReportRepository = {
  load(): DailyReport[];
  save(reports: DailyReport[]): void;
};

export function createLocalDailyReportRepository(storage: Storage): DailyReportRepository {
  return {
    load() {
      const raw = storage.getItem(storageKey);

      if (!raw) {
        return [];
      }

      try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isDailyReport) : [];
      } catch {
        return [];
      }
    },
    save(reports) {
      storage.setItem(storageKey, JSON.stringify(reports));
    }
  };
}

export const dailyReportStorageKey = storageKey;
