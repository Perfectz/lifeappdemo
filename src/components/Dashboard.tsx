"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getAuthHeaders } from "@/client/authToken";
import { useHeroName } from "@/client/useHeroName";
import { CharacterSprite } from "@/components/CharacterSprite";
import { CommandButton } from "@/components/CommandButton";
import { DashboardQuestCard } from "@/components/DashboardQuestCard";
import { FuelCard } from "@/components/FuelCard";
import { GoalProgressCard } from "@/components/GoalProgressCard";
import type { JrpgIconName } from "@/components/JrpgIcon";
import { NorthStarCard } from "@/components/NorthStarCard";
import { SectionHeader } from "@/components/SectionHeader";
import { SetupPrompt } from "@/components/SetupPrompt";
import { TodayTrainingCard } from "@/components/TodayTrainingCard";
import { VitalsAlertBanner } from "@/components/VitalsAlertBanner";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { getTargetForDate } from "@/data/dailyNutritionTargetRepository";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import { createLocalWaterRepository } from "@/data/waterRepository";
import { loadTrainingProfile } from "@/data/trainingProfileRepository";
import { loadBodyProfile } from "@/data/bodyProfileRepository";
import { createLocalMemoryRepository } from "@/data/memoryRepository";
import { loadWiki } from "@/data/wikiRepository";
import type { DailyPlan, FoodEntry, MetricEntry, Task, Workout, WorkoutType } from "@/domain";
import type { DailyNutritionTarget } from "@/domain/dailyNutritionTarget";
import { buildDailyBrief } from "@/domain/dailyBrief";
import { formatMemoriesForPrompt } from "@/domain/memory";
import { formatWikiForPrompt } from "@/domain/personalWiki";
import { getDashboardStats } from "@/domain/dashboard";
import { getActiveDailyPlanForDate } from "@/domain/dailyPlans";
import { formatReadableDate, toLocalIsoDate } from "@/domain/dates";
import { countDemoData, hasDemoData } from "@/domain/demoData";
import { getLatestMetricEntry } from "@/domain/metrics";
import { workoutTypesForDate } from "@/domain/trainingProfile";
import { getWaterForDate } from "@/domain/waterTracking";
import { hasCompletedSetup } from "@/domain/bodyProfile";

const FOCUS_ICON: Record<string, JrpgIconName> = {
  "/vitals": "metrics",
  "/fitness": "metrics",
  "/metrics": "metrics",
  "/standup/morning": "morning",
  "/tasks": "tasks",
  "/nutrition": "metrics"
};

export function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [metricEntries, setMetricEntries] = useState<MetricEntry[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [nutritionTarget, setNutritionTarget] = useState<DailyNutritionTarget | undefined>();
  const [waterOz, setWaterOz] = useState(0);
  const [requiredWorkoutTypes, setRequiredWorkoutTypes] = useState<WorkoutType[] | undefined>();
  const [now, setNow] = useState<Date | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const heroName = useHeroName();
  // Derive dates from the mounted `now` state so the statically prerendered
  // HTML (built at an arbitrary time) never bakes in a date that mismatches
  // the client on hydration.
  const today = now ? toLocalIsoDate(now) : "";
  const readableToday = now ? formatReadableDate(now) : "";
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
  const latestMetricEntry = useMemo(
    () => getLatestMetricEntry(metricEntries),
    [metricEntries]
  );
  const demoState = useMemo(
    () =>
      hasDemoData({
        dailyPlans: plans,
        dailyReports: [],
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
  const brief = useMemo(
    () =>
      now && setupComplete
        ? buildDailyBrief({
            today,
            nowMinutes: now.getHours() * 60 + now.getMinutes(),
            tasks,
            workouts,
            metrics: metricEntries,
            dailyPlans: plans,
            foodEntries,
            nutritionTarget,
            waterOz,
            requiredWorkoutTypes
          })
        : null,
    [now, setupComplete, today, tasks, workouts, metricEntries, plans, foodEntries, nutritionTarget, waterOz, requiredWorkoutTypes]
  );

  useEffect(() => {
    function refresh() {
      const storage = window.localStorage;
      setTasks(createLocalTaskRepository(storage).load());
      setPlans(createLocalDailyPlanRepository(storage).load());
      setMetricEntries(createLocalMetricRepository(storage).load());
      setWorkouts(createLocalWorkoutRepository(storage).load());
      setFoodEntries(createLocalFoodEntryRepository(storage).load());
      const stamp = new Date();
      const currentToday = toLocalIsoDate(stamp);
      setNutritionTarget(getTargetForDate(storage, currentToday));
      setWaterOz(getWaterForDate(createLocalWaterRepository(storage).load(), currentToday));
      setRequiredWorkoutTypes(
        workoutTypesForDate(loadTrainingProfile(storage), currentToday)
      );
      setSetupComplete(hasCompletedSetup(loadBodyProfile(storage)));
      setNow(stamp);
      setHasLoaded(true);
    }
    refresh();
    window.addEventListener(dataChangedEventName, refresh);
    return () => window.removeEventListener(dataChangedEventName, refresh);
  }, []);

  // Personalize the briefing with GPT-5.5 when online; the deterministic
  // summary stays as the instant/offline fallback. Only refetch when the
  // briefing's content meaningfully changes.
  const briefSignature = brief
    ? `${brief.timeOfDay}|${brief.allClear}|${brief.focus
        .map((item) => `${item.id}${item.overdue ? "!" : ""}`)
        .join(",")}`
    : "";

  useEffect(() => {
    if (!brief || !briefSignature) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    setAiMessage(null);
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/ai/brief", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
          body: JSON.stringify({
            timeOfDay: brief.timeOfDay,
            heroName,
            allClear: brief.allClear,
            items: brief.focus.map((item) => item.message),
            aboutMe:
              [
                formatWikiForPrompt(loadWiki(window.localStorage)),
                formatMemoriesForPrompt(createLocalMemoryRepository(window.localStorage).load())
              ]
                .filter(Boolean)
                .join("\n\n") || undefined
          })
        });
        const data = await response.json();
        if (!cancelled && response.ok && typeof data.message === "string") {
          setAiMessage(data.message);
        }
      } catch {
        // Keep the deterministic fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefSignature]);

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

      <VitalsAlertBanner />
      <SetupPrompt />

      {brief ? (
        <section
          className={brief.allClear ? "coach-brief coach-brief-clear" : "coach-brief"}
          aria-label="Coach briefing"
        >
          <div className="coach-brief-head">
            <CharacterSprite className="coach-brief-sprite" pose={brief.allClear ? "victory" : "thinking"} />
            <div>
              <p className="eyebrow">Coach</p>
              <p className="coach-brief-summary">
                {aiMessage ?? `Good ${brief.timeOfDay}, ${heroName}. ${brief.summary}`}
              </p>
            </div>
          </div>

          {brief.allClear ? (
            <p className="coach-brief-allclear">✓ Vitals, workouts, and your plan are handled. Keep it rolling.</p>
          ) : (
            <>
              <p className="coach-brief-focus">{brief.focus[0].message}</p>
              <CommandButton href={brief.focus[0].href} icon={FOCUS_ICON[brief.focus[0].href] ?? "dashboard"}>
                {brief.focus[0].ctaLabel}
              </CommandButton>
              {brief.focus.length > 1 ? (
                <ul className="coach-brief-more">
                  {brief.focus.slice(1).map((item) => (
                    <li key={item.id}>
                      <span>{item.message}</span>
                      <Link href={item.href} className="coach-brief-link">
                        {item.ctaLabel} →
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      <div className="dashboard-health-row">
        <TodayTrainingCard />
        <FuelCard />
      </div>

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
          {hasLoaded && stats.activeBacklogCount > 0 ? (
            <p className="dashboard-backlog-link">
              <Link href="/tasks">{stats.activeBacklogCount} in backlog →</Link>
            </p>
          ) : null}
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

        </aside>
      </div>

      {hasLoaded ? <GoalProgressCard /> : null}
      {hasLoaded ? <NorthStarCard /> : null}
    </section>
  );
}
