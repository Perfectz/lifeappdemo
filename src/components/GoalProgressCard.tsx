"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SectionHeader } from "@/components/SectionHeader";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalGoalRepository } from "@/data/goalRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import { effectiveGoalProgressFraction } from "@/domain/goals";
import type { Goal, Task } from "@/domain/types";

export function GoalProgressCard() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

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

  const active = useMemo(() => goals.filter((goal) => goal.status === "active").slice(0, 3), [goals]);

  return (
    <section className="dashboard-section" aria-label="Active goals">
      <SectionHeader eyebrow="Direction" title="Goals in motion" />
      {active.length === 0 ? (
        <div className="dashboard-empty dashboard-empty-action">
          <strong>No strategic goal yet.</strong>
          <p>Define the outcome, then connect today&apos;s quests to it.</p>
          <Link className="command-button" href="/goals"><span>Set a goal</span></Link>
        </div>
      ) : (
        <div className="goal-summary-list">
          {active.map((goal) => {
            const progress = effectiveGoalProgressFraction(goal, tasks);
            const next = tasks.find((task) => task.linkedGoalId === goal.id && task.status === "todo");
            return (
              <article key={goal.id} className="goal-summary-item">
                <div><strong>{goal.title}</strong><span>{progress === undefined ? "Add a progress signal" : `${Math.round(progress * 100)}%`}</span></div>
                <div className="progress-meter"><span style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} /></div>
                {next ? <small>Next quest: {next.title}</small> : <small>No open linked quest.</small>}
              </article>
            );
          })}
          <Link href="/goals" className="dashboard-backlog-link">Open goals →</Link>
        </div>
      )}
    </section>
  );
}
