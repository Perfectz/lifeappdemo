"use client";

import { useEffect, useMemo, useState } from "react";

import {
  isDemoModeEnabled,
  loadLocalDemoDataSet,
  saveLocalDemoDataSet,
  setDemoModeEnabled
} from "@/data/demoDataRepository";
import type { DemoDataCounts, DemoDataSet } from "@/domain";
import { countDemoData, hasDemoData, removeDemoData, seedDemoData } from "@/domain/demoData";
import { toLocalIsoDate } from "@/domain/dates";

function totalCount(counts: DemoDataCounts): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

function countSummary(counts: DemoDataCounts): string {
  return [
    `${counts.tasks} quests`,
    `${counts.metricEntries} metrics`,
    `${counts.journalEntries} journal entries`,
    `${counts.dailyReports} reports`
  ].join(", ");
}

export function DemoModePanel() {
  const [data, setData] = useState<DemoDataSet | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const demoCounts = useMemo(() => (data ? countDemoData(data) : null), [data]);
  const demoRecordCount = demoCounts ? totalCount(demoCounts) : 0;

  function refresh() {
    const nextData = loadLocalDemoDataSet(window.localStorage);
    setData(nextData);
    setEnabled(isDemoModeEnabled(window.localStorage) || hasDemoData(nextData));
  }

  useEffect(() => {
    refresh();
  }, []);

  function enableDemoMode() {
    const currentData = loadLocalDemoDataSet(window.localStorage);
    const nextData = seedDemoData(currentData, toLocalIsoDate());

    saveLocalDemoDataSet(window.localStorage, nextData);
    setDemoModeEnabled(window.localStorage, true);
    setData(nextData);
    setEnabled(true);
    setMessage("Demo mode enabled with fake portfolio data.");
  }

  function resetDemoMode() {
    const currentData = loadLocalDemoDataSet(window.localStorage);
    const result = removeDemoData(currentData);

    saveLocalDemoDataSet(window.localStorage, result.data);
    setDemoModeEnabled(window.localStorage, false);
    setData(result.data);
    setEnabled(false);
    setMessage(`Demo data reset. Removed ${totalCount(result.removed)} demo record(s); real data was preserved.`);
  }

  return (
    <section className="demo-mode-panel" aria-label="Demo mode controls">
      {enabled ? <span className="demo-data-badge">Demo Data</span> : null}
      <p>
        Seed screenshot-ready fake quests, metrics, journal entries, and reports. Demo
        records use demo sources where the data model supports it and removable ID
        prefixes everywhere else.
      </p>
      <dl className="demo-mode-stats">
        <div>
          <dt>Status</dt>
          <dd>{enabled ? "Demo mode active" : "Demo mode off"}</dd>
        </div>
        <div>
          <dt>Demo records</dt>
          <dd>{demoCounts ? countSummary(demoCounts) : "Loading..."}</dd>
        </div>
      </dl>
      {message ? (
        <p className="standup-success" role="status">
          {message}
        </p>
      ) : null}
      <div className="standup-actions">
        <button onClick={enableDemoMode} type="button">
          Enable Demo Mode
        </button>
        <button disabled={demoRecordCount === 0} onClick={resetDemoMode} type="button">
          Reset Demo Data
        </button>
      </div>
    </section>
  );
}
