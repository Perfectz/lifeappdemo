"use client";

import { useEffect, useState } from "react";

import { CharacterSprite } from "@/components/CharacterSprite";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import { toLocalIsoDate } from "@/domain/dates";
import {
  getCompletionTrend,
  getInsightHighlights,
  getMetricTrend,
  getTagBreakdown,
  getWeekProgress,
  type CompletionTrend,
  type MetricTrend,
  type TagStat,
  type WeekProgress
} from "@/domain/insights";

type TrendsState = {
  completion: CompletionTrend;
  metrics: MetricTrend;
  tags: TagStat[];
  week: WeekProgress;
  highlights: string[];
};

function computeTrends(): TrendsState {
  const storage = window.localStorage;
  const tasks = createLocalTaskRepository(storage).load();
  const metrics = createLocalMetricRepository(storage).load();
  const today = toLocalIsoDate();
  return {
    completion: getCompletionTrend(tasks, today, 14),
    metrics: getMetricTrend(metrics, today, 14),
    tags: getTagBreakdown(tasks),
    week: getWeekProgress(tasks, today, 10),
    highlights: getInsightHighlights(tasks, metrics, today)
  };
}

export function TrendsView() {
  const [state, setState] = useState<TrendsState | null>(null);

  useEffect(() => {
    function refresh() {
      setState(computeTrends());
    }
    refresh();
    window.addEventListener(dataChangedEventName, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(dataChangedEventName, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <section className="metrics-page trends-page" aria-labelledby="trends-title">
      <div className="metrics-hero">
        <div>
          <p className="eyebrow">Insight</p>
          <h1 id="trends-title">Trends</h1>
          <p>Patterns from your real quests and check-ins over the last two weeks.</p>
        </div>
        <div className="page-sprite-frame metrics-sprite" aria-hidden="true">
          <CharacterSprite className="page-sprite" pose="thinking" />
        </div>
      </div>

      {!state ? (
        <p className="quest-empty">Loading insights…</p>
      ) : (
        <div className="trends-layout">
          <section className="dashboard-section" aria-label="This week">
            <div className="section-header">
              <p className="eyebrow">This Week</p>
              <h2>Weekly Quest Goal</h2>
            </div>
            <div className="trends-week">
              <div className="trends-week-head">
                <strong>
                  {state.week.completed}/{state.week.goal}
                </strong>
                <span>{state.week.daysActive} active day{state.week.daysActive === 1 ? "" : "s"}</span>
              </div>
              <span className="stat-bar stat-bar-xp trends-week-bar" aria-hidden="true">
                <span style={{ width: `${Math.max(2, state.week.pct)}%` }} />
              </span>
            </div>
          </section>

          <section className="dashboard-section" aria-label="Quests cleared">
            <div className="section-header">
              <p className="eyebrow">14 Days</p>
              <h2>Quests Cleared</h2>
            </div>
            <Chart
              points={state.completion.points.map((p) => ({ label: p.label, value: p.value }))}
              max={Math.max(1, state.completion.best)}
              emptyLabel="No quests cleared yet."
              tone="success"
            />
            <p className="trends-caption">
              {state.completion.total} cleared · best day {state.completion.best}
            </p>
          </section>

          <section className="dashboard-section" aria-label="Energy and mood">
            <div className="section-header">
              <p className="eyebrow">14 Days</p>
              <h2>Energy &amp; Mood</h2>
            </div>
            <Chart
              points={state.metrics.points.map((p) => ({
                label: p.label,
                value: p.energy ?? 0
              }))}
              max={5}
              emptyLabel="No check-ins logged yet."
              tone="blue"
            />
            <p className="trends-caption">
              Energy avg {state.metrics.avgEnergy?.toFixed(1) ?? "—"} · Mood avg{" "}
              {state.metrics.avgMood?.toFixed(1) ?? "—"}
            </p>
          </section>

          <section className="dashboard-section" aria-label="Quests by tag">
            <div className="section-header">
              <p className="eyebrow">Focus</p>
              <h2>Quests by Tag</h2>
            </div>
            {state.tags.length === 0 ? (
              <p className="quest-empty">Tag your quests to see where your effort goes.</p>
            ) : (
              <ul className="trends-tags">
                {state.tags.map((tag) => {
                  const total = tag.completed + tag.open;
                  const pct = total > 0 ? Math.round((tag.completed / total) * 100) : 0;
                  return (
                    <li key={tag.tag} className="trends-tag-row">
                      <span className="trends-tag-name">{tag.tag}</span>
                      <span className="stat-bar stat-bar-hp trends-tag-bar" aria-hidden="true">
                        <span style={{ width: `${Math.max(2, pct)}%` }} />
                      </span>
                      <span className="trends-tag-count">
                        {tag.completed}/{total}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="dashboard-section trends-highlights" aria-label="Highlights">
            <div className="section-header">
              <p className="eyebrow">Read-out</p>
              <h2>What the Data Says</h2>
            </div>
            <ul className="trends-highlight-list">
              {state.highlights.map((highlight) => (
                <li key={highlight}>
                  <span aria-hidden="true">▸</span>
                  {highlight}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}

function Chart({
  points,
  max,
  emptyLabel,
  tone
}: {
  points: { label: string; value: number }[];
  max: number;
  emptyLabel: string;
  tone: "success" | "blue";
}) {
  const hasData = points.some((p) => p.value > 0);
  if (!hasData) {
    return <p className="quest-empty">{emptyLabel}</p>;
  }
  return (
    <div className={`trends-chart trends-chart-${tone}`} role="img" aria-label="Bar chart">
      {points.map((point, index) => {
        const heightPct = max > 0 ? Math.round((point.value / max) * 100) : 0;
        return (
          <div className="trends-chart-col" key={`${point.label}-${index}`}>
            <span className="trends-chart-bar" style={{ height: `${Math.max(3, heightPct)}%` }}>
              {point.value > 0 ? (
                <span className="trends-chart-value">{point.value}</span>
              ) : null}
            </span>
            <span className="trends-chart-label">{point.label[0]}</span>
          </div>
        );
      })}
    </div>
  );
}
