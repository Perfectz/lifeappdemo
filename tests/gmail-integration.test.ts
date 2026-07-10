import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildGmailAuthorizationUrl,
  createGmailOAuthState,
  decryptIntegrationSecret,
  encodeGmailDraft,
  encryptIntegrationSecret,
  missingGmailConfiguration,
  verifyGmailOAuthState
} from "@/server/integrations/gmail";
import { validateAIToolProposalInput } from "@/domain/aiTaskTools";

beforeEach(() => {
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", "test-only-integration-key-with-more-than-32-characters");
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "client.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "client-secret");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Gmail OAuth security helpers", () => {
  it("round-trips encrypted refresh tokens without storing plaintext", () => {
    const encrypted = encryptIntegrationSecret("refresh-token-secret");
    expect(encrypted).not.toContain("refresh-token-secret");
    expect(decryptIntegrationSecret(encrypted)).toBe("refresh-token-secret");
  });

  it("binds signed OAuth state to the user, browser nonce, and expiry", () => {
    const state = createGmailOAuthState("user-42", "browser-nonce", 1_000);
    expect(verifyGmailOAuthState(state, "browser-nonce", 2_000)).toMatchObject({ userId: "user-42" });
    expect(verifyGmailOAuthState(state, "wrong-nonce", 2_000)).toBeNull();
    expect(verifyGmailOAuthState(`${state}tampered`, "browser-nonce", 2_000)).toBeNull();
    expect(verifyGmailOAuthState(state, "browser-nonce", 1_000 + 10 * 60 * 1000 + 1)).toBeNull();
  });

  it("requests offline access with only read and compose Gmail scopes", () => {
    const url = new URL(buildGmailAuthorizationUrl("https://lifequest.test/callback", "signed-state"));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("scope")).toContain("gmail.readonly");
    expect(url.searchParams.get("scope")).toContain("gmail.compose");
    expect(url.searchParams.get("scope")).not.toContain("mail.google.com");
  });

  it("reports every missing server-side configuration value", () => {
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(missingGmailConfiguration()).toEqual([
      "GOOGLE_OAUTH_CLIENT_ID",
      "SUPABASE_SERVICE_ROLE_KEY"
    ]);
  });

  it("accepts a bounded email-draft proposal for explicit confirmation", () => {
    const result = validateAIToolProposalInput({
      toolName: "create_email_draft",
      summary: "Draft a reply to Alex",
      payload: { to: "alex@example.com", subject: "Follow up", body: "Thanks, Alex." }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.payload).toEqual({
        to: "alex@example.com",
        subject: "Follow up",
        body: "Thanks, Alex."
      });
    }
  });
});

describe("Gmail drafts", () => {
  it("encodes a UTF-8 MIME draft and strips header newlines", () => {
    const raw = encodeGmailDraft({
      to: "person@example.com\r\nBcc: attacker@example.com",
      subject: "Follow up\r\nBcc: attacker@example.com",
      body: "Hello — thanks for your time."
    });
    const mime = Buffer.from(raw, "base64url").toString("utf8");
    expect(mime).toContain("To: person@example.comBcc: attacker@example.com");
    expect(mime).toContain("Subject: Follow up  Bcc: attacker@example.com");
    expect(mime).toContain("Hello — thanks for your time.");
    expect(mime).not.toMatch(/\r\nBcc:/);
  });
});
