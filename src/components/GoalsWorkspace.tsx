"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { CharacterSprite } from "@/components/CharacterSprite";
import { SectionHeader } from "@/components/SectionHeader";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalGoalRepository } from "@/data/goalRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import {
  createGoal,
  effectiveGoalProgressFraction,
  goalHorizons,
  goalPillars,
  updateGoal,
  type GoalInput
} from "@/domain/goals";
import { createTask } from "@/domain/tasks";
import { toLocalIsoDate } from "@/domain/dates";
import type { Goal, GoalHorizon, GoalPillar, GoalStatus, Task } from "@/domain/types";

const horizonLabel: Record<GoalHorizon, string> = {
  vision: "Vision",
  yearly: "Yearly",
  quarterly: "Quarterly",
  weekly: "Weekly"
};

const pillarLabel: Record<GoalPillar, string> = {
  fitness: "Health & fitness",
  personal: "Personal",
  professional: "Professional"
};

const emptyGoal: GoalInput = {
  pillar: "fitness",
  horizon: "quarterly",
  title: "",
  description: "",
  parentGoalId: "",
  targetDate: "",
  metricName: "",
  unit: ""
};

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function GoalsWorkspace() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState<GoalInput>(emptyGoal);
  const [targetValue, setTargetValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [questDrafts, setQuestDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    const storage = window.localStorage;
    setGoals(createLocalGoalRepository(storage).load());
    setTasks(createLocalTaskRepository(storage).load());
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.status === "active"),
    [goals]
  );
  const inactiveGoals = useMemo(
    () => goals.filter((goal) => goal.status !== "active"),
    [goals]
  );
  const goalById = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);

  function persistGoals(next: Goal[]) {
    createLocalGoalRepository(window.localStorage).save(next);
  }

  function submitGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const goal = createGoal({
        ...input,
        targetValue: optionalNumber(targetValue),
        currentValue: optionalNumber(currentValue)
      });
      persistGoals([goal, ...goals]);
      setInput(emptyGoal);
      setTargetValue("");
      setCurrentValue("");
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save that goal.");
    }
  }

  function changeStatus(goal: Goal, status: GoalStatus) {
    persistGoals(goals.map((item) => (item.id === goal.id ? updateGoal(item, { status }) : item)));
  }

  function updateProgress(goal: Goal, value: string) {
    const parsed = optionalNumber(value);
    if (parsed === undefined) return;
    persistGoals(
      goals.map((item) =>
        item.id === goal.id ? updateGoal(item, { currentValue: parsed }) : item
      )
    );
  }

  function addNextQuest(goal: Goal) {
    const title = questDrafts[goal.id]?.trim();
    if (!title) return;
    const repository = createLocalTaskRepository(window.localStorage);
    repository.save([
      createTask({
        title,
        priority: "medium",
        tags: [goal.pillar === "fitness" ? "health" : goal.pillar === "professional" ? "work" : "admin"],
        plannedForDate: toLocalIsoDate(),
        linkedGoalId: goal.id
      }),
      ...repository.load()
    ]);
    setQuestDrafts((current) => ({ ...current, [goal.id]: "" }));
  }

  function renderGoal(goal: Goal) {
    const linked = tasks.filter((task) => task.linkedGoalId === goal.id && task.status !== "archived");
    const completed = linked.filter((task) => task.status === "done").length;
    const progress = effectiveGoalProgressFraction(goal, tasks);
    const parent = goal.parentGoalId ? goalById.get(goal.parentGoalId) : undefined;

    return (
      <article className="goal-card" key={goal.id}>
        <header className="goal-card-head">
          <div>
            <p className="eyebrow">
              {pillarLabel[goal.pillar]} · {horizonLabel[goal.horizon]}
            </p>
            <h3>{goal.title}</h3>
          </div>
          <span className={`goal-status goal-status-${goal.status}`}>{goal.status}</span>
        </header>
        {goal.description ? <p>{goal.description}</p> : null}
        {parent ? <p className="goal-parent">Supports: {parent.title}</p> : null}
        <div className="goal-progress-row">
          <div
            className="progress-meter"
            aria-label={`${goal.title} progress ${Math.round((progress ?? 0) * 100)}%`}
          >
            <span style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
          </div>
          <strong>{progress === undefined ? "No signal yet" : `${Math.round(progress * 100)}%`}</strong>
        </div>
        <p className="goal-meta">
          {goal.targetValue !== undefined
            ? `${goal.currentValue ?? 0} / ${goal.targetValue}${goal.unit ? ` ${goal.unit}` : ""}`
            : `${completed} of ${linked.length} linked quests cleared`}
          {goal.targetDate ? ` · target ${goal.targetDate}` : ""}
        </p>
        {goal.status === "active" ? (
          <>
            {goal.targetValue !== undefined ? (
              <label className="goal-inline-field">
                Update current value
                <input
                  type="number"
                  defaultValue={goal.currentValue ?? ""}
                  onBlur={(event) => updateProgress(goal, event.target.value)}
                />
              </label>
            ) : null}
            <div className="goal-next-quest">
              <input
                aria-label={`Next quest for ${goal.title}`}
                placeholder="Add the next concrete quest"
                value={questDrafts[goal.id] ?? ""}
                onChange={(event) =>
                  setQuestDrafts((current) => ({ ...current, [goal.id]: event.target.value }))
                }
              />
              <button type="button" onClick={() => addNextQuest(goal)}>
                Add for today
              </button>
            </div>
          </>
        ) : null}
        <div className="goal-actions">
          {goal.status === "active" ? (
            <>
              <button type="button" onClick={() => changeStatus(goal, "achieved")}>Achieved</button>
              <button type="button" onClick={() => changeStatus(goal, "paused")}>Pause</button>
            </>
          ) : (
            <button type="button" onClick={() => changeStatus(goal, "active")}>Reactivate</button>
          )}
          {goal.status !== "dropped" ? (
            <button type="button" className="quest-action-danger" onClick={() => changeStatus(goal, "dropped")}>Drop</button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <section className="goals-page" aria-labelledby="goals-title">
      <header className="dashboard-hero">
        <div>
          <p className="eyebrow">Direction</p>
          <h1 id="goals-title">Goals</h1>
          <p>Connect the future you want to the quests you can clear today.</p>
        </div>
        <div className="page-sprite-frame" aria-hidden="true">
          <CharacterSprite className="page-sprite" pose="thinking" />
        </div>
      </header>

      <section className="dashboard-section">
        <SectionHeader eyebrow="New objective" title="Set a goal" />
        <form className="goal-form" onSubmit={submitGoal}>
          <label>
            Goal
            <input
              placeholder="What are you trying to change?"
              value={input.title}
              onChange={(event) => setInput((current) => ({ ...current, title: event.target.value }))}
            />
          </label>
          <label>
            Pillar
            <select
              value={input.pillar}
              onChange={(event) => setInput((current) => ({ ...current, pillar: event.target.value as GoalPillar }))}
            >
              {goalPillars.map((pillar) => <option key={pillar} value={pillar}>{pillarLabel[pillar]}</option>)}
            </select>
          </label>
          <label>
            Horizon
            <select
              value={input.horizon}
              onChange={(event) => setInput((current) => ({ ...current, horizon: event.target.value as GoalHorizon }))}
            >
              {goalHorizons.map((horizon) => <option key={horizon} value={horizon}>{horizonLabel[horizon]}</option>)}
            </select>
          </label>
          <label>
            Parent goal
            <select
              value={input.parentGoalId ?? ""}
              onChange={(event) => setInput((current) => ({ ...current, parentGoalId: event.target.value }))}
            >
              <option value="">No parent</option>
              {activeGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
            </select>
          </label>
          <label className="goal-form-wide">
            Why it matters
            <textarea
              value={input.description ?? ""}
              onChange={(event) => setInput((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          <label>
            Target date
            <input type="date" value={input.targetDate ?? ""} onChange={(event) => setInput((current) => ({ ...current, targetDate: event.target.value }))} />
          </label>
          <label>
            Metric
            <input placeholder="e.g. body weight" value={input.metricName ?? ""} onChange={(event) => setInput((current) => ({ ...current, metricName: event.target.value }))} />
          </label>
          <label>
            Current
            <input type="number" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} />
          </label>
          <label>
            Target
            <input type="number" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} />
          </label>
          <label>
            Unit
            <input placeholder="lb, sessions, $, %" value={input.unit ?? ""} onChange={(event) => setInput((current) => ({ ...current, unit: event.target.value }))} />
          </label>
          {error ? <p className="form-error goal-form-wide" role="alert">{error}</p> : null}
          <button className="command-button goal-form-wide" type="submit"><span>Create goal</span></button>
        </form>
      </section>

      <section className="dashboard-section">
        <SectionHeader eyebrow="Active campaign" title="Goals in motion" />
        {activeGoals.length > 0 ? <div className="goal-grid">{activeGoals.map(renderGoal)}</div> : <p className="quest-empty">Create a goal, then add the next quest that advances it.</p>}
      </section>

      {inactiveGoals.length > 0 ? (
        <section className="dashboard-section">
          <SectionHeader eyebrow="History" title="Completed and paused" />
          <div className="goal-grid">{inactiveGoals.map(renderGoal)}</div>
        </section>
      ) : null}
    </section>
  );
}
