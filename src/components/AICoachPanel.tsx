"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

import {
  confirmAIToolProposal,
  sendAIChatRequest,
  type AIChatResponse
} from "@/client/aiApiClient";
import { createClientId } from "@/client/clientIds";
import { fileToDownscaledDataUrl } from "@/client/imageDownscale";
import { persistAIToolResult } from "@/client/persistAIToolResult";
import { readProfile } from "@/client/profile";
import { loadStoredAppData } from "@/client/storedAppData";
import { useHeroName } from "@/client/useHeroName";
import { executeVoiceTool } from "@/client/voiceTools";
import { parseVisionResult, type VisionProposal } from "@/domain/visionUpdates";
import { CharacterSprite } from "@/components/CharacterSprite";
import { OfflineBoundary, aiNetworkRequiredMessage, useNetworkStatus } from "@/components/OfflineBoundary";
import { SectionHeader } from "@/components/SectionHeader";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalDailyReportRepository } from "@/data/dailyReportRepository";
import { createLocalEveningPostmortemRepository } from "@/data/eveningPostmortemRepository";
import { createLocalJournalRepository } from "@/data/journalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import type { AIChatMode, AIToolProposal } from "@/domain";

type ChatMessage = {
  id: string;
  role: "user" | "coach";
  content: string;
  imageDataUrl?: string;
};

type VisionProposalCard = VisionProposal & {
  id: string;
  status: "pending" | "applied" | "dismissed";
};

function createMessageId(role: ChatMessage["role"]): string {
  return createClientId(role);
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function AICoachPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [proposals, setProposals] = useState<AIToolProposal[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [mode, setMode] = useState<AIChatMode>("general");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedContext, setUsedContext] = useState<AIChatResponse["usedContext"]>();
  const [hasLoaded, setHasLoaded] = useState(false);
  const [visionProposals, setVisionProposals] = useState<VisionProposalCard[]>([]);
  const [listening, setListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const isOnline = useNetworkStatus();
  const heroName = useHeroName();
  const speechSupported = getSpeechRecognitionCtor() !== null;

  useEffect(() => {
    setMessages([
      {
        id: "coach-welcome",
        role: "coach",
        content:
          "Hi — talk, type, or share a photo (steps, a BP reading, a meal). I'll propose updates; nothing changes until you confirm."
      }
    ]);
    setHasLoaded(true);
  }, []);

  async function handlePhoto(file: File) {
    if (!navigator.onLine) {
      setError(aiNetworkRequiredMessage);
      return;
    }
    setError(null);
    let dataUrl: string;
    try {
      dataUrl = await fileToDownscaledDataUrl(file);
    } catch {
      setError("Couldn't read that image.");
      return;
    }

    const note = messageDraft.trim();
    setMessages((current) => [
      ...current,
      { id: createMessageId("user"), role: "user", content: note || "Shared a photo", imageDataUrl: dataUrl }
    ]);
    setMessageDraft("");
    setIsSending(true);

    try {
      const response = await fetch("/api/ai/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, context: note || undefined })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Couldn't analyze that photo.");
      const result = parseVisionResult(data);
      setMessages((current) => [
        ...current,
        {
          id: createMessageId("coach"),
          role: "coach",
          content: result.question ? `${result.summary} ${result.question}` : result.summary
        }
      ]);
      setVisionProposals((current) => [
        ...current,
        ...result.proposals.map((proposal) => ({
          ...proposal,
          id: createClientId("vision"),
          status: "pending" as const
        }))
      ]);
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : "Photo analysis failed.");
    } finally {
      setIsSending(false);
    }
  }

  function applyVisionProposal(card: VisionProposalCard) {
    const outcome = executeVoiceTool(card.tool, card.args);
    setVisionProposals((current) =>
      current.map((proposal) =>
        proposal.id === card.id
          ? { ...proposal, status: outcome.ok ? "applied" : "pending" }
          : proposal
      )
    );
    setMessages((current) => [
      ...current,
      { id: createMessageId("coach"), role: "coach", content: outcome.message }
    ]);
    if (!outcome.ok) setError(outcome.message);
  }

  function dismissVisionProposal(card: VisionProposalCard) {
    setVisionProposals((current) =>
      current.map((proposal) =>
        proposal.id === card.id ? { ...proposal, status: "dismissed" } : proposal
      )
    );
  }

  function toggleDictation() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setMessageDraft((prev) => (prev ? `${prev} ${transcript}` : transcript).trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }

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
        appData: loadStoredAppData(window.localStorage),
        heroName: readProfile(window.localStorage).heroName
      });

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
      const payload = await confirmAIToolProposal({
        proposal,
        dailyPlans,
        dailyReports,
        eveningPostmortems,
        journalEntries,
        metricEntries,
        tasks
      });

      persistAIToolResult(window.localStorage, payload);
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
        payload.steps !== undefined ? `${payload.steps} steps` : undefined,
        payload.kettlebellSwingsTotal !== undefined
          ? `${payload.kettlebellSwingsTotal} kettlebell swings`
          : undefined,
        payload.karateClass ? "karate class" : undefined,
        payload.distanceWalkedMiles !== undefined
          ? `${payload.distanceWalkedMiles} mi walked`
          : undefined
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
          <p>Chat, talk, or share a photo — review proposed changes before anything is applied.</p>
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
                <strong>{message.role === "user" ? heroName : "Coach"}</strong>
                {message.imageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="coach-message-image" src={message.imageDataUrl} alt="Shared upload" />
                ) : null}
                {message.content ? <p>{message.content}</p> : null}
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
                placeholder="Type, talk, or attach a photo…"
                value={messageDraft}
              />
            </label>
            <div className="coach-composer-actions">
              <button
                type="button"
                className="coach-icon-btn"
                aria-label="Attach a photo"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending}
              >
                📎
              </button>
              {speechSupported ? (
                <button
                  type="button"
                  className={listening ? "coach-icon-btn coach-icon-on" : "coach-icon-btn"}
                  aria-label={listening ? "Stop dictation" : "Dictate your message"}
                  aria-pressed={listening}
                  onClick={toggleDictation}
                  disabled={isSending}
                >
                  🎙️
                </button>
              ) : null}
              <button disabled={isSending || !messageDraft.trim()} type="submit">
                {isSending ? "Sending..." : "Send"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="visually-hidden"
                aria-label="Attach a photo"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handlePhoto(file);
                  event.target.value = "";
                }}
              />
            </div>
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

          {visionProposals.some((card) => card.status !== "dismissed") ? (
            <section className="tool-proposal-list" aria-label="Updates from your photo">
              <SectionHeader eyebrow="From your photo" title="Proposed Updates" />
              {visionProposals
                .filter((card) => card.status !== "dismissed")
                .map((card) => (
                  <article className="tool-proposal-card" key={card.id}>
                    <div>
                      <h3>{card.label}</h3>
                      <p>Status: {card.status}</p>
                    </div>
                    <div className="tool-proposal-actions">
                      <button
                        disabled={card.status !== "pending"}
                        onClick={() => applyVisionProposal(card)}
                        type="button"
                      >
                        Apply
                      </button>
                      <button
                        disabled={card.status !== "pending"}
                        onClick={() => dismissVisionProposal(card)}
                        type="button"
                      >
                        Dismiss
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
