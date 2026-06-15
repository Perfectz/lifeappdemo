"use client";

import { useState } from "react";

import { sendMagicLink, signInWithGoogle } from "@/client/cloudSync";

/**
 * Full-screen sign-in gate. Google is the primary method; an email magic-link
 * fallback is offered so the user is never locked out (e.g. before the Google
 * OAuth client is configured).
 */
export function LoginScreen() {
  const [busy, setBusy] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function handleGoogle() {
    setBusy(true);
    setMessage(null);
    const result = await signInWithGoogle();
    if (!result.ok) {
      setBusy(false);
      setMessage({ tone: "error", text: result.message });
    }
    // On success the page redirects to Google, so no further UI update needed.
  }

  async function handleEmailLink() {
    setBusy(true);
    setMessage(null);
    const result = await sendMagicLink(email);
    setBusy(false);
    setMessage(
      result.ok
        ? { tone: "ok", text: "Check your email for a sign-in link." }
        : { tone: "error", text: result.message }
    );
  }

  return (
    <main className="login-screen">
      <div className="login-card">
        <span className="brand-mark login-mark" aria-hidden="true">
          LQ
        </span>
        <h1 className="login-title">LifeQuest OS</h1>
        <p className="login-subtitle">Sign in to continue your quest.</p>

        <button
          type="button"
          className="login-google"
          onClick={handleGoogle}
          disabled={busy}
        >
          <span className="login-google-glyph" aria-hidden="true">
            G
          </span>
          <span>Continue with Google</span>
        </button>

        {showEmail ? (
          <div className="login-email">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              className="cloud-sync-email"
              placeholder="you@example.com"
              aria-label="Email for sign-in link"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button
              type="button"
              className="command-button"
              onClick={handleEmailLink}
              disabled={busy}
            >
              <span>{busy ? "Sending…" : "Send sign-in link"}</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="login-alt"
            onClick={() => setShowEmail(true)}
            disabled={busy}
          >
            Use an email link instead
          </button>
        )}

        {message ? (
          <p
            className={message.tone === "error" ? "login-message form-error" : "login-message"}
            role={message.tone === "error" ? "alert" : "status"}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </main>
  );
}
