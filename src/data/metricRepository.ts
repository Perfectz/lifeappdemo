import type { MetricEntry } from "@/domain";
import { isMetricEntry } from "@/domain/metrics";

const storageKey = "lifequest.metricEntries.v1";

export type MetricRepository = {
  load(): MetricEntry[];
  save(entries: MetricEntry[]): void;
};

export function createLocalMetricRepository(storage: Storage): MetricRepository {
  return {
    load() {
      const raw = storage.getItem(storageKey);

      if (!raw) {
        return [];
      }

      try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isMetricEntry) : [];
      } catch {
        return [];
      }
    },
    save(entries) {
      storage.setItem(storageKey, JSON.stringify(entries));
    }
  };
}

export const metricStorageKey = storageKey;
