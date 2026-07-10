"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  beginGmailConnection,
  createGmailDraft,
  disconnectGmail,
  getGmailInbox,
  getGmailStatus,
  type GmailConnectionStatus,
  type GmailMessageSummary
} from "@/client/gmailIntegration";

type Notice = { tone: "ok" | "error"; text: string } | null;

export function GmailIntegrationPanel() {
  const [status, setStatus] = useState<GmailConnectionStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const refreshStatus = useCallback(async () => {
    setStatusError(null);
    try {
      setStatus(await getGmailStatus());
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Could not check Gmail.");
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    const outcome = new URLSearchParams(window.location.search).get("gmail");
    if (outcome === "connected") setNotice({ tone: "ok", text: "Gmail connected." });
    if (outcome === "error") setNotice({ tone: "error", text: "Gmail connection was not completed." });
  }, [refreshStatus]);

  async function connect() {
    setBusy(true);
    setNotice(null);
    try {
      await beginGmailConnection();
    } catch (error) {
      setBusy(false);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not connect Gmail." });
    }
  }

  async function loadInbox() {
    setBusy(true);
    setNotice(null);
    try {
      const digest = await getGmailInbox();
      setMessages(digest.messages);
      setNotice({
        tone: "ok",
        text: digest.messages.length
          ? `Loaded ${digest.messages.length} recent unread message${digest.messages.length === 1 ? "" : "s"}.`
          : "No recent unread messages matched."
      });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not read Gmail." });
    } finally {
      setBusy(false);
    }
  }

  async function submitDraft(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await createGmailDraft({ to, subject, body });
      setTo("");
      setSubject("");
      setBody("");
      setNotice({ tone: "ok", text: "Draft created in Gmail. Nothing was sent." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not create the draft." });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setNotice(null);
    try {
      await disconnectGmail();
      setMessages([]);
      await refreshStatus();
      setNotice({ tone: "ok", text: "Gmail disconnected and the stored credential was removed." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not disconnect Gmail." });
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    if (statusError) {
      return (
        <div className="gmail-integration">
          <p className="form-error" role="alert">{statusError}</p>
          <button type="button" className="command-button" onClick={() => void refreshStatus()}>
            Retry Gmail status
          </button>
        </div>
      );
    }
    return <p className="reminders-help" role="status">Checking Gmail connection…</p>;
  }

  return (
    <div className="gmail-integration">
      <div className="gmail-connection-row">
        <div>
          <strong>{status.connected ? status.email : "Gmail is not connected"}</strong>
          <p className="reminders-help">
            {status.connected
              ? "The Agent can read an inbox digest when you ask about email and can create drafts only after confirmation. It cannot automatically send mail."
              : "Connect Gmail for inbox triage and reviewable drafts. LifeQuest requests read-only inbox and compose permissions."}
          </p>
        </div>
        {status.connected ? (
          <button type="button" className="command-button" onClick={disconnect} disabled={busy}>Disconnect</button>
        ) : (
          <button type="button" className="command-button" onClick={connect} disabled={busy || !status.configured}>
            Connect Gmail
          </button>
        )}
      </div>

      {!status.configured ? (
        <div className="gmail-configuration-note" role="status">
          <strong>Deployment configuration required</strong>
          <p>Add the Google OAuth client, service-role key, and encryption key listed in <code>.env.example</code>.</p>
          {status.missing?.length ? <p>Missing: {status.missing.join(", ")}</p> : null}
        </div>
      ) : null}

      {status.connected ? (
        <>
          <div className="gmail-actions-row">
            <button type="button" className="command-button" onClick={loadInbox} disabled={busy}>Load inbox digest</button>
            <span>Unread from the last seven days, excluding Promotions.</span>
          </div>
          {messages.length > 0 ? (
            <ul className="gmail-message-list" aria-label="Gmail inbox digest">
              {messages.map((message) => (
                <li key={message.id}>
                  <strong>{message.subject}</strong>
                  <span>{message.from}</span>
                  {message.snippet ? <p>{message.snippet}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
          <form className="gmail-draft-form" onSubmit={submitDraft}>
            <h3>Create a Gmail draft</h3>
            <p className="reminders-help">LifeQuest saves the draft in Gmail for your review. This form never sends it.</p>
            <label>
              <span>To</span>
              <input type="email" required value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
            <label>
              <span>Subject</span>
              <input type="text" required maxLength={240} value={subject} onChange={(event) => setSubject(event.target.value)} />
            </label>
            <label>
              <span>Message</span>
              <textarea required rows={6} value={body} onChange={(event) => setBody(event.target.value)} />
            </label>
            <button type="submit" className="command-button" disabled={busy}>Create draft</button>
          </form>
        </>
      ) : null}

      {notice ? (
        <p className={notice.tone === "error" ? "form-error" : "profile-saved"} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}
