"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  confirmAIToolProposal,
  sendAIChatRequest,
  type AIChatResponse
} from "@/client/aiApiClient";
import { createClientId } from "@/client/clientIds";
import { loadStoredAppData } from "@/client/storedAppData";
import { AiAdvisorPopup, type AdvisorMood } from "@/components/AiAdvisorPopup";
import { CharacterSprite } from "@/components/CharacterSprite";
import { CommandButton } from "@/components/CommandButton";
import { OfflineBoundary, aiNetworkRequiredMessage, useNetworkStatus } from "@/components/OfflineBoundary";
import { SectionHeader } from "@/components/SectionHeader";
import { VoiceSessionPanel } from "@/components/VoiceSessionPanel";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalJournalRepository } from "@/data/journalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import type { AIToolProposal, DailyPlan, JournalEntry, MetricEntry, Task } from "@/domain";
import { getActiveDailyPlanForDate, upsertDailyPlanForDate, validateDailyPlanInput } from "@/domain/dailyPlans";
import { toLocalIsoDate } from "@/domain/dates";
import { createTask } from "@/domain/tasks";

const maxSideQuests = 3;

type MorningMode = "manual" | "ai" | "voice";

type ChatMessage = {
  id: string;
  role: "user" | "coach";
  content: string;
};

function createMessageId(role: ChatMessage["role"]): string {
  return createClientId(role);
}

export function MorningStandup() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [metricEntries, setMetricEntries] = useState<MetricEntry[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [mode, setMode] = useState<MorningMode>("manual");
  const [mainQuestTaskId, setMainQuestTaskId] = useState("");
  const [sideQuestTaskIds, setSideQuestTaskIds] = useState<string[]>([]);
  const [intention, setIntention] = useState("");
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [aiProposals, setAiProposals] = useState<AIToolProposal[]>([]);
  const [aiDraft, setAiDraft] = useState("");
  const [isSendingAiMessage, setIsSendingAiMessage] = useState(false);
  const isOnline = useNetworkStatus();
  const today = toLocalIsoDate();

  const activeTasks = useMemo(() => tasks.filter((task) => task.status === "todo"), [tasks]);
  const todaysPlan = useMemo(() => getActiveDailyPlanForDate(plans, today), [plans, today]);
  const selectedMainQuest = useMemo(
    () => activeTasks.find((task) => task.id === mainQuestTaskId),
    [activeTasks, mainQuestTaskId]
  );
  const advisorMood: AdvisorMood = error
    ? "concerned"
    : message
      ? "victory"
      : selectedMainQuest
        ? "determined"
        : activeTasks.length > 0
          ? "thoughtful"
          : "supportive";
  const advisorMessage = error
    ? "A rule is blocking the plan. Fix that one thing, then lock in the day."
    : message
      ? "Plan confirmed. Start with the smallest visible action on your Main Quest."
      : selectedMainQuest
        ? `Good anchor: ${selectedMainQuest.title}. Keep side quests lighter than the Main Quest.`
        : activeTasks.length > 0
          ? "Choose the one quest that protects the day. Everything else is support."
          : "Capture one quick quest first, then choose a Main Quest from the list.";

  useEffect(() => {
    const taskRepository = createLocalTaskRepository(window.localStorage);
    const planRepository = createLocalDailyPlanRepository(window.localStorage);
    const loadedTasks = taskRepository.load();
    const loadedPlans = planRepository.load();
    const existingPlan = getActiveDailyPlanForDate(loadedPlans, today);

    setTasks(loadedTasks);
    setPlans(loadedPlans);
    setMetricEntries(createLocalMetricRepository(window.localStorage).load());
    setJournalEntries(createLocalJournalRepository(window.localStorage).load());
    setMainQuestTaskId(existingPlan?.mainQuestTaskId ?? "");
    setSideQuestTaskIds(existingPlan?.sideQuestTaskIds ?? []);
    setIntention(existingPlan?.intention ?? "");
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

  function chooseMainQuest(taskId: string) {
    setMainQuestTaskId(taskId);
    setSideQuestTaskIds((current) => current.filter((sideQuestTaskId) => sideQuestTaskId !== taskId));
    setMessage(null);
    setError(null);
  }

  function toggleSideQuest(taskId: string) {
    setMessage(null);
    setError(null);

    setSideQuestTaskIds((current) => {
      if (current.includes(taskId)) {
        return current.filter((sideQuestTaskId) => sideQuestTaskId !== taskId);
      }

      if (taskId === mainQuestTaskId) {
        setError("Main Quest cannot also be a Side Quest.");
        return current;
      }

      if (current.length >= maxSideQuests) {
        setError("Choose up to three Side Quests.");
        return current;
      }

      return [...current, taskId];
    });
  }

  function createQuickTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = quickTaskTitle.trim();

    if (!title) {
      setError("Quick task title is required.");
      return;
    }

    const task = createTask({
      title,
      priority: "medium",
      tags: [],
      plannedForDate: today
    });

    setTasks((current) => [task, ...current]);
    setQuickTaskTitle("");
    setMessage("Quick quest added to planning options.");
    setError(null);
  }

  function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!mainQuestTaskId) {
      setError("Choose one Main Quest.");
      return;
    }

    const input = {
      date: today,
      mainQuestTaskId,
      sideQuestTaskIds,
      intention
    };
    const validation = validateDailyPlanInput(input, tasks);

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    const nextPlans = upsertDailyPlanForDate(plans, validation.value, tasks);
    setPlans(nextPlans);
    setError(null);
    setMessage("Today's quest plan is locked in.");
  }

  function startAIMode() {
    setMode("ai");
    setError(null);
    setMessage(null);

    if (aiMessages.length === 0) {
      setAiMessages([
        {
          id: "morning-ai-welcome",
          role: "coach",
          content: `Good morning. I see ${activeTasks.length} open quests and ${metricEntries.length} recent metric entries. What is the one outcome that would make today successful?`
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
      const payload: AIChatResponse = await sendAIChatRequest({
        message: trimmedMessage,
        mode: "morning",
        appData: loadStoredAppData(window.localStorage)
      });

      setAiMessages((current) => [
        ...current,
        { id: createMessageId("coach"), role: "coach", content: payload.message ?? "" }
      ]);
      setAiProposals((current) => [...current, ...(payload.proposals ?? [])]);
    } catch (aiError) {
      setError(
        aiError instanceof Error
          ? aiError.message
          : "AI morning stand-up is unavailable right now."
      );
    } finally {
      setIsSendingAiMessage(false);
    }
  }

  async function confirmAIProposal(proposal: AIToolProposal) {
    updateAIProposal(proposal.id, "confirmed");
    setError(null);

    try {
      const payload = await confirmAIToolProposal({
        proposal,
        dailyPlans: plans,
        dailyReports: [],
        eveningPostmortems: [],
        journalEntries,
        metricEntries,
        tasks
      });

      if (payload.tasks) {
        createLocalTaskRepository(window.localStorage).save(payload.tasks);
        setTasks(payload.tasks);
      }
      if (payload.dailyPlans) {
        createLocalDailyPlanRepository(window.localStorage).save(payload.dailyPlans);
        setPlans(payload.dailyPlans);
        const nextPlan = getActiveDailyPlanForDate(payload.dailyPlans, today);
        setMainQuestTaskId(nextPlan?.mainQuestTaskId ?? "");
        setSideQuestTaskIds(nextPlan?.sideQuestTaskIds ?? []);
        setIntention(nextPlan?.intention ?? "");
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
      setMessage(
        proposal.toolName === "propose_daily_plan"
          ? "AI Daily Plan confirmed."
          : "AI proposal confirmed."
      );
    } catch (confirmError) {
      updateAIProposal(proposal.id, "failed");
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "AI proposal could not be applied."
      );
    }
  }

  function taskTitle(taskId: string | undefined): string {
    if (!taskId) {
      return "None";
    }

    return tasks.find((task) => task.id === taskId)?.title ?? taskId;
  }

  return (
    <section className="standup-page" aria-labelledby="morning-standup-title">
      <header className="standup-hero">
        <div>
          <p className="eyebrow">Daily Planning</p>
          <h1 id="morning-standup-title">Morning Stand-Up</h1>
          <p>
            Choose one Main Quest, up to three Side Quests, and a short intention
            before the day starts moving.
          </p>
        </div>
        <div className="page-sprite-frame standup-sprite" aria-hidden="true">
          <CharacterSprite className="page-sprite" pose="walkFrontOne" />
        </div>
      </header>

      {hasLoaded && todaysPlan ? (
        <p className="standup-notice">Edit today&apos;s plan.</p>
      ) : null}
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

      <AiAdvisorPopup message={advisorMessage} mood={advisorMood} />

      <div className="standup-mode-switch" aria-label="Stand-up mode">
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
          mode="morning"
          onFallbackToText={() => setMode("ai")}
          onTranscriptHandoff={handoffVoiceTranscript}
        />
      ) : mode === "ai" ? (
        <div className="standup-ai-layout">
          <section className="dashboard-section morning-ai-chat" aria-label="AI morning stand-up chat">
            <SectionHeader eyebrow="AI-assisted" title="Morning Planning Chat" />
            {!isOnline ? <OfflineBoundary featureName="AI Morning Stand-Up" /> : null}
            <div className="coach-message-list" aria-label="Morning AI transcript">
              {aiMessages.map((aiMessage) => (
                <article className={`coach-message coach-message-${aiMessage.role}`} key={aiMessage.id}>
                  <strong>{aiMessage.role === "user" ? "Patrick" : "Coach"}</strong>
                  <p>{aiMessage.content}</p>
                </article>
              ))}
              {isSendingAiMessage ? (
                <article className="coach-message coach-message-coach" aria-live="polite">
                  <strong>Coach</strong>
                  <p>Reviewing today&apos;s context...</p>
                </article>
              ) : null}
            </div>
            <form className="coach-form" onSubmit={sendAIMessage}>
              <label>
                <span>Message</span>
                <textarea
                  onChange={(event) => setAiDraft(event.target.value)}
                  placeholder="What should I prioritize today?"
                  value={aiDraft}
                />
              </label>
              <button disabled={isSendingAiMessage || !aiDraft.trim()} type="submit">
                {isSendingAiMessage ? "Sending..." : "Send"}
              </button>
            </form>
          </section>

          <aside className="standup-ai-side">
            <section className="dashboard-section" aria-label="Open task context">
              <SectionHeader eyebrow="Context" title="Open Quests" />
              {activeTasks.length > 0 ? (
                <div className="standup-context-list">
                  {activeTasks.map((task) => (
                    <article className="standup-context-task" key={task.id}>
                      <strong>{task.title}</strong>
                      <span>{task.priority} priority</span>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="quest-empty">No open quests yet.</p>
              )}
            </section>

            {aiProposals.filter((proposal) => proposal.toolName === "propose_daily_plan").map((proposal) => {
              const payload = proposal.payload as {
                date: string;
                mainQuestTaskId?: string;
                sideQuestTaskIds: string[];
                intention?: string;
                rationale?: string;
              };

              return (
                <section className="tool-proposal-card proposed-plan-card" key={proposal.id} aria-label="Proposed plan card">
                  <p className="tool-proposal-kicker">proposed daily plan</p>
                  <h3>{proposal.summary}</h3>
                  <dl className="proposed-plan-details">
                    <div>
                      <dt>Main Quest</dt>
                      <dd>{taskTitle(payload.mainQuestTaskId)}</dd>
                    </div>
                    <div>
                      <dt>Side Quests</dt>
                      <dd>
                        {payload.sideQuestTaskIds.length > 0
                          ? payload.sideQuestTaskIds.map((taskId) => taskTitle(taskId)).join(", ")
                          : "None"}
                      </dd>
                    </div>
                    {payload.intention ? (
                      <div>
                        <dt>Intention</dt>
                        <dd>{payload.intention}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Rationale</dt>
                      <dd>{payload.rationale}</dd>
                    </div>
                  </dl>
                  <p>Status: {proposal.status}</p>
                  <div className="tool-proposal-actions">
                    <button
                      disabled={proposal.status !== "pending"}
                      onClick={() => confirmAIProposal(proposal)}
                      type="button"
                    >
                      Confirm Plan
                    </button>
                    <button
                      disabled={proposal.status !== "pending"}
                      onClick={() => rejectAIProposal(proposal)}
                      type="button"
                    >
                      Reject
                    </button>
                    <button onClick={() => setMode("manual")} type="button">
                      Edit manually
                    </button>
                  </div>
                </section>
              );
            })}

            {aiProposals.filter((proposal) => proposal.toolName !== "propose_daily_plan").map((proposal) => (
              <section className="tool-proposal-card" key={proposal.id}>
                <p className="tool-proposal-kicker">{proposal.toolName.replace("_", " ")}</p>
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
              </section>
            ))}
          </aside>
        </div>
      ) : (
      <div className="standup-layout">
        <section className="dashboard-section" aria-label="Quick task creation">
          <SectionHeader eyebrow="Capture" title="Add Quick Quest" />
          {hasLoaded && activeTasks.length === 0 ? (
            <p className="quest-empty quest-empty-callout">No open tasks yet. Create one to start planning.</p>
          ) : null}
          <form className="quick-task-form" onSubmit={createQuickTask}>
            <label>
              <span>Quick Quest</span>
              <input
                onChange={(event) => setQuickTaskTitle(event.target.value)}
                placeholder="Capture a task for today"
                type="text"
                value={quickTaskTitle}
              />
            </label>
            <button type="submit">Add Quick Quest</button>
          </form>
        </section>

        <form className="standup-plan" onSubmit={savePlan}>
          <section className="dashboard-section" aria-label="Main Quest selection">
            <SectionHeader eyebrow="Step 1" title="Main Quest" />
            {!hasLoaded ? <p className="quest-empty">Loading active quests...</p> : null}
            {hasLoaded && activeTasks.length > 0 ? (
              <div className="plan-options">
                {activeTasks.map((task) => (
                  <label className="plan-option" key={task.id}>
                    <input
                      checked={mainQuestTaskId === task.id}
                      name="mainQuest"
                      onChange={() => chooseMainQuest(task.id)}
                      type="radio"
                      value={task.id}
                    />
                    <span>
                      <strong>{task.title}</strong>
                      <small>
                        <span className={`priority-gem priority-gem-${task.priority}`} aria-hidden="true" />
                        {task.priority} priority
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </section>

          <section className="dashboard-section" aria-label="Side Quest selection">
            <SectionHeader eyebrow="Step 2" title="Side Quests" />
            <p className="standup-helper">Choose up to three Side Quests.</p>
            <div className="plan-options">
              {activeTasks.map((task) => (
                <label className="plan-option" key={task.id}>
                  <input
                    checked={sideQuestTaskIds.includes(task.id)}
                    disabled={task.id === mainQuestTaskId}
                    onChange={() => toggleSideQuest(task.id)}
                    type="checkbox"
                  />
                  <span>
                    <strong>{task.title}</strong>
                    <small>
                      <span className={`priority-gem priority-gem-${task.priority}`} aria-hidden="true" />
                      {task.id === mainQuestTaskId ? "Already selected as Main Quest" : "Optional side quest"}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="dashboard-section" aria-label="Daily intention">
            <SectionHeader eyebrow="Step 3" title="Daily Intention" />
            <label className="intention-field">
              <span>Intention</span>
              <textarea
                onChange={(event) => setIntention(event.target.value)}
                placeholder="What matters most today?"
                value={intention}
              />
            </label>
            <div className="standup-actions">
              <button type="submit">Save Daily Plan</button>
              <CommandButton href="/dashboard" icon="dashboard">
                Return to Dashboard
              </CommandButton>
            </div>
          </section>
        </form>
      </div>
      )}
    </section>
  );
}
