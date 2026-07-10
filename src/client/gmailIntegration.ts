import { getAuthHeaders } from "@/client/authToken";

export type GmailConnectionStatus = {
  configured: boolean;
  connected: boolean;
  email?: string;
  scopes?: string[];
  updatedAt?: string;
  missing?: string[];
  error?: string;
};

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(await getAuthHeaders()),
      ...init?.headers
    }
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Gmail request failed.");
  return payload;
}

export function getGmailStatus(): Promise<GmailConnectionStatus> {
  return api<GmailConnectionStatus>("/api/integrations/gmail/status");
}

export async function beginGmailConnection(): Promise<void> {
  const result = await api<{ authorizationUrl: string }>("/api/integrations/gmail/connect", {
    method: "POST"
  });
  window.location.assign(result.authorizationUrl);
}

export async function getGmailInbox(): Promise<{ messages: GmailMessageSummary[]; query: string }> {
  return api("/api/integrations/gmail/inbox");
}

export async function createGmailDraft(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ id: string }> {
  const result = await api<{ ok: true; draft: { id: string } }>("/api/integrations/gmail/drafts", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return result.draft;
}

export async function disconnectGmail(): Promise<void> {
  await api<{ ok: true }>("/api/integrations/gmail/connection", { method: "DELETE" });
}
