"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { CharacterSprite } from "@/components/CharacterSprite";
import { OfflineBoundary, aiNetworkRequiredMessage, useNetworkStatus } from "@/components/OfflineBoundary";
import { SectionHeader } from "@/components/SectionHeader";
import { VoiceSessionPanel } from "@/components/VoiceSessionPanel";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalDailyReportRepository } from "@/data/dailyReportRepository";
import { createLocalEveningPostmortemRepository } from "@/data/eveningPostmortemRepository";
import { createLocalJournalRepository } from "@/data/journalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import type {
  AIStoredAppData,
  AIToolProposal,
  DailyPlan,
  DailyReport,
  EveningPostmortem as EveningPostmortemRecord,
  EveningTaskOutcome,
  JournalEntry,
  MetricEntry,
  Task,
  TaskOutcome
} from "@/domain";
import type { ConfirmTaskToolRequestInput } from "@/domain/aiTaskTools";
import { getDailyPlanForDate } from "@/domain/dailyPlans";
import { toLocalIsoDate } from "@/domain/dates";
import {
  applyTaskOutcomes,
  closePlanAfterPostmortem,
  getEveningPostmortemForDate,
  upsertEveningPostmortemForDate
} from "@/domain/eveningPostmortems";
import { getDailyReportForDate } from "@/domain/reports";

type ReflectionInput = {
  wins: string;
  friction: string;
  lessonsLearned: string;
  tomorrowFollowUps: string;
};

type EveningMode = "manual" | "ai" | "voice";

type ChatMessage = {
  id: string;
  role: "user" | "coach";
  content: string;
};

type AIChatResponse = {
  message?: string;
  error?: string;
  proposals?: AIToolProposal[];
};

type ConfirmToolResponse = {
  ok?: boolean;
  error?: string;
  appliedChangeSummary?: string;
  dailyPlans?: ConfirmTaskToolRequestInput["dailyPlans"];
  dailyReports?: ConfirmTaskToolRequestInput["dailyReports"];
  eveningPostmortems?: ConfirmTaskToolRequestInput["eveningPostmortems"];
  journalEntries?: ConfirmTaskToolRequestInput["journalEntries"];
  metricEntries?: ConfirmTaskToolRequestInput["metricEntries"];
  tasks?: ConfirmTaskToolRequestInput["tasks"];
};

const defaultReflection: ReflectionInput = {
  wins: "",
  friction: "",
  lessonsLearned: "",
  tomorrowFollowUps: ""
};

function getInitialOutcomes(plan: DailyPlan | undefined, existing?: EveningPostmortemRecord) {
  if (existing) {
    return existing.taskOutcomes;
  }

  if (!plan) {
    return [];
  }

  return [plan.mainQuestTaskId, ...plan.sideQuestTaskIds]
    .filter((taskId): taskId is string => Boolean(taskId))
    .map((taskId) => ({
      taskId,
      outcome: "left_open" as const,
      note: ""
    }));
}

function getReflection(existing?: EveningPostmortemRecord): ReflectionInput {
  return {
    wins: existing?.wins ?? "",
    friction: existing?.friction ?? "",
    lessonsLearned: existing?.lessonsLearned ?? "",
    tomorrowFollowUps: existing?.tomorrowFollowUps ?? ""
  };
}

function createMessageId(role: ChatMessage["role"]): string {
  return `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadStoredAppData(): AIStoredAppData {
  return {
    tasks: createLocalTaskRepository(window.localStorage).load(),
    dailyPlans: createLocalDailyPlanRepository(window.localStorage).load(),
    metricEntries: createLocalMetricRepository(window.localStorage).load(),
    journalEntries: createLocalJournalRepository(window.localStorage).load(),
    dailyReports: createLocalDailyReportRepository(window.localStorage).load()
  };
}

export function EveningPostmortem() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [postmortems, setPostmortems] = useState<EveningPostmortemRecord[]>([]);
  const [metricEntries, setMetricEntries] = useState<MetricEntry[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [taskOutcomes, setTaskOutcomes] = useState<EveningTaskOutcome[]>([]);
  const [reflection, setReflection] = useState<ReflectionInput>(defaultReflection);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isEditingClosed, setIsEditingClosed] = useState(false);
  const [mode, setMode] = useState<EveningMode>("manual");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [aiProposals, setAiProposals] = useState<AIToolProposal[]>([]);
  const [aiDraft, setAiDraft] = useState("");
  const [isSendingAiMessage, setIsSendingAiMessage] = useState(false);
  const isOnline = useNetworkStatus();
  const today = toLocalIsoDate();

  const todaysPlan = useMemo(() => getDailyPlanForDate(plans, today), [plans, today]);
  const existingPostmortem = useMemo(
    () => getEveningPostmortemForDate(postmortems, today),
    [postmortems, today]
  );
  const currentReport = useMemo(
    () => getDailyReportForDate(reports, today),
    [reports, today]
  );
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const plannedTasks = useMemo(
    () => taskOutcomes.map((outcome) => taskById.get(outcome.taskId)).filter((task) => task !== undefined),
    [taskById, taskOutcomes]
  );
  const isClosedReadOnly =
    mode !== "ai" &&
    todaysPlan?.status === "closed" &&
    existingPostmortem !== undefined &&
    !isEditingClosed;

  useEffect(() => {
    const loadedTasks = createLocalTaskRepository(window.localStorage).load();
    const loadedPlans = createLocalDailyPlanRepository(window.localStorage).load();
    const loadedReports = createLocalDailyReportRepository(window.localStorage).load();
    const loadedMetricEntries = createLocalMetricRepository(window.localStorage).load();
    const loadedJournalEntries = createLocalJournalRepository(window.localStorage).load();
    const loadedPostmortems =
      createLocalEveningPostmortemRepository(window.localStorage).load();
    const plan = getDailyPlanForDate(loadedPlans, today);
    const postmortem = getEveningPostmortemForDate(loadedPostmortems, today);

    setTasks(loadedTasks);
    setPlans(loadedPlans);
    setReports(loadedReports);
    setMetricEntries(loadedMetricEntries);
    setJournalEntries(loadedJournalEntries);
    setPostmortems(loadedPostmortems);
    setTaskOutcomes(getInitialOutcomes(plan, postmortem));
    setReflection(getReflection(postmortem));
    setHasLoaded(true);
  }, [today]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    createLocalTaskRepository(window.localStorage).save(tasks);
  }, [hasLoaded, tasks]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    createLocalDailyPlanRepository(window.localStorage).save(plans);
  }, [hasLoaded, plans]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    createLocalDailyReportRepository(window.localStorage).save(reports);
  }, [hasLoaded, reports]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    createLocalEveningPostmortemRepository(window.localStorage).save(postmortems);
  }, [hasLoaded, postmortems]);

  function updateOutcome(taskId: string, outcome: TaskOutcome) {
    setTaskOutcomes((current) =>
      current.map((taskOutcome) =>
        taskOutcome.taskId === taskId ? { ...taskOutcome, outcome } : taskOutcome
      )
    );
  }

  function updateOutcomeNote(taskId: string, note: string) {
    setTaskOutcomes((current) =>
      current.map((taskOutcome) =>
        taskOutcome.taskId === taskId ? { ...taskOutcome, note } : taskOutcome
      )
    );
  }

  function updateReflection(field: keyof ReflectionInput, value: string) {
    setReflection((current) => ({
      ...current,
      [field]: value
    }));
  }

  function savePostmortemData() {
    const now = new Date().toISOString();

    try {
      const nextPostmortems = upsertEveningPostmortemForDate(
        postmortems,
        {
          date: today,
          dailyPlanId: todaysPlan?.id,
          taskOutcomes,
          ...reflection
        },
        now
      );

      setPostmortems(nextPostmortems);
      setTasks((current) => applyTaskOutcomes(current, taskOutcomes, now));
      setPlans((current) => closePlanAfterPostmortem(current, todaysPlan?.id, now));
      setMessage("Evening postmortem saved. Daily Plan closed.");
      setError(null);
      setIsEditingClosed(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save postmortem.");
      setMessage(null);
    }
  }

  function savePostmortem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    savePostmortemData();
  }

  function taskTitle(taskId: string | undefined): string {
    if (!taskId) {
      return "None";
    }

    return taskById.get(taskId)?.title ?? taskId;
  }

  function startAIMode() {
    setMode("ai");
    setError(null);
    setMessage(null);

    if (aiMessages.length === 0) {
      const planSummary = todaysPlan
        ? `Today's plan has ${plannedTasks.length} planned quest${plannedTasks.length === 1 ? "" : "s"} and the intention "${todaysPlan.intention ?? "not captured"}".`
        : "No Daily Plan is stored for today.";

      setAiMessages([
        {
          id: "evening-ai-welcome",
          role: "coach",
          content: `${planSummary} What actually moved forward, and what lesson should we capture?`
        }
      ]);
    }
  }

  function handoffVoiceTranscript(transcript: string) {
    startAIMode();
    setAiDraft(`[Voice transcript]\n${transcript}`);
    setMessage("Voice transcript loaded into text AI. Review it, then send for proposals.");
  }

  function updateAIProposal(proposalId: string, status: AIToolProposal["status"]) {
    setAiProposals((current) =>
      current.map((proposal) =>
        proposal.id === proposalId
          ? { ...proposal, status, updatedAt: new Date().toISOString() }
          : proposal
      )
    );
  }

  function rejectAIProposal(proposal: AIToolProposal) {
    updateAIProposal(proposal.id, "rejected");
    setAiMessages((current) => [
      ...current,
      {
        id: createMessageId("coach"),
        role: "coach",
        content: `Rejected proposal: ${proposal.summary}`
      }
    ]);
  }

  async function sendAIMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = aiDraft.trim();

    if (!trimmedMessage || isSendingAiMessage) {
      return;
    }

    if (!navigator.onLine) {
      setError(aiNetworkRequiredMessage);
      return;
    }

    setAiMessages((current) => [
      ...current,
      { id: createMessageId("user"), role: "user", content: trimmedMessage }
    ]);
    setAiDraft("");
    setError(null);
    setIsSendingAiMessage(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: trimmedMessage,
          mode: "evening",
          appData: loadStoredAppData()
        })
      });
      const payload = (await response.json()) as AIChatResponse;

      if (!response.ok || !payload.message) {
        throw new Error(payload.error ?? "AI evening postmortem is unavailable right now.");
      }

      setAiMessages((current) => [
        ...current,
        { id: createMessageId("coach"), role: "coach", content: payload.message ?? "" }
      ]);
      setAiProposals((current) => [...current, ...(payload.proposals ?? [])]);
    } catch (aiError) {
      setError(
        aiError instanceof Error
          ? aiError.message
          : "AI evening postmortem is unavailable right now."
      );
    } finally {
      setIsSendingAiMessage(false);
    }
  }

  function queueReportProposal() {
    const now = new Date().toISOString();

    setAiProposals((current) => [
      ...current,
      {
        id: `proposal-report-${now}`,
        toolName: "generate_daily_report",
        summary: "Generate AI-assisted daily report",
        payload: {
          date: today,
          style: "ai_assisted",
          includeLinkedInSourceMaterial: true
        },
        status: "pending",
        createdAt: now,
        updatedAt: now
      }
    ]);
  }

  async function confirmAIProposal(proposal: AIToolProposal) {
    updateAIProposal(proposal.id, "confirmed");
    setError(null);

    try {
      const response = await fetch("/api/ai/tools/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          proposal,
          dailyPlans: plans,
          dailyReports: reports,
          eveningPostmortems: postmortems,
          journalEntries,
          metricEntries,
          tasks
        })
      });
      const payload = (await response.json()) as ConfirmToolResponse;

      if (!response.ok || !payload.ok || !payload.appliedChangeSummary) {
        throw new Error(payload.error ?? "AI proposal could not be applied.");
      }

      if (payload.tasks) {
        createLocalTaskRepository(window.localStorage).save(payload.tasks);
        setTasks(payload.tasks);
        if (proposal.toolName === "complete_task" && proposal.payload && typeof proposal.payload === "object") {
          const taskId = (proposal.payload as { taskId?: unknown }).taskId;
          if (typeof taskId === "string") {
            updateOutcome(taskId, "completed");
          }
        }
        if (proposal.toolName === "defer_task" && proposal.payload && typeof proposal.payload === "object") {
          const taskId = (proposal.payload as { taskId?: unknown }).taskId;
          if (typeof taskId === "string") {
            updateOutcome(taskId, "deferred");
          }
        }
      }
      if (payload.dailyPlans) {
        createLocalDailyPlanRepository(window.localStorage).save(payload.dailyPlans);
        setPlans(payload.dailyPlans);
      }
      if (payload.dailyReports) {
        createLocalDailyReportRepository(window.localStorage).save(payload.dailyReports);
        setReports(payload.dailyReports);
      }
      if (payload.eveningPostmortems) {
        createLocalEveningPostmortemRepository(window.localStorage).save(
          payload.eveningPostmortems
        );
        setPostmortems(payload.eveningPostmortems);
      }
      if (payload.metricEntries) {
        createLocalMetricRepository(window.localStorage).save(payload.metricEntries);
        setMetricEntries(payload.metricEntries);
      }
      if (payload.journalEntries) {
        createLocalJournalRepository(window.localStorage).save(payload.journalEntries);
        setJournalEntries(payload.journalEntries);
      }

      updateAIProposal(proposal.id, "applied");
      setAiMessages((current) => [
        ...current,
        {
          id: createMessageId("coach"),
          role: "coach",
          content: `Applied change: ${payload.appliedChangeSummary}`
        }
      ]);
      setMessage("AI proposal confirmed.");
    } catch (confirmError) {
      updateAIProposal(proposal.id, "failed");
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "AI proposal could not be applied."
      );
    }
  }

  if (isClosedReadOnly && existingPostmortem) {
    return (
      <section className="standup-page" aria-labelledby="evening-postmortem-title">
        <header className="standup-hero">
          <div>
            <p className="eyebrow">Daily Review</p>
            <h1 id="evening-postmortem-title">Evening Postmortem</h1>
            <p>Today&apos;s Daily Plan is closed.</p>
          </div>
          <div className="page-sprite-frame standup-sprite" aria-hidden="true">
            <CharacterSprite className="page-sprite" pose="thinking" />
          </div>
        </header>
        <section className="dashboard-section">
          <SectionHeader eyebrow="Closed Summary" title="Reflection" />
          <div className="postmortem-summary">
            <p>
              <strong>Wins:</strong> {existingPostmortem.wins ?? "No wins captured."}
            </p>
            <p>
              <strong>Friction:</strong> {existingPostmortem.friction ?? "No friction captured."}
            </p>
            <p>
              <strong>Lessons:</strong>{" "}
              {existingPostmortem.lessonsLearned ?? "No lessons captured."}
            </p>
            <p>
              <strong>Tomorrow:</strong>{" "}
              {existingPostmortem.tomorrowFollowUps ?? "No follow-ups captured."}
            </p>
          </div>
          <div className="standup-actions">
            <button onClick={() => setIsEditingClosed(true)} type="button">
              Edit Postmortem
            </button>
            <Link className="command-button" href="/dashboard">
              Return to Dashboard
            </Link>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="standup-page" aria-labelledby="evening-postmortem-title">
      <header className="standup-hero">
        <div>
          <p className="eyebrow">Daily Review</p>
          <h1 id="evening-postmortem-title">Evening Postmortem</h1>
          <p>Review the plan, mark outcomes, capture lessons, and close the day.</p>
        </div>
        <div className="page-sprite-frame standup-sprite" aria-hidden="true">
          <CharacterSprite className="page-sprite" pose="thinking" />
        </div>
      </header>

      {message ? (
        <p className="standup-success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {hasLoaded && !todaysPlan ? (
        <div className="dashboard-empty no-plan-fallback">
          <strong>No Daily Plan exists for today.</strong>
          <p>
            Create a morning plan first, or complete a freeform postmortem with
            reflections only.
          </p>
          <Link className="command-button" href="/standup/morning">
            Create Morning Plan
          </Link>
        </div>
      ) : null}

      <div className="standup-mode-switch" aria-label="Postmortem mode">
        <button
          aria-label="Manual mode"
          aria-pressed={mode === "manual"}
          onClick={() => setMode("manual")}
          type="button"
        >
          Manual
        </button>
        <button
          aria-label="AI-assisted mode"
          aria-pressed={mode === "ai"}
          disabled={!hasLoaded}
          onClick={startAIMode}
          type="button"
        >
          AI Mode
        </button>
        <button
          aria-label="Voice Mode"
          aria-pressed={mode === "voice"}
          disabled={!hasLoaded}
          onClick={() => setMode("voice")}
          type="button"
        >
          Voice
        </button>
      </div>

      {mode === "voice" ? (
        <VoiceSessionPanel
          mode="evening"
          onFallbackToText={() => setMode("ai")}
          onTranscriptHandoff={handoffVoiceTranscript}
        />
      ) : mode === "ai" ? (
        <div className="standup-ai-layout">
          <section className="dashboard-section morning-ai-chat" aria-label="AI evening postmortem chat">
            <SectionHeader eyebrow="AI-assisted" title="Evening Review Chat" />
            {!isOnline ? <OfflineBoundary featureName="AI Evening Postmortem" /> : null}
            <div className="coach-message-list" aria-label="Evening AI transcript">
              {aiMessages.map((aiMessage) => (
                <article className={`coach-message coach-message-${aiMessage.role}`} key={aiMessage.id}>
                  <strong>{aiMessage.role === "user" ? "Patrick" : "Coach"}</strong>
                  <p>{aiMessage.content}</p>
                </article>
              ))}
              {isSendingAiMessage ? (
                <article className="coach-message coach-message-coach" aria-live="polite">
                  <strong>Coach</strong>
                  <p>Reviewing today&apos;s plan and stored context...</p>
                </article>
              ) : null}
            </div>
            <form className="coach-form" onSubmit={sendAIMessage}>
              <label>
                <span>Message</span>
                <textarea
                  onChange={(event) => setAiDraft(event.target.value)}
                  placeholder="I finished the main quest and learned..."
                  value={aiDraft}
                />
              </label>
              <button disabled={isSendingAiMessage || !aiDraft.trim() || !isOnline} type="submit">
                {isSendingAiMessage ? "Sending..." : "Send"}
              </button>
            </form>
          </section>

          <aside className="standup-ai-side">
            <section className="dashboard-section" aria-label="Today's plan context">
              <SectionHeader eyebrow="Context" title="Today's Plan" />
              {todaysPlan ? (
                <div className="standup-context-list">
                  {todaysPlan.mainQuestTaskId ? (
                    <article className="standup-context-task">
                      <strong>{taskTitle(todaysPlan.mainQuestTaskId)}</strong>
                      <span>Main Quest</span>
                    </article>
                  ) : null}
                  {todaysPlan.sideQuestTaskIds.map((taskId) => (
                    <article className="standup-context-task" key={taskId}>
                      <strong>{taskTitle(taskId)}</strong>
                      <span>Side Quest</span>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="quest-empty">No Daily Plan is stored for today.</p>
              )}
            </section>

            <section className="dashboard-section" aria-label="Reflection capture panel">
              <SectionHeader eyebrow="Capture" title="Reflection" />
              <div className="reflection-grid">
                <label>
                  <span>Wins</span>
                  <textarea
                    onChange={(event) => updateReflection("wins", event.target.value)}
                    value={reflection.wins}
                  />
                </label>
                <label>
                  <span>Friction</span>
                  <textarea
                    onChange={(event) => updateReflection("friction", event.target.value)}
                    value={reflection.friction}
                  />
                </label>
                <label>
                  <span>Lessons learned</span>
                  <textarea
                    onChange={(event) => updateReflection("lessonsLearned", event.target.value)}
                    value={reflection.lessonsLearned}
                  />
                </label>
                <label>
                  <span>Tomorrow follow-ups</span>
                  <textarea
                    onChange={(event) => updateReflection("tomorrowFollowUps", event.target.value)}
                    value={reflection.tomorrowFollowUps}
                  />
                </label>
              </div>
              <div className="standup-actions">
                <button onClick={savePostmortemData} type="button">
                  Save Postmortem & Close Plan
                </button>
                <button onClick={queueReportProposal} type="button">
                  Generate Report
                </button>
              </div>
            </section>

            {aiProposals.length > 0 ? (
              <section className="tool-proposal-list" aria-label="Proposed evening changes">
                <SectionHeader eyebrow="Review" title="Proposed Changes" />
                {aiProposals.map((proposal) => (
                  <article className="tool-proposal-card" key={proposal.id}>
                    <p className="tool-proposal-kicker">{proposal.toolName.replaceAll("_", " ")}</p>
                    <h3>{proposal.summary}</h3>
                    <p>Status: {proposal.status}</p>
                    <div className="tool-proposal-actions">
                      <button
                        disabled={proposal.status !== "pending"}
                        onClick={() => confirmAIProposal(proposal)}
                        type="button"
                      >
                        Confirm
                      </button>
                      <button
                        disabled={proposal.status !== "pending"}
                        onClick={() => rejectAIProposal(proposal)}
                        type="button"
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            ) : null}

            {currentReport ? (
              <section className="dashboard-section report-preview-section" aria-label="AI report preview">
                <SectionHeader eyebrow="Preview" title="Report Preview" />
                <pre className="markdown-preview">{currentReport.markdownContent}</pre>
              </section>
            ) : null}
          </aside>
        </div>
      ) : (
      <form className="standup-plan" onSubmit={savePostmortem}>
        <section className="dashboard-section" aria-label="Planned task outcomes">
          <SectionHeader eyebrow="Step 1" title="Planned Task Outcomes" />
          {!hasLoaded ? <p className="quest-empty">Loading postmortem...</p> : null}
          {hasLoaded && plannedTasks.length === 0 ? (
            <p className="quest-empty">No planned tasks to score tonight.</p>
          ) : null}
          <div className="outcome-list">
            {plannedTasks.map((task) => {
              const taskOutcome = taskOutcomes.find((outcome) => outcome.taskId === task.id);

              return (
                <article className="outcome-card" key={task.id}>
                  <div>
                    <h3>{task.title}</h3>
                    <p>{task.priority} priority</p>
                  </div>
                  <div className="outcome-controls">
                    {(["completed", "deferred", "left_open"] as TaskOutcome[]).map((outcome) => (
                      <label key={outcome}>
                        <input
                          checked={taskOutcome?.outcome === outcome}
                          name={`outcome-${task.id}`}
                          onChange={() => updateOutcome(task.id, outcome)}
                          type="radio"
                          value={outcome}
                        />
                        <span>{outcome.replace("_", " ")}</span>
                      </label>
                    ))}
                  </div>
                  <label className="outcome-note">
                    <span>Outcome Note</span>
                    <input
                      onChange={(event) => updateOutcomeNote(task.id, event.target.value)}
                      placeholder="Optional note"
                      type="text"
                      value={taskOutcome?.note ?? ""}
                    />
                  </label>
                </article>
              );
            })}
          </div>
        </section>

        <section className="dashboard-section" aria-label="Evening reflection">
          <SectionHeader eyebrow="Step 2" title="Reflection" />
          <div className="reflection-grid">
            <label>
              <span>Wins</span>
              <textarea
                onChange={(event) => updateReflection("wins", event.target.value)}
                value={reflection.wins}
              />
            </label>
            <label>
              <span>Friction</span>
              <textarea
                onChange={(event) => updateReflection("friction", event.target.value)}
                value={reflection.friction}
              />
            </label>
            <label>
              <span>Lessons learned</span>
              <textarea
                onChange={(event) => updateReflection("lessonsLearned", event.target.value)}
                value={reflection.lessonsLearned}
              />
            </label>
            <label>
              <span>Tomorrow follow-ups</span>
              <textarea
                onChange={(event) => updateReflection("tomorrowFollowUps", event.target.value)}
                value={reflection.tomorrowFollowUps}
              />
            </label>
          </div>
          <div className="standup-actions">
            <button type="submit">Save Postmortem</button>
            <Link className="command-button" href="/dashboard">
              Return to Dashboard
            </Link>
          </div>
        </section>
      </form>
      )}
    </section>
  );
}
