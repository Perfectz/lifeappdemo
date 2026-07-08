"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { playDing } from "@/client/sfx";
import { SectionHeader } from "@/components/SectionHeader";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalWaterRepository, waterStorageKey } from "@/data/waterRepository";
import {
  addWater,
  DEFAULT_WATER_GOAL_OZ,
  getWaterForDate,
  undoLastWater,
  waterProgressPercent,
  type WaterEntry
} from "@/domain/waterTracking";
import type { IsoDate } from "@/domain/types";

type WaterTrackerProps = {
  date: IsoDate;
};

/**
 * Compact daily water card. Self-loading: it owns its repository reads and
 * stays live via the shared data-changed event (the repository dispatches
 * it on every save, so other cards — and other instances — refresh too).
 */
export function WaterTracker({ date }: WaterTrackerProps) {
  const [entries, setEntries] = useState<WaterEntry[]>([]);

  const reload = useCallback(() => {
    setEntries(createLocalWaterRepository(window.localStorage).load());
  }, []);

  useEffect(() => {
    reload();
    const onDataChanged = (event: Event) => {
      // Only reload for water writes (or untyped events) to avoid churn
      // every time an unrelated repository saves.
      const detail = (event as CustomEvent<{ storageKey?: string }>).detail;
      if (!detail?.storageKey || detail.storageKey === waterStorageKey) {
        reload();
      }
    };
    window.addEventListener(dataChangedEventName, onDataChanged);
    return () => window.removeEventListener(dataChangedEventName, onDataChanged);
  }, [reload]);

  const dayOz = useMemo(() => getWaterForDate(entries, date), [entries, date]);
  const percent = waterProgressPercent(dayOz);
  const hasPourToday = entries.some((entry) => entry.date === date);

  function logWater(oz: number) {
    const repo = createLocalWaterRepository(window.localStorage);
    repo.save(addWater(repo.load(), date, oz));
    setEntries(repo.load());
    playDing();
  }

  function undoLast() {
    const repo = createLocalWaterRepository(window.localStorage);
    repo.save(undoLastWater(repo.load(), date));
    setEntries(repo.load());
  }

  return (
    <section className="dashboard-section water-tracker" aria-label="Water tracker">
      <div className="nutri-meal-head">
        <SectionHeader eyebrow="Hydration" title="Water" />
        <span className="water-count">
          <strong>{Math.round(dayOz)}</strong> / {DEFAULT_WATER_GOAL_OZ} fl oz
        </span>
      </div>
      <div
        className="progress-meter water-meter"
        role="progressbar"
        aria-label="Water progress"
        aria-valuemin={0}
        aria-valuemax={DEFAULT_WATER_GOAL_OZ}
        aria-valuenow={Math.round(dayOz)}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="water-actions">
        <button type="button" className="nutri-mini-btn water-add-btn" onClick={() => logWater(8)}>
          +8 oz
        </button>
        <button type="button" className="nutri-mini-btn water-add-btn" onClick={() => logWater(16)}>
          +16 oz
        </button>
        <button
          type="button"
          className="nutri-mini-btn"
          onClick={undoLast}
          disabled={!hasPourToday}
          aria-label="Undo last water entry"
        >
          Undo
        </button>
      </div>
    </section>
  );
}
