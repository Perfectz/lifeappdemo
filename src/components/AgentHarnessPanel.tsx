"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalGoalRepository } from "@/data/goalRepository";
import { createLocalMemoryRepository } from "@/data/memoryRepository";
import { createLocalNoteRepository } from "@/data/noteRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import { createLocalJournalRepository } from "@/data/journalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { loadTrainingProfile } from "@/data/trainingProfileRepository";
import { toLocalIsoDate } from "@/domain/dates";
import type { MemoryEntry } from "@/domain/memory";
import type { TrainingProfile } from "@/domain/trainingProfile";
import type {
  DailyPlan,
  FoodEntry,
  Goal,
  JournalEntry,
  MetricEntry,
  Note,
  Task,
  Workout
} from "@/domain/types";

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
  journals: JournalEntry[];
  metrics: MetricEntry[];
  workouts: Workout[];
  foods: FoodEntry[];
  trainingProfile: TrainingProfile | null;
};

const emptyState: HarnessState = {
  goals: [],
  tasks: [],
  memories: [],
  notes: [],
  plans: [],
  journals: [],
  metrics: [],
  workouts: [],
  foods: [],
  trainingProfile: null
};

export function AgentHarnessPanel({ mode, onPrompt }: AgentHarnessPanelProps) {
  const [state, setState] = useState<HarnessState>(emptyState);

  const reload = useCallback(() => {
    const storage = window.localStorage;
    setState({
      goals: createLocalGoalRepository(storage).load(),
      tasks: createLocalTaskRepository(storage).load(),
      memories: createLocalMemoryRepository(storage).load(),
      notes: createLocalNoteRepository(storage).load(),
      plans: createLocalDailyPlanRepository(storage).load(),
      journals: createLocalJournalRepository(storage).load(),
      metrics: createLocalMetricRepository(storage).load(),
      workouts: createLocalWorkoutRepository(storage).load(),
      foods: createLocalFoodEntryRepository(storage).load(),
      trainingProfile: loadTrainingProfile(storage)
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
      <details className="agent-context-details">
        <summary>
          <span className="agent-ready"><span aria-hidden="true" /> Context loaded</span>
          <span className="agent-context-summary">
            {activeGoals.length} goals · {openTasks.length} quests · {state.memories.length} memories
          </span>
          <span className="agent-context-toggle">Inspect</span>
        </summary>
        <div className="agent-context-body">
          <p className="agent-context-mode"><strong>{config.label}:</strong> {config.description}</p>
          <div className="agent-context-grid">
            <Link href="/goals" className="agent-context-card">
              <span>Active goals</span>
              <strong>{activeGoals.length}</strong>
              <small>{activeGoals[0]?.title ?? "Set your first direction"}</small>
            </Link>
            <Link href="/tasks" className="agent-context-card">
              <span>Open quests</span>
              <strong>{openTasks.length}</strong>
              <small>{todayPlan ? "Daily plan loaded · 8 newest sent" : "No daily plan · 8 newest sent"}</small>
            </Link>
            <Link href="/profile" className="agent-context-card">
              <span>Durable memories</span>
              <strong>{state.memories.length}</strong>
              <small>User-reported preferences and safety constraints</small>
            </Link>
            <Link href="/notes" className="agent-context-card">
              <span>Reference notes</span>
              <strong>{state.notes.length}</strong>
              <small>Up to 8 recently updated notes are sent</small>
            </Link>
            <Link href="/fitness" className="agent-context-card">
              <span>Training profile</span>
              <strong>{state.trainingProfile?.weeklySchedule ? "7d" : "Daily"}</strong>
              <small>{state.trainingProfile?.notes?.trim() || "Equipment, schedule, and coaching style"}</small>
            </Link>
            <Link href="/metrics" className="agent-context-card">
              <span>Health & activity</span>
              <strong>{state.metrics.length + state.workouts.length + state.foods.length}</strong>
              <small>Latest 5 check-ins plus today&apos;s food and training</small>
            </Link>
            <Link href="/journal" className="agent-context-card">
              <span>Reflection</span>
              <strong>{state.journals.length}</strong>
              <small>Up to 5 recent journal entries are sent</small>
            </Link>
          </div>
          <p className="agent-safety-note">
            Nothing is sent until you submit a message. Proposed changes require approval before they apply.
          </p>
        </div>
      </details>
      <button type="button" className="agent-starter" onClick={() => onPrompt(config.prompt)}>
        <span>Try this request</span>
        <strong>{config.prompt}</strong>
      </button>
    </aside>
  );
}
