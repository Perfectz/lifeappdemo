import type { IsoDateTime } from "@/domain/types";

/**
 * Persisted coach-chat conversation threads (ChatGPT-style history). Only the
 * text turns are stored — transient action cards and large base64 photos are
 * intentionally dropped so threads stay small and sync cleanly. Stored locally
 * and synced via the generic snapshot.
 */

export type ChatRole = "user" | "coach";

export type ChatMessageRecord = {
  id: string;
  role: ChatRole;
  content: string;
};

export type ChatThread = {
  id: string;
  title: string;
  messages: ChatMessageRecord[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export function deriveThreadTitle(messages: ChatMessageRecord[]): string {
  const firstUser = messages.find((message) => message.role === "user" && message.content.trim());
  const base = firstUser?.content.trim() || "New chat";
  return base.length > 48 ? `${base.slice(0, 48).trimEnd()}…` : base;
}

export function isChatMessageRecord(value: unknown): value is ChatMessageRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ChatMessageRecord>;
  return (
    typeof record.id === "string" &&
    (record.role === "user" || record.role === "coach") &&
    typeof record.content === "string"
  );
}

export function isChatThread(value: unknown): value is ChatThread {
  if (!value || typeof value !== "object") return false;
  const thread = value as Partial<ChatThread>;
  return (
    typeof thread.id === "string" &&
    typeof thread.title === "string" &&
    Array.isArray(thread.messages) &&
    thread.messages.every(isChatMessageRecord) &&
    typeof thread.createdAt === "string" &&
    typeof thread.updatedAt === "string"
  );
}

/** Insert or replace a thread by id, returning the list newest-updated first. */
export function upsertThread(threads: ChatThread[], thread: ChatThread): ChatThread[] {
  const without = threads.filter((existing) => existing.id !== thread.id);
  return sortThreadsByRecent([thread, ...without]);
}

export function removeThread(threads: ChatThread[], id: string): ChatThread[] {
  return threads.filter((thread) => thread.id !== id);
}

export function sortThreadsByRecent(threads: ChatThread[]): ChatThread[] {
  return [...threads].sort((left, right) => (right.updatedAt > left.updatedAt ? 1 : -1));
}
