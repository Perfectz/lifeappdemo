import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import type { IsoDate, IsoDateTime } from "@/domain/types";

/**
 * A daily snapshot of the adaptive-TDEE estimate, so the UI can show the trend
 * ("your expenditure estimate changed") and the number feels transparent.
 */
export type ExpenditureEstimate = {
  date: IsoDate;
  tdeeEstimate: number;
  confidence: number;
  trendWeightLb: number | null;
  createdAt: IsoDateTime;
};

const storageKey = "lifequest.expenditureEstimates.v1";

function isExpenditureEstimate(value: unknown): value is ExpenditureEstimate {
  if (!value || typeof value !== "object") return false;
  const e = value as Partial<ExpenditureEstimate>;
  return (
    typeof e.date === "string" &&
    typeof e.tdeeEstimate === "number" &&
    typeof e.confidence === "number" &&
    typeof e.createdAt === "string" &&
    (e.trendWeightLb === null || typeof e.trendWeightLb === "number")
  );
}

export type ExpenditureEstimateRepository = LocalRepository<ExpenditureEstimate>;

export function createExpenditureEstimateRepository(
  storage: Storage
): ExpenditureEstimateRepository {
  return createLocalRepository<ExpenditureEstimate>(storage, storageKey, isExpenditureEstimate);
}

export const expenditureEstimateStorageKey = storageKey;

export function getExpenditureEstimateForDate(
  storage: Storage,
  date: IsoDate
): ExpenditureEstimate | undefined {
  return createExpenditureEstimateRepository(storage)
    .load()
    .find((e) => e.date === date);
}

/** Insert or replace today's snapshot, keeping ~180 days of history. */
export function upsertExpenditureEstimate(storage: Storage, estimate: ExpenditureEstimate): void {
  const repo = createExpenditureEstimateRepository(storage);
  const others = repo.load().filter((e) => e.date !== estimate.date);
  const next = [...others, estimate].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 180);
  repo.save(next);
}
