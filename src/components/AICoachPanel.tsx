"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  confirmAIToolProposal,
  sendAIChatRequest
} from "@/client/aiApiClient";
import { createClientId } from "@/client/clientIds";
import { fileToDownscaledDataUrl } from "@/client/imageDownscale";
import { loadWiki } from "@/data/wikiRepository";
import { formatWikiForPrompt } from "@/domain/personalWiki";
import { createLocalMemoryRepository } from "@/data/memoryRepository";
import { formatMemoriesForPrompt, isMemoryCategory, upsertMemory } from "@/domain/memory";
import { persistAIToolResult } from "@/client/persistAIToolResult";
import { readProfile } from "@/client/profile";
import { loadStoredAppData } from "@/client/storedAppData";
import { useHeroName } from "@/client/useHeroName";
import { executeVoiceTool } from "@/client/voiceTools";
import { isCoachActionTool } from "@/domain/coachActions";
import { parseVisionResult, type VisionProposal } from "@/domain/visionUpdates";
import { OfflineBoundary, aiNetworkRequiredMessage, useNetworkStatus } from "@/components/OfflineBoundary";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalDailyReportRepository } from "@/data/dailyReportRepository";
import { createLocalJournalRepository } from "@/data/journalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import { createLocalChatThreadRepository } from "@/data/chatThreadRepository";
import {
  deriveThreadTitle,
  removeThread,
  sortThreadsByRecent,
  upsertThread,
  type ChatMessageRecord,
  type ChatThread
} from "@/domain/chat";
import type { AIToolProposal } from "@/domain";

type ChatMessage = {
  id: string;
  role: "user" | "coach";
  content: string;
  imageDataUrl?: string;
  proposals?: AIToolProposal[];
  visionProposals?: VisionProposalCard[];
};

type VisionProposalCard = VisionProposal & {
  id: string;
  status: "pending" | "applied" | "dismissed";
};

const WELCOME_ID = "coach-welcome";
const WELCOME_TEXT =
  "Hey — I'm your coach. Ask me anything, talk it through, or share a photo (a meal, a BP reading, your steps). I can also log things for you — I'll show the change and you confirm before it saves.";

function welcomeMessage(): ChatMessage {
  return { id: WELCOME_ID, role: "coach", content: WELCOME_TEXT };
}

function createMessageId(role: ChatMessage["role"]): string {
  return createClientId(role);
}

/** Restore a saved thread's text records into renderable chat messages. */
function messagesFromThread(thread: ChatThread): ChatMessage[] {
  return [welcomeMessage(), ...thread.messages.map((record) => ({ ...record }))];
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

function proposalDetails(proposal: AIToolProposal): string {
  const payload =
    proposal.payload && typeof proposal.payload === "object"
      ? (proposal.payload as Record<string, unknown>)
      : {};
  if (proposal.toolName === "log_metric") {
    return [
      payload.date,
      payload.checkInType,
      payload.sleepHours !== undefined ? `sleep ${payload.sleepHours}h` : undefined,
      payload.energyLevel !== undefined ? `energy ${payload.energyLevel}/5` : undefined,
      payload.steps !== undefined ? `${payload.steps} steps` : undefined,
      payload.weightLbs !== undefined ? `${payload.weightLbs} lb` : undefined,
      payload.bloodPressureSystolic !== undefined
        ? `BP ${payload.bloodPressureSystolic}/${payload.bloodPressureDiastolic ?? "?"}`
        : undefined,
      payload.bloodGlucoseMgDl !== undefined ? `glucose ${payload.bloodGlucoseMgDl}` : undefined
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (proposal.toolName === "create_journal_entry") {
    return `${payload.type ?? "journal"}: ${payload.content ?? ""}`;
  }
  if (proposal.toolName === "propose_daily_plan") {
    const sideQuests = Array.isArray(payload.sideQuestTaskIds) ? payload.sideQuestTaskIds.length : 0;
    return [payload.date, `${sideQuests} side quest${sideQuests === 1 ? "" : "s"}`, payload.rationale]
      .filter(Boolean)
      .join(" · ");
  }
  if (proposal.toolName === "generate_daily_report") {
    return [payload.date, payload.style].filter(Boolean).join(" · ");
  }
  if (proposal.toolName === "save_memory") {
    return [payload.key, payload.content].filter(Boolean).join(": ");
  }
  if (isCoachActionTool(proposal.toolName)) {
    return Object.entries(payload)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => `${key}: ${value}`)
      .join(" · ");
  }
  return "";
}

export function AICoachPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage()]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [threadSearch, setThreadSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const createdAtRef = useRef<string | null>(null);
  // True only when messages changed through a user action (send, photo,
  // proposal apply) — loading or reopening a thread must not re-save it.
  const dirtyRef = useRef(false);
  const isOnline = useNetworkStatus();
  const heroName = useHeroName();
  const speechSupported = useMemo(() => getSpeechRecognitionCtor() !== null, []);

  // Load saved threads on mount and reopen the most recent conversation.
  useEffect(() => {
    const saved = sortThreadsByRecent(
      createLocalChatThreadRepository(window.localStorage).load()
    );
    setThreads(saved);
    if (saved.length > 0) {
      activeIdRef.current = saved[0].id;
      createdAtRef.current = saved[0].createdAt;
      setMessages(messagesFromThread(saved[0]));
    }
  }, []);

  // Auto-persist the active conversation whenever its turns change through a
  // user action. Skipped for loads/restores so merely opening or browsing a
  // thread doesn't bump its updatedAt and corrupt the history order.
  useEffect(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    const records: ChatMessageRecord[] = messages
      .filter((message) => message.id !== WELCOME_ID && message.content.trim())
      .map((message) => ({ id: message.id, role: message.role, content: message.content }));
    if (!records.some((record) => record.role === "user")) {
      return; // nothing worth saving yet
    }
    const now = new Date().toISOString();
    if (!activeIdRef.current) activeIdRef.current = createClientId("thread");
    if (!createdAtRef.current) createdAtRef.current = now;
    const thread: ChatThread = {
      id: activeIdRef.current,
      title: deriveThreadTitle(records),
      messages: records,
      createdAt: createdAtRef.current,
      updatedAt: now
    };
    const repo = createLocalChatThreadRepository(window.localStorage);
    repo.save(upsertThread(repo.load(), thread));
    setThreads(sortThreadsByRecent(repo.load()));
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  // Stop any in-flight dictation when the panel unmounts.
  useEffect(
    () => () => {
      recognitionRef.current?.stop();
    },
    []
  );

  function newChat() {
    activeIdRef.current = null;
    createdAtRef.current = null;
    setMessages([welcomeMessage()]);
    setError(null);
    setShowHistory(false);
  }

  function openThread(thread: ChatThread) {
    activeIdRef.current = thread.id;
    createdAtRef.current = thread.createdAt;
    setMessages(messagesFromThread(thread));
    setError(null);
    setShowHistory(false);
  }

  function deleteThread(id: string) {
    const repo = createLocalChatThreadRepository(window.localStorage);
    repo.save(removeThread(repo.load(), id));
    const remaining = sortThreadsByRecent(repo.load());
    setThreads(remaining);
    if (activeIdRef.current === id) {
      newChat();
    }
  }

  function clearAllThreads() {
    createLocalChatThreadRepository(window.localStorage).save([]);
    setThreads([]);
    newChat();
  }

  function renameThread(id: string, title: string) {
    const cleaned = title.trim();
    setRenamingId(null);
    if (!cleaned) return;
    const repo = createLocalChatThreadRepository(window.localStorage);
    const existing = repo.load().find((thread) => thread.id === id);
    if (!existing) return;
    repo.save(
      upsertThread(repo.load(), { ...existing, title: cleaned.slice(0, 80), updatedAt: new Date().toISOString() })
    );
    setThreads(sortThreadsByRecent(repo.load()));
  }

  const filteredThreads = (() => {
    const query = threadSearch.trim().toLowerCase();
    if (!query) return threads;
    return threads.filter(
      (thread) =>
        thread.title.toLowerCase().includes(query) ||
        thread.messages.some((message) => message.content.toLowerCase().includes(query))
    );
  })();

  function historyFor(): { role: "user" | "assistant"; content: string }[] {
    return messages
      .filter((message) => message.id !== WELCOME_ID && message.content.trim())
      .map((message) => ({
        role: message.role === "user" ? ("user" as const) : ("assistant" as const),
        content: message.content
      }))
      .slice(-10);
  }

  async function send() {
    const trimmed = draft.trim();
    if (!trimmed || isSending) return;
    if (!navigator.onLine) {
      setError(aiNetworkRequiredMessage);
      return;
    }

    const history = historyFor();
    dirtyRef.current = true;
    setMessages((current) => [
      ...current,
      { id: createMessageId("user"), role: "user", content: trimmed }
    ]);
    setDraft("");
    setError(null);
    setIsSending(true);

    try {
      const payload = await sendAIChatRequest({
        message: trimmed,
        mode: "general",
        appData: loadStoredAppData(window.localStorage),
        heroName: readProfile(window.localStorage).heroName,
        aboutMe:
          [
            formatWikiForPrompt(loadWiki(window.localStorage)),
            formatMemoriesForPrompt(createLocalMemoryRepository(window.localStorage).load())
          ]
            .filter(Boolean)
            .join("\n\n") || undefined,
        history
      });
      dirtyRef.current = true;
      setMessages((current) => [
        ...current,
        {
          id: createMessageId("coach"),
          role: "coach",
          content: payload.message ?? "",
          proposals: payload.proposals && payload.proposals.length > 0 ? payload.proposals : undefined
        }
      ]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "AI coach is unavailable right now.");
    } finally {
      setIsSending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

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

    const note = draft.trim();
    dirtyRef.current = true;
    setMessages((current) => [
      ...current,
      {
        id: createMessageId("user"),
        role: "user",
        content: note || "Shared a photo",
        imageDataUrl: dataUrl
      }
    ]);
    setDraft("");
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
      dirtyRef.current = true;
      setMessages((current) => [
        ...current,
        {
          id: createMessageId("coach"),
          role: "coach",
          content: result.question ? `${result.summary} ${result.question}` : result.summary,
          visionProposals: result.proposals.map((proposal) => ({
            ...proposal,
            id: createClientId("vision"),
            status: "pending" as const
          }))
        }
      ]);
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : "Photo analysis failed.");
    } finally {
      setIsSending(false);
    }
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
      setDraft((prev) => (prev ? `${prev} ${transcript}` : transcript).trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }

  function setProposalStatus(messageId: string, proposalId: string, status: AIToolProposal["status"]) {
    dirtyRef.current = true;
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              proposals: message.proposals?.map((proposal) =>
                proposal.id === proposalId
                  ? { ...proposal, status, updatedAt: new Date().toISOString() }
                  : proposal
              )
            }
          : message
      )
    );
  }

  function rejectProposal(messageId: string, proposal: AIToolProposal) {
    setProposalStatus(messageId, proposal.id, "rejected");
  }

  function applyMemoryProposal(messageId: string, proposal: AIToolProposal): boolean {
    const payload = proposal.payload as { key?: unknown; content?: unknown; category?: unknown };
    const key = typeof payload.key === "string" ? payload.key : "";
    const content = typeof payload.content === "string" ? payload.content : "";
    if (!key || !content) {
      setProposalStatus(messageId, proposal.id, "failed");
      setError("That memory was missing a key or content.");
      return true;
    }
    const category = isMemoryCategory(payload.category) ? payload.category : undefined;
    const repo = createLocalMemoryRepository(window.localStorage);
    repo.save(upsertMemory(repo.load(), { key, content, category, source: "agent" }));
    setProposalStatus(messageId, proposal.id, "applied");
    setMessages((current) => [
      ...current,
      { id: createMessageId("coach"), role: "coach", content: `✓ Remembered "${key}".` }
    ]);
    return true;
  }

  function applyCoachAction(messageId: string, proposal: AIToolProposal) {
    const args =
      proposal.payload && typeof proposal.payload === "object"
        ? (proposal.payload as Record<string, unknown>)
        : {};
    const outcome = executeVoiceTool(proposal.toolName, args);
    setProposalStatus(messageId, proposal.id, outcome.ok ? "applied" : "failed");
    setMessages((current) => [
      ...current,
      { id: createMessageId("coach"), role: "coach", content: outcome.ok ? `✓ ${outcome.message}` : outcome.message }
    ]);
    if (!outcome.ok) setError(outcome.message);
  }

  async function confirmProposal(messageId: string, proposal: AIToolProposal) {
    setProposalStatus(messageId, proposal.id, "confirmed");
    setError(null);

    // Memory writes are local — apply directly, no server round-trip.
    if (proposal.toolName === "save_memory") {
      applyMemoryProposal(messageId, proposal);
      return;
    }

    // Nutrition / workout / note / goal actions run client-side via the shared
    // voice-tool layer (same as the voice agent) — no server round-trip.
    if (isCoachActionTool(proposal.toolName)) {
      applyCoachAction(messageId, proposal);
      return;
    }

    try {
      const storage = window.localStorage;
      const payload = await confirmAIToolProposal({
        proposal,
        dailyPlans: createLocalDailyPlanRepository(storage).load(),
        dailyReports: createLocalDailyReportRepository(storage).load(),
        journalEntries: createLocalJournalRepository(storage).load(),
        metricEntries: createLocalMetricRepository(storage).load(),
        tasks: createLocalTaskRepository(storage).load()
      });
      persistAIToolResult(storage, payload);
      setProposalStatus(messageId, proposal.id, "applied");
      setMessages((current) => [
        ...current,
        {
          id: createMessageId("coach"),
          role: "coach",
          content: `✓ Done — ${payload.appliedChangeSummary}.`
        }
      ]);
    } catch (confirmError) {
      setProposalStatus(messageId, proposal.id, "failed");
      setError(confirmError instanceof Error ? confirmError.message : "That change couldn't be applied.");
    }
  }

  function applyVision(messageId: string, card: VisionProposalCard) {
    const outcome = executeVoiceTool(card.tool, card.args);
    dirtyRef.current = true;
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              visionProposals: message.visionProposals?.map((proposal) =>
                proposal.id === card.id
                  ? { ...proposal, status: outcome.ok ? "applied" : "pending" }
                  : proposal
              )
            }
          : message
      )
    );
    if (!outcome.ok) setError(outcome.message);
  }

  function dismissVision(messageId: string, card: VisionProposalCard) {
    dirtyRef.current = true;
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              visionProposals: message.visionProposals?.map((proposal) =>
                proposal.id === card.id ? { ...proposal, status: "dismissed" } : proposal
              )
            }
          : message
      )
    );
  }

  return (
    <section className="chat-shell" aria-labelledby="coach-title">
      <header className="chat-topbar">
        <div>
          <h1 id="coach-title">AI Coach</h1>
          <p>Chat, talk, or share a photo. Changes need your confirm.</p>
        </div>
        <div className="chat-topbar-actions">
          <button type="button" className="chat-topbar-btn" onClick={newChat}>
            ＋ New chat
          </button>
          <button
            type="button"
            className={showHistory ? "chat-topbar-btn chat-topbar-btn-on" : "chat-topbar-btn"}
            aria-expanded={showHistory}
            onClick={() => setShowHistory((open) => !open)}
          >
            History ({threads.length})
          </button>
        </div>
      </header>

      {showHistory ? (
        <div className="chat-history" aria-label="Saved conversations">
          {threads.length === 0 ? (
            <p className="reminders-help">No saved conversations yet.</p>
          ) : (
            <>
              <input
                className="fitness-input chat-history-search"
                placeholder="Search conversations…"
                value={threadSearch}
                onChange={(event) => setThreadSearch(event.target.value)}
                aria-label="Search conversations"
              />
              {filteredThreads.length === 0 ? (
                <p className="reminders-help">No conversations match &ldquo;{threadSearch}&rdquo;.</p>
              ) : (
                <ul className="chat-history-list">
                  {filteredThreads.map((thread) => (
                    <li
                      key={thread.id}
                      className={
                        thread.id === activeIdRef.current
                          ? "chat-history-item chat-history-item-active"
                          : "chat-history-item"
                      }
                    >
                      {renamingId === thread.id ? (
                        <input
                          className="fitness-input chat-history-rename"
                          value={renameDraft}
                          autoFocus
                          aria-label="Rename conversation"
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") renameThread(thread.id, renameDraft);
                            if (event.key === "Escape") setRenamingId(null);
                          }}
                          onBlur={() => renameThread(thread.id, renameDraft)}
                        />
                      ) : (
                        <button type="button" className="chat-history-open" onClick={() => openThread(thread)}>
                          <span className="chat-history-title">{thread.title}</span>
                          <span className="chat-history-date">{thread.updatedAt.slice(0, 10)}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="chat-history-icon"
                        aria-label={`Rename conversation "${thread.title}"`}
                        onClick={() => {
                          setRenamingId(thread.id);
                          setRenameDraft(thread.title);
                        }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="chat-history-icon chat-history-delete"
                        aria-label={`Delete conversation "${thread.title}"`}
                        onClick={() => deleteThread(thread.id)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="chat-history-clear" onClick={clearAllThreads}>
                Clear all conversations
              </button>
            </>
          )}
        </div>
      ) : null}

      {!isOnline ? <OfflineBoundary featureName="AI Coach" /> : null}

      <div className="chat-thread" aria-label="Conversation" role="log" aria-live="polite">
        {messages.map((message) => (
          <div className={`chat-row chat-row-${message.role}`} key={message.id}>
            <div className={`chat-bubble chat-bubble-${message.role}`}>
              {message.imageDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="chat-bubble-image" src={message.imageDataUrl} alt="Shared photo" />
              ) : null}
              {message.content ? <p>{message.content}</p> : null}
            </div>

            {message.proposals && message.proposals.length > 0 ? (
              <div className="chat-actions">
                {message.proposals.map((proposal) => (
                  <article className="chat-action-card" key={proposal.id}>
                    <p className="chat-action-kicker">{proposal.toolName.replace(/_/g, " ")}</p>
                    <strong>{proposal.summary}</strong>
                    {proposalDetails(proposal) ? <p>{proposalDetails(proposal)}</p> : null}
                    <div className="chat-action-buttons">
                      <button
                        type="button"
                        className="chat-action-confirm"
                        disabled={proposal.status !== "pending"}
                        onClick={() => confirmProposal(message.id, proposal)}
                      >
                        {proposal.status === "applied" ? "Applied ✓" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        disabled={proposal.status !== "pending"}
                        onClick={() => rejectProposal(message.id, proposal)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            {message.visionProposals && message.visionProposals.some((card) => card.status !== "dismissed") ? (
              <div className="chat-actions">
                {message.visionProposals
                  .filter((card) => card.status !== "dismissed")
                  .map((card) => (
                    <article className="chat-action-card" key={card.id}>
                      <strong>{card.label}</strong>
                      <div className="chat-action-buttons">
                        <button
                          type="button"
                          className="chat-action-confirm"
                          disabled={card.status !== "pending"}
                          onClick={() => applyVision(message.id, card)}
                        >
                          {card.status === "applied" ? "Applied ✓" : "Apply"}
                        </button>
                        <button
                          type="button"
                          disabled={card.status !== "pending"}
                          onClick={() => dismissVision(message.id, card)}
                        >
                          Dismiss
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
            ) : null}
          </div>
        ))}

        {isSending ? (
          <div className="chat-row chat-row-coach">
            <div className="chat-bubble chat-bubble-coach chat-bubble-typing" aria-live="polite">
              <span className="chat-dot" />
              <span className="chat-dot" />
              <span className="chat-dot" />
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {error ? (
        <p className="chat-error form-error" role="alert">
          {error}
        </p>
      ) : null}

      <form className="chat-composer" onSubmit={onSubmit}>
        <button
          type="button"
          className="chat-icon-btn"
          aria-label="Attach a photo"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSending}
        >
          📎
        </button>
        {speechSupported ? (
          <button
            type="button"
            className={listening ? "chat-icon-btn chat-icon-on" : "chat-icon-btn"}
            aria-label={listening ? "Stop dictation" : "Dictate your message"}
            aria-pressed={listening}
            onClick={toggleDictation}
            disabled={isSending}
          >
            🎙️
          </button>
        ) : null}
        <textarea
          className="chat-input"
          rows={1}
          placeholder={`Message your coach, ${heroName}…`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onComposerKeyDown}
          aria-label="Message"
        />
        <button className="chat-send" type="submit" disabled={isSending || !draft.trim()} aria-label="Send">
          {isSending ? "…" : "↑"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="visually-hidden"
          aria-label="Attach a photo"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handlePhoto(file);
            event.target.value = "";
          }}
        />
      </form>
    </section>
  );
}
