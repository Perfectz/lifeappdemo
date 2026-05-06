"use client";

import { type FormEvent, useEffect, useState } from "react";

import {
  confirmAIToolProposalLocally,
  sendAIChatRequest,
  type AIChatResponsePayload,
  type ConfirmToolResponsePayload
} from "@/client/pwaAIClient";
import { CharacterSprite } from "@/components/CharacterSprite";
import { OfflineBoundary, aiNetworkRequiredMessage, useNetworkStatus } from "@/components/OfflineBoundary";
import { SectionHeader } from "@/components/SectionHeader";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalDailyReportRepository } from "@/data/dailyReportRepository";
import { createLocalEveningPostmortemRepository } from "@/data/eveningPostmortemRepository";
import { createLocalJournalRepository } from "@/data/journalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import type { AIChatMode, AIStoredAppData, AIToolProposal } from "@/domain";

type ChatMessage = {
  id: string;
  role: "user" | "coach";
  content: string;
};

function loadStoredAppData(): AIStoredAppData {
  return {
    tasks: createLocalTaskRepository(window.localStorage).load(),
    dailyPlans: createLocalDailyPlanRepository(window.localStorage).load(),
    metricEntries: createLocalMetricRepository(window.localStorage).load(),
    journalEntries: createLocalJournalRepository(window.localStorage).load(),
    dailyReports: createLocalDailyReportRepository(window.localStorage).load()
  };
}

function createMessageId(role: ChatMessage["role"]): string {
  return `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function AICoachPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [proposals, setProposals] = useState<AIToolProposal[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [mode, setMode] = useState<AIChatMode>("general");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedContext, setUsedContext] = useState<AIChatResponsePayload["usedContext"]>();
  const [hasLoaded, setHasLoaded] = useState(false);
  const isOnline = useNetworkStatus();

  useEffect(() => {
    setMessages([
      {
        id: "coach-welcome",
        role: "coach",
        content:
          "Confirmation mode is active. I can propose task changes, but nothing changes until you confirm."
      }
    ]);
    setHasLoaded(true);
  }, []);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = messageDraft.trim();

    if (!trimmedMessage || isSending) {
      return;
    }

    if (!navigator.onLine) {
      setError(aiNetworkRequiredMessage);
      return;
    }

    const userMessage: ChatMessage = {
      id: createMessageId("user"),
      role: "user",
      content: trimmedMessage
    };

    setMessages((current) => [...current, userMessage]);
    setMessageDraft("");
    setError(null);
    setIsSending(true);

    try {
      const payload = await sendAIChatRequest({
        message: trimmedMessage,
        mode,
        appData: loadStoredAppData()
      }, window.localStorage);

      if (!payload.message) {
        throw new Error(payload.error ?? "AI coach is unavailable right now.");
      }

      setMessages((current) => [
        ...current,
        {
          id: createMessageId("coach"),
          role: "coach",
          content: payload.message ?? ""
        }
      ]);
      setProposals((current) => [...current, ...(payload.proposals ?? [])]);
      setUsedContext(payload.usedContext);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "AI coach is unavailable right now."
      );
    } finally {
      setIsSending(false);
    }
  }

  function updateProposal(proposalId: string, status: AIToolProposal["status"]) {
    setProposals((current) =>
      current.map((proposal) =>
        proposal.id === proposalId
          ? { ...proposal, status, updatedAt: new Date().toISOString() }
          : proposal
      )
    );
  }

  function rejectProposal(proposal: AIToolProposal) {
    updateProposal(proposal.id, "rejected");
    setMessages((current) => [
      ...current,
      {
        id: createMessageId("coach"),
        role: "coach",
        content: `Rejected proposal: ${proposal.summary}`
      }
    ]);
  }

  async function confirmProposal(proposal: AIToolProposal) {
    updateProposal(proposal.id, "confirmed");
    setError(null);

    try {
      const tasks = createLocalTaskRepository(window.localStorage).load();
      const dailyPlans = createLocalDailyPlanRepository(window.localStorage).load();
      const dailyReports = createLocalDailyReportRepository(window.localStorage).load();
      const eveningPostmortems =
        createLocalEveningPostmortemRepository(window.localStorage).load();
      const metricEntries = createLocalMetricRepository(window.localStorage).load();
      const journalEntries = createLocalJournalRepository(window.localStorage).load();
      const payload: ConfirmToolResponsePayload = confirmAIToolProposalLocally({
        proposal,
        dailyPlans,
        dailyReports,
        eveningPostmortems,
        journalEntries,
        metricEntries,
        tasks
      });

      if (!payload.ok || !payload.appliedChangeSummary) {
        throw new Error(payload.error ?? "Tool proposal could not be applied.");
      }

      if (payload.tasks) {
        createLocalTaskRepository(window.localStorage).save(payload.tasks);
      }
      if (payload.dailyPlans) {
        createLocalDailyPlanRepository(window.localStorage).save(payload.dailyPlans);
      }
      if (payload.dailyReports) {
        createLocalDailyReportRepository(window.localStorage).save(payload.dailyReports);
      }
      if (payload.metricEntries) {
        createLocalMetricRepository(window.localStorage).save(payload.metricEntries);
      }
      if (payload.journalEntries) {
        createLocalJournalRepository(window.localStorage).save(payload.journalEntries);
      }
      updateProposal(proposal.id, "applied");
      setMessages((current) => [
        ...current,
        {
          id: createMessageId("coach"),
          role: "coach",
          content: `Applied change: ${payload.appliedChangeSummary}`
        }
      ]);
    } catch (confirmError) {
      updateProposal(proposal.id, "failed");
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "Tool proposal could not be applied."
      );
    }
  }

  function formatToolName(toolName: AIToolProposal["toolName"]): string {
    return toolName.replace("_", " ");
  }

  function formatProposalDetails(proposal: AIToolProposal): string {
    if (proposal.toolName === "log_metric" && proposal.payload && typeof proposal.payload === "object") {
      const payload = proposal.payload as Record<string, unknown>;
      return [
        payload.date,
        payload.checkInType,
        payload.sleepHours !== undefined ? `sleep ${payload.sleepHours}h` : undefined,
        payload.energyLevel !== undefined ? `energy ${payload.energyLevel}/5` : undefined,
        payload.moodLevel !== undefined ? `mood ${payload.moodLevel}/5` : undefined,
        payload.steps !== undefined ? `${payload.steps} steps` : undefined
      ].filter(Boolean).join(" | ");
    }

    if (
      proposal.toolName === "create_journal_entry" &&
      proposal.payload &&
      typeof proposal.payload === "object"
    ) {
      const payload = proposal.payload as Record<string, unknown>;
      return `${payload.type ?? "journal"}: ${payload.content ?? ""}`;
    }

    if (
      proposal.toolName === "propose_daily_plan" &&
      proposal.payload &&
      typeof proposal.payload === "object"
    ) {
      const payload = proposal.payload as Record<string, unknown>;
      const sideQuests = Array.isArray(payload.sideQuestTaskIds)
        ? payload.sideQuestTaskIds.length
        : 0;
      return [
        payload.date,
        payload.mainQuestTaskId ? `main ${payload.mainQuestTaskId}` : undefined,
        `${sideQuests} side quest${sideQuests === 1 ? "" : "s"}`,
        payload.rationale
      ].filter(Boolean).join(" | ");
    }

    if (
      proposal.toolName === "generate_daily_report" &&
      proposal.payload &&
      typeof proposal.payload === "object"
    ) {
      const payload = proposal.payload as Record<string, unknown>;
      return [
        payload.date,
        payload.style,
        payload.includeLinkedInSourceMaterial ? "LinkedIn source included" : "LinkedIn source excluded"
      ].filter(Boolean).join(" | ");
    }

    return "";
  }

  return (
    <section className="coach-page" aria-labelledby="coach-title">
      <header className="coach-hero">
        <div>
          <p className="eyebrow">Confirmation coach mode</p>
          <h1 id="coach-title">AI Coach</h1>
          <p>Ask for task help, then review proposed changes before anything is applied.</p>
        </div>
        <div className="page-sprite-frame coach-sprite" aria-hidden="true">
          <CharacterSprite className="page-sprite" pose="thinking" />
        </div>
      </header>

      <div className="coach-layout">
        <section className="dashboard-section coach-chat-panel" aria-label="AI coach chat">
          <SectionHeader eyebrow="Conversation" title="Coach Chat" />
          <p className="coach-mode-label">Task changes require confirmation</p>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {!isOnline ? <OfflineBoundary featureName="AI Coach" /> : null}

          <div className="coach-message-list" aria-label="Chat transcript">
            {!hasLoaded ? <p className="quest-empty">Loading coach...</p> : null}
            {messages.map((message) => (
              <article className={`coach-message coach-message-${message.role}`} key={message.id}>
                <strong>{message.role === "user" ? "Patrick" : "Coach"}</strong>
                <p>{message.content}</p>
              </article>
            ))}
            {isSending ? (
              <article className="coach-message coach-message-coach" aria-live="polite">
                <strong>Coach</strong>
                <p>Thinking with read-only context...</p>
              </article>
            ) : null}
          </div>

          <form className="coach-form" onSubmit={sendMessage}>
            <label>
              <span>Mode</span>
              <select
                onChange={(event) => setMode(event.target.value as AIChatMode)}
                value={mode}
              >
                <option value="general">general</option>
                <option value="morning">morning</option>
                <option value="evening">evening</option>
                <option value="report">report</option>
              </select>
            </label>
            <label>
              <span>Message</span>
              <textarea
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="What should I focus on today?"
                value={messageDraft}
              />
            </label>
            <button disabled={isSending || !messageDraft.trim()} type="submit">
              {isSending ? "Sending..." : "Send"}
            </button>
          </form>

          {proposals.length > 0 ? (
            <section className="tool-proposal-list" aria-label="Proposed actions">
              <SectionHeader eyebrow="Review" title="Proposed Actions" />
              {proposals.map((proposal) => (
                <article className="tool-proposal-card" key={proposal.id}>
                  <div>
                    <p className="tool-proposal-kicker">{formatToolName(proposal.toolName)}</p>
                    <h3>{proposal.summary}</h3>
                    {formatProposalDetails(proposal) ? (
                      <p>{formatProposalDetails(proposal)}</p>
                    ) : null}
                    <p>Status: {proposal.status}</p>
                  </div>
                  <div className="tool-proposal-actions">
                    <button
                      disabled={proposal.status !== "pending"}
                      onClick={() => confirmProposal(proposal)}
                      type="button"
                    >
                      Confirm
                    </button>
                    <button
                      disabled={proposal.status !== "pending"}
                      onClick={() => rejectProposal(proposal)}
                      type="button"
                    >
                      Reject
                    </button>
                  </div>
                </article>
              ))}
            </section>
          ) : null}
        </section>

        <aside className="dashboard-section coach-context-panel" aria-label="Context usage">
          <SectionHeader eyebrow="Boundary" title="Confirmation Required" />
          <p>
            The coach can reference open tasks, today&apos;s plan, recent metrics, recent journal
            entries, and the latest report. Task changes appear as proposals and require Confirm.
            Reject dismisses a proposal without changing data.
          </p>
          <dl className="coach-context-stats">
            <div>
              <dt>Open tasks used</dt>
              <dd>{usedContext?.openTaskCount ?? 0}</dd>
            </div>
            <div>
              <dt>Metrics used</dt>
              <dd>{usedContext?.recentMetricCount ?? 0}</dd>
            </div>
            <div>
              <dt>Journal entries used</dt>
              <dd>{usedContext?.recentJournalEntryCount ?? 0}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
