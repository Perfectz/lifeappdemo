import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { supabaseUrl } from "@/lib/supabase/config";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose"
] as const;

const TOKEN_VERSION = "v1";
const STATE_TTL_MS = 10 * 60 * 1000;
const TABLE = "gmail_connections";

type GmailConnectionRow = {
  user_id: string;
  email: string;
  refresh_token_ciphertext: string;
  scopes: string[] | null;
  updated_at: string;
};

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
};

export type GmailInboxDigest = {
  messages: GmailMessageSummary[];
  query: string;
};

export class GmailConfigurationError extends Error {
  constructor(message = "Gmail integration is not configured.") {
    super(message);
    this.name = "GmailConfigurationError";
  }
}

export class GmailNotConnectedError extends Error {
  constructor(message = "Connect Gmail in Settings first.") {
    super(message);
    this.name = "GmailNotConnectedError";
  }
}

export function missingGmailConfiguration(): string[] {
  const required = [
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "SUPABASE_SERVICE_ROLE_KEY",
    "INTEGRATION_ENCRYPTION_KEY"
  ] as const;
  return required.filter((name) => {
    const value = process.env[name]?.trim() ?? "";
    return !value || (name === "INTEGRATION_ENCRYPTION_KEY" && value.length < 32);
  });
}

export function isGmailConfigured(): boolean {
  return missingGmailConfiguration().length === 0;
}

function integrationSecret(): string {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) {
    throw new GmailConfigurationError(
      "INTEGRATION_ENCRYPTION_KEY must contain at least 32 characters."
    );
  }
  return secret;
}

function encryptionKey(): Buffer {
  return createHash("sha256").update(integrationSecret(), "utf8").digest();
}

export function encryptIntegrationSecret(value: string): string {
  if (!value) throw new Error("Cannot encrypt an empty integration secret.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [TOKEN_VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptIntegrationSecret(value: string): string {
  const [version, ivText, tagText, encryptedText] = value.split(":");
  if (version !== TOKEN_VERSION || !ivText || !tagText || !encryptedText) {
    throw new Error("Stored integration secret has an unsupported format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

type OAuthStatePayload = { userId: string; nonce: string; expiresAt: number };

function signStatePayload(encodedPayload: string): string {
  return createHmac("sha256", integrationSecret()).update(encodedPayload).digest("base64url");
}

export function createGmailOAuthState(
  userId: string,
  nonce: string,
  now = Date.now()
): string {
  const payload: OAuthStatePayload = { userId, nonce, expiresAt: now + STATE_TTL_MS };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signStatePayload(encoded)}`;
}

export function verifyGmailOAuthState(
  state: string,
  expectedNonce: string,
  now = Date.now()
): OAuthStatePayload | null {
  const [encoded, suppliedSignature] = state.split(".");
  if (!encoded || !suppliedSignature) return null;
  const expectedSignature = signStatePayload(encoded);
  const left = Buffer.from(suppliedSignature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<OAuthStatePayload>;
    if (
      typeof payload.userId !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.nonce !== expectedNonce ||
      payload.expiresAt < now
    ) {
      return null;
    }
    return payload as OAuthStatePayload;
  } catch {
    return null;
  }
}

export function buildGmailAuthorizationUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (!clientId) throw new GmailConfigurationError();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", GMAIL_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

let adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) throw new GmailConfigurationError();
  if (!adminClient) {
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  }
  return adminClient;
}

async function googleTokenRequest(values: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
    cache: "no-store"
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== "string") {
    throw new Error("Google rejected the Gmail authorization request.");
  }
  return payload;
}

export async function exchangeGmailAuthorizationCode(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new GmailConfigurationError();
  const payload = await googleTokenRequest({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });
  const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : "";
  if (!refreshToken) {
    throw new Error("Google did not return offline access. Reconnect Gmail and approve access.");
  }
  return {
    accessToken: payload.access_token as string,
    refreshToken,
    scopes: typeof payload.scope === "string" ? payload.scope.split(/\s+/).filter(Boolean) : [...GMAIL_SCOPES]
  };
}

async function gmailFetch<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers
    },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Gmail request failed (${response.status}).`);
  return (await response.json()) as T;
}

export async function saveGmailConnection(input: {
  userId: string;
  accessToken: string;
  refreshToken: string;
  scopes: string[];
}): Promise<string> {
  const profile = await gmailFetch<{ emailAddress?: string }>(input.accessToken, "/users/me/profile");
  const email = profile.emailAddress?.trim();
  if (!email) throw new Error("Gmail did not return an account email.");
  const now = new Date().toISOString();
  const { error } = await getAdminClient().from(TABLE).upsert(
    {
      user_id: input.userId,
      email,
      refresh_token_ciphertext: encryptIntegrationSecret(input.refreshToken),
      scopes: input.scopes,
      updated_at: now
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error("Could not save the Gmail connection.");
  return email;
}

async function connectionForUser(userId: string): Promise<GmailConnectionRow | null> {
  const { data, error } = await getAdminClient()
    .from(TABLE)
    .select("user_id,email,refresh_token_ciphertext,scopes,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not read the Gmail connection.");
  return (data as GmailConnectionRow | null) ?? null;
}

async function accessTokenForUser(userId: string): Promise<{ accessToken: string; row: GmailConnectionRow }> {
  const row = await connectionForUser(userId);
  if (!row) throw new GmailNotConnectedError();
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new GmailConfigurationError();
  const payload = await googleTokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: decryptIntegrationSecret(row.refresh_token_ciphertext),
    grant_type: "refresh_token"
  });
  return { accessToken: payload.access_token as string, row };
}

export async function getGmailConnectionStatus(userId: string) {
  if (!isGmailConfigured()) {
    return { configured: false, connected: false, missing: missingGmailConfiguration() };
  }
  const row = await connectionForUser(userId);
  return row
    ? { configured: true, connected: true, email: row.email, scopes: row.scopes ?? [], updatedAt: row.updated_at }
    : { configured: true, connected: false };
}

function headerValue(headers: Array<{ name?: string; value?: string }> | undefined, name: string): string {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value?.trim() ?? "";
}

export async function getGmailInboxDigest(
  userId: string,
  query = "is:unread newer_than:7d -category:promotions",
  maxResults = 8
): Promise<GmailInboxDigest> {
  const { accessToken } = await accessTokenForUser(userId);
  const listParams = new URLSearchParams({ q: query, maxResults: String(Math.min(Math.max(maxResults, 1), 12)) });
  const list = await gmailFetch<{ messages?: Array<{ id?: string; threadId?: string }> }>(
    accessToken,
    `/users/me/messages?${listParams}`
  );
  const messages = await Promise.all(
    (list.messages ?? []).flatMap((item) => (item.id ? [item] : [])).map(async (item) => {
      const params = new URLSearchParams({ format: "metadata" });
      for (const header of ["From", "Subject", "Date"]) params.append("metadataHeaders", header);
      const detail = await gmailFetch<{
        id?: string;
        threadId?: string;
        snippet?: string;
        payload?: { headers?: Array<{ name?: string; value?: string }> };
      }>(accessToken, `/users/me/messages/${encodeURIComponent(item.id!)}?${params}`);
      return {
        id: detail.id ?? item.id!,
        threadId: detail.threadId ?? item.threadId ?? "",
        from: headerValue(detail.payload?.headers, "From") || "Unknown sender",
        subject: headerValue(detail.payload?.headers, "Subject") || "(no subject)",
        date: headerValue(detail.payload?.headers, "Date"),
        snippet: detail.snippet?.replace(/\s+/g, " ").trim().slice(0, 280) ?? ""
      } satisfies GmailMessageSummary;
    })
  );
  return { messages, query };
}

export function encodeGmailDraft(input: { to: string; subject: string; body: string }): string {
  const cleanTo = input.to.replace(/[\r\n]/g, "").trim();
  const cleanSubject = input.subject.replace(/[\r\n]/g, " ").trim();
  const mime = [
    `To: ${cleanTo}`,
    `Subject: ${cleanSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.body
  ].join("\r\n");
  return Buffer.from(mime, "utf8").toString("base64url");
}

export async function createGmailDraft(
  userId: string,
  input: { to: string; subject: string; body: string }
): Promise<{ id: string; messageId?: string }> {
  const to = input.to.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!/^\S+@\S+\.\S+$/.test(to)) throw new Error("Enter one valid recipient email address.");
  if (!subject || subject.length > 240) throw new Error("Draft subject is required and must be under 240 characters.");
  if (!body || body.length > 20_000) throw new Error("Draft body is required and must be under 20,000 characters.");
  const { accessToken } = await accessTokenForUser(userId);
  const result = await gmailFetch<{ id?: string; message?: { id?: string } }>(
    accessToken,
    "/users/me/drafts",
    { method: "POST", body: JSON.stringify({ message: { raw: encodeGmailDraft({ to, subject, body }) } }) }
  );
  if (!result.id) throw new Error("Gmail did not return a draft id.");
  return { id: result.id, messageId: result.message?.id };
}

export async function disconnectGmail(userId: string): Promise<void> {
  const row = await connectionForUser(userId);
  if (!row) return;
  try {
    const refreshToken = decryptIntegrationSecret(row.refresh_token_ciphertext);
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store"
    });
  } catch {
    // Best effort: deleting our stored credential still disconnects LifeQuest.
  }
  const { error } = await getAdminClient().from(TABLE).delete().eq("user_id", userId);
  if (error) throw new Error("Could not disconnect Gmail.");
}

export async function gmailContextForPrompt(userId: string, message: string): Promise<string | null> {
  if (!/\b(gmail|email|emails|inbox|message|messages|mail)\b/i.test(message) || !isGmailConfigured()) {
    return null;
  }
  try {
    const digest = await getGmailInboxDigest(userId);
    if (digest.messages.length === 0) return "Gmail inbox digest: no matching unread messages in the last 7 days.";
    return [
      "Gmail inbox digest (read-only metadata and snippets, fetched because the user asked about email):",
      ...digest.messages.map(
        (item, index) => `${index + 1}. From: ${item.from} | Subject: ${item.subject} | ${item.snippet || "No snippet."}`
      ),
      "Never claim an email was sent. You may propose create_email_draft; it requires explicit confirmation and only creates a Gmail draft."
    ].join("\n");
  } catch (error) {
    return error instanceof GmailNotConnectedError
      ? "Gmail is not connected. Ask the user to connect it in Settings."
      : "Gmail is temporarily unavailable. Say so without inventing inbox content.";
  }
}
