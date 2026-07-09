"use client";

import { useCallback, useEffect, useState } from "react";

import { SectionHeader } from "@/components/SectionHeader";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { getTargetForDate } from "@/data/dailyNutritionTargetRepository";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import { createLocalWaterRepository } from "@/data/waterRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import { toLocalIsoDate } from "@/domain/dates";
import {
  buildHealthQuestSuggestions,
  type HealthQuestSuggestion
} from "@/domain/healthQuestSuggestions";
import { createTask } from "@/domain/tasks";
import { getWaterForDate } from "@/domain/waterTracking";

/**
 * "Coach suggests" panel for the Quest Log: today's health gaps (vitals,
 * training sessions, protein, water, daily plan) rendered as one-tap
 * acceptable quests. Self-loading like TodayTrainingCard — reads the local
 * repositories directly and refreshes on any data change. Accepting writes
 * through the task repository so the change event fires and the row
 * disappears via the suggestion dedupe. Renders nothing when all clear.
 */
export function CoachQuestSuggestions() {
  const [suggestions, setSuggestions] = useState<HealthQuestSuggestion[]>([]);

  const reload = useCallback(() => {
    const storage = window.localStorage;
    const now = new Date();
    const today = toLocalIsoDate(now);
    setSuggestions(
      buildHealthQuestSuggestions({
        today,
        nowMinutes: now.getHours() * 60 + now.getMinutes(),
        metrics: createLocalMetricRepository(storage).load(),
        workouts: createLocalWorkoutRepository(storage).load(),
        foodEntries: createLocalFoodEntryRepository(storage).load(),
        target: getTargetForDate(storage, today),
        waterOz: getWaterForDate(createLocalWaterRepository(storage).load(), today),
        openTasks: createLocalTaskRepository(storage)
          .load()
          .filter((task) => task.status === "todo"),
        dailyPlans: createLocalDailyPlanRepository(storage).load()
      })
    );
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  const accept = useCallback(
    (toAccept: HealthQuestSuggestion[]) => {
      if (toAccept.length === 0) {
        return;
      }
      const repository = createLocalTaskRepository(window.localStorage);
      const today = toLocalIsoDate();
      const created = toAccept.map((suggestion) =>
        createTask({
          title: suggestion.title,
          description: suggestion.reason,
          priority: suggestion.priority,
          tags: [suggestion.tag],
          plannedForDate: today
        })
      );
      // One save for the whole batch — fires the data-changed event, which
      // reloads this panel (dedupe hides the accepted rows) and any other
      // live component.
      repository.save([...created, ...repository.load()]);
      reload();
    },
    [reload]
  );

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section className="quest-log-page quest-log-summary" aria-label="Coach suggests">
      <div className="dashboard-section">
        <SectionHeader eyebrow="Coach" title="Coach suggests" />
        <div className="quest-groups">
          <ul className="quest-list">
            {suggestions.map((suggestion) => (
              <li key={suggestion.key} className="quest-card">
                <div className="quest-card-heading">
                  <h3>{suggestion.title}</h3>
                  <div className="quest-actions">
                    <button
                      type="button"
                      className="quest-action-primary"
                      onClick={() => accept([suggestion])}
                    >
                      Accept
                    </button>
                  </div>
                </div>
                <p>{suggestion.reason}</p>
              </li>
            ))}
          </ul>
          {suggestions.length >= 2 ? (
            <div className="quest-actions">
              <button type="button" onClick={() => accept(suggestions)}>
                Accept all
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
