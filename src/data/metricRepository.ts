import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import type { MetricEntry } from "@/domain";
import { isMetricEntry } from "@/domain/metrics";

const storageKey = "lifequest.metricEntries.v1";

export type MetricRepository = LocalRepository<MetricEntry>;

export function createLocalMetricRepository(storage: Storage): MetricRepository {
  return createLocalRepository<MetricEntry>(storage, storageKey, isMetricEntry);
}

export const metricStorageKey = storageKey;
