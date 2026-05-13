"use client";

import { useEffect, useMemo, useState } from "react";

import { AiAdvisorPopup } from "@/components/AiAdvisorPopup";
import { CharacterSprite } from "@/components/CharacterSprite";
import { CommandButton } from "@/components/CommandButton";
import { DashboardQuestCard } from "@/components/DashboardQuestCard";
import { SectionHeader } from "@/components/SectionHeader";
import { StatusPanel } from "@/components/StatusPanel";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import type { DailyPlan, MetricEntry, Task } from "@/domain";
import { getDashboardStats } from "@/domain/dashboard";
import { getActiveDailyPlanForDate } from "@/domain/dailyPlans";
import { formatReadableDate, toLocalIsoDate } from "@/domain/dates";
import { countDemoData, hasDemoData } from "@/domain/demoData";
import { getLatestMetricEntry } from "@/domain/metrics";

export function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [metricEntries, setMetricEntries] = useState<MetricEntry[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const today = toLocalIsoDate();
  const readableToday = formatReadableDate();
  const stats = useMemo(() => getDashboardStats(tasks, today), [tasks, today]);
  const todaysPlan = useMemo(() => getActiveDailyPlanForDate(plans, today), [plans, today]);
  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks]
  );
  const mainQuest = todaysPlan?.mainQuestTaskId
    ? taskById.get(todaysPlan.mainQuestTaskId)
    : undefined;
  const sideQuests = todaysPlan
    ? todaysPlan.sideQuestTaskIds.map((taskId) => taskById.get(taskId)).filter((task) => task !== undefined)
    : [];
  const plannedQuestCount = todaysPlan
    ? Number(Boolean(mainQuest)) + sideQuests.length
    : stats.plannedTodayTasks.length;
  const latestMetricEntry = useMemo(
    () => getLatestMetricEntry(metricEntries),
    [metricEntries]
  );
  const demoState = useMemo(
    () =>
      hasDemoData({
        dailyPlans: plans,
        dailyReports: [],
        eveningPostmortems: [],
        journalEntries: [],
        metricEntries,
        tasks
      }),
    [metricEntries, plans, tasks]
  );
  const demoCounts = useMemo(
    () =>
      countDemoData({
        dailyPlans: plans,
        dailyReports: [],
        eveningPostmortems: [],
        journalEntries: [],
        metricEntries,
        tasks
      }),
    [metricEntries, plans, tasks]
  );
  const activeQuestCount = stats.activeBacklogCount + stats.plannedTodayTasks.length;
  const completionPercent =
    activeQuestCount + stats.completedTodayCount > 0
      ? Math.round((stats.completedTodayCount / (activeQuestCount + stats.completedTodayCount)) * 100)
      : 0;
  const advisorMessage = useMemo(() => {
    if (!hasLoaded) {
      return "Reading today's quest signal...";
    }

    if (mainQuest) {
      return `Start with "${mainQuest.title}". Make the first action small enough to begin in five minutes.`;
    }

    if (todaysPlan) {
      return "Today's plan exists, but the Main Quest needs an active quest. Pick a fresh anchor before side objectives.";
    }

    if (stats.plannedTodayTasks.length > 0) {
      return "You have planned quests. Choose the one that most protects your energy and attention first.";
    }

    return "Start the morning stand-up and choose one Main Quest before adding more side objectives.";
  }, [hasLoaded, mainQuest, stats.plannedTodayTasks.length, todaysPlan]);

  useEffect(() => {
    setTasks(createLocalTaskRepository(window.localStorage).load());
    setPlans(createLocalDailyPlanRepository(window.localStorage).load());
    setMetricEntries(createLocalMetricRepository(window.localStorage).load());
    setHasLoaded(true);
  }, []);

  return (
    <section className="dashboard-page" aria-labelledby="dashboard-title">
      <header className="dashboard-hero">
        <div>
          <p className="eyebrow">LifeQuest OS Command Center</p>
          <h1 id="dashboard-title">Today</h1>
          <p>{readableToday}</p>
          {demoState ? <span className="demo-data-badge">Demo Data</span> : null}
        </div>
        <div className="page-sprite-frame dashboard-sprite" aria-hidden="true">
          <CharacterSprite className="page-sprite" pose="victory" />
        </div>
      </header>

      <section className="dashboard-grid" aria-label="Today snapshot">
        <StatusPanel
          label="Planned Today"
          tone="success"
          value={String(plannedQuestCount)}
        />
        <StatusPanel label="Backlog" value={String(stats.activeBacklogCount)} />
        <StatusPanel
          label="Completed Today"
          tone="warning"
          value={String(stats.completedTodayCount)}
        />
      </section>

      {hasLoaded && demoState ? (
        <section className="dashboard-section demo-dashboard-callout" aria-label="Demo data summary">
          <SectionHeader eyebrow="Portfolio Mode" title="Screenshot-Ready Demo" />
          <p>
            Fake demo data is active: {demoCounts.tasks} quests and {demoCounts.metricEntries} metric
            entries are mixed into the view with clear labels. Reset demo data from Settings to
            remove only demo records.
          </p>
          <div className="progress-meter" aria-label={`Quest completion ${completionPercent}%`}>
            <span style={{ width: `${completionPercent}%` }} />
          </div>
        </section>
      ) : null}

      <div className="dashboard-layout">
        <section className="dashboard-section" aria-label="Today section">
          <SectionHeader eyebrow="Today Section" title="Planned Quests" />
          {!hasLoaded ? <p className="quest-empty">Loading dashboard...</p> : null}
          {hasLoaded && todaysPlan ? (
            <div className="daily-plan-summary">
              {todaysPlan.intention ? (
                <p className="daily-plan-intention">{todaysPlan.intention}</p>
              ) : null}
              <div className="daily-plan-group">
                <h3>Main Quest</h3>
                {mainQuest ? (
                  <DashboardQuestCard task={mainQuest} />
                ) : (
                  <p className="quest-empty">Main Quest is no longer active.</p>
                )}
              </div>
              <div className="daily-plan-group">
                <h3>Side Quests</h3>
                {sideQuests.length > 0 ? (
                  <div className="dashboard-task-list">
                    {sideQuests.map((task) => (
                      <DashboardQuestCard key={task.id} task={task} />
                    ))}
                  </div>
                ) : (
                  <p className="quest-empty">No Side Quests selected.</p>
                )}
              </div>
            </div>
          ) : null}
          {hasLoaded && !todaysPlan && stats.plannedTodayTasks.length === 0 ? (
            <div className="dashboard-empty dashboard-empty-action">
              <strong>Main Quest not chosen yet.</strong>
              <p>
                Start the morning stand-up to choose a Main Quest and up to three
                Side Quests.
              </p>
              <CommandButton href="/standup/morning" icon="morning">
                Choose Main Quest
              </CommandButton>
            </div>
          ) : null}
          {!todaysPlan && stats.plannedTodayTasks.length > 0 ? (
            <div className="dashboard-task-list">
              {stats.plannedTodayTasks.map((task) => (
                <DashboardQuestCard key={task.id} task={task} />
              ))}
            </div>
          ) : null}
        </section>

        <aside className="dashboard-side" aria-label="Dashboard actions">
          <AiAdvisorPopup message={advisorMessage} />

          <section className="dashboard-section">
            <SectionHeader eyebrow="Metrics" title="Latest Snapshot" />
            {latestMetricEntry ? (
              <dl className="metric-snapshot">
                <div>
                  <dt>Check-in</dt>
                  <dd>
                    {latestMetricEntry.date} - {latestMetricEntry.checkInType}
                  </dd>
                </div>
                {latestMetricEntry.energyLevel ? (
                  <div>
                    <dt>Energy</dt>
                    <dd>{latestMetricEntry.energyLevel}/5</dd>
                  </div>
                ) : null}
                {latestMetricEntry.moodLevel ? (
                  <div>
                    <dt>Mood</dt>
                    <dd>{latestMetricEntry.moodLevel}/5</dd>
                  </div>
                ) : null}
                {latestMetricEntry.sleepHours !== undefined ? (
                  <div>
                    <dt>Sleep</dt>
                    <dd>{latestMetricEntry.sleepHours}h</dd>
                  </div>
                ) : null}
                {latestMetricEntry.steps !== undefined ? (
                  <div>
                    <dt>Steps</dt>
                    <dd>{latestMetricEntry.steps}</dd>
                  </div>
                ) : null}
                {latestMetricEntry.kettlebellSwingsTotal !== undefined ? (
                  <div>
                    <dt>Swings</dt>
                    <dd>{latestMetricEntry.kettlebellSwingsTotal}</dd>
                  </div>
                ) : null}
                {latestMetricEntry.karateClass ? (
                  <div>
                    <dt>Karate</dt>
                    <dd>Class logged</dd>
                  </div>
                ) : null}
                {latestMetricEntry.distanceWalkedMiles !== undefined ? (
                  <div>
                    <dt>Walked</dt>
                    <dd>{latestMetricEntry.distanceWalkedMiles} mi</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <div className="dashboard-empty dashboard-empty-action">
                <strong>No metrics logged yet.</strong>
                <p>Log a morning or evening check-in to update this snapshot.</p>
                <CommandButton href="/metrics" icon="metrics">
                  Log Check-In
                </CommandButton>
              </div>
            )}
          </section>

          <section className="dashboard-section">
            <SectionHeader eyebrow="Next Action" title="Command Menu" />
            <div className="command-list">
              <CommandButton href="/standup/morning" icon="morning">
                Start Morning Stand-Up
              </CommandButton>
              <CommandButton href="/tasks" icon="tasks">
                Open Quest Log
              </CommandButton>
              <CommandButton href="/metrics" icon="metrics">
                Log Metrics
              </CommandButton>
              <CommandButton href="/health-import" icon="healthImport">
                Import Health Data
              </CommandButton>
              <CommandButton href="/standup/evening" icon="evening">
                Start Evening Postmortem
              </CommandButton>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
