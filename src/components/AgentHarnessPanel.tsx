"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalGoalRepository } from "@/data/goalRepository";
import { createLocalMemoryRepository } from "@/data/memoryRepository";
import { createLocalNoteRepository } from "@/data/noteRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import { toLocalIsoDate } from "@/domain/dates";
import type { MemoryEntry } from "@/domain/memory";
import type { DailyPlan, Goal, Note, Task } from "@/domain/types";

export type AgentMode = "coach" | "assistant" | "planning" | "review";

export const agentModeConfig: Record<
  AgentMode,
  { label: string; description: string; prompt: string; placeholder: string }
> = {
  coach: {
    label: "Life Coach",
    description: "Honest guidance tied to the person you are becoming.",
    prompt: "Review my active goals and recent behavior. What is the highest-leverage adjustment I should make now?",
    placeholder: "Talk through a goal, obstacle, or decision…"
  },
  assistant: {
    label: "Assistant",
    description: "Organize commitments and turn requests into confirmed actions.",
    prompt: "Review my open quests. Help me organize, defer, or archive what no longer deserves attention.",
    placeholder: "Ask me to organize, capture, retrieve, or update something…"
  },
  planning: {
    label: "Planner",
    description: "Build a realistic plan from goals, commitments, health, and energy.",
    prompt: "Build today's plan around my active goals, current energy, health constraints, and open quests.",
    placeholder: "Plan today, this week, or a specific objective…"
  },
  review: {
    label: "Review",
    description: "Find patterns, capture lessons, and choose the next experiment.",
    prompt: "Review my last seven days against my active goals. Name the pattern, the lesson, and the next experiment.",
    placeholder: "Review progress, a difficult day, or a completed project…"
  }
};

type AgentHarnessPanelProps = {
  mode: AgentMode;
  onPrompt(prompt: string): void;
};

type HarnessState = {
  goals: Goal[];
  tasks: Task[];
  memories: MemoryEntry[];
  notes: Note[];
  plans: DailyPlan[];
};

const emptyState: HarnessState = { goals: [], tasks: [], memories: [], notes: [], plans: [] };

export function AgentHarnessPanel({ mode, onPrompt }: AgentHarnessPanelProps) {
  const [state, setState] = useState<HarnessState>(emptyState);

  const reload = useCallback(() => {
    const storage = window.localStorage;
    setState({
      goals: createLocalGoalRepository(storage).load(),
      tasks: createLocalTaskRepository(storage).load(),
      memories: createLocalMemoryRepository(storage).load(),
      notes: createLocalNoteRepository(storage).load(),
      plans: createLocalDailyPlanRepository(storage).load()
    });
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  const activeGoals = useMemo(
    () => state.goals.filter((goal) => goal.status === "active"),
    [state.goals]
  );
  const openTasks = useMemo(
    () => state.tasks.filter((task) => task.status === "todo"),
    [state.tasks]
  );
  const todayPlan = state.plans.find((plan) => plan.date === toLocalIsoDate());
  const config = agentModeConfig[mode];

  return (
    <aside className="agent-harness" aria-label="Agent context harness">
      <div className="agent-harness-head">
        <div>
          <p className="eyebrow">Active mode</p>
          <h2>{config.label}</h2>
          <p>{config.description}</p>
        </div>
        <span className="agent-ready"><span aria-hidden="true" /> Context loaded</span>
      </div>

      <div className="agent-context-grid">
        <Link href="/goals" className="agent-context-card">
          <span>Active goals</span>
          <strong>{activeGoals.length}</strong>
          <small>{activeGoals[0]?.title ?? "Set your first direction"}</small>
        </Link>
        <Link href="/tasks" className="agent-context-card">
          <span>Open quests</span>
          <strong>{openTasks.length}</strong>
          <small>{todayPlan ? "Today's plan is loaded" : "No daily plan yet"}</small>
        </Link>
        <Link href="/profile" className="agent-context-card">
          <span>Durable memories</span>
          <strong>{state.memories.length}</strong>
          <small>Preferences, constraints, and known facts</small>
        </Link>
        <Link href="/notes" className="agent-context-card">
          <span>Reference notes</span>
          <strong>{state.notes.length}</strong>
          <small>Recent notes are available to the agent</small>
        </Link>
      </div>

      <button type="button" className="agent-starter" onClick={() => onPrompt(config.prompt)}>
        <span>Suggested request</span>
        <strong>{config.prompt}</strong>
      </button>
      <p className="agent-safety-note">
        Reads stay local until you send a message. Proposed changes appear as approval cards before they apply.
      </p>
    </aside>
  );
}
