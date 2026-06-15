"use client";

import { useState, type FormEvent } from "react";

import { signInWithPassword, signUpWithPassword } from "@/client/cloudSync";

type Mode = "signin" | "signup";

/**
 * Full-screen sign-in gate using email + password. On success the AuthGate's
 * auth subscription flips the app in automatically.
 */
export function LoginScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    if (mode === "signup") {
      const result = await signUpWithPassword(email, password);
      setBusy(false);
      if (!result.ok) {
        setMessage({ tone: "error", text: result.message });
        return;
      }
      if (result.needsConfirmation) {
        setMessage({
          tone: "ok",
          text: "Account created. It needs confirming once — then sign in below."
        });
        setMode("signin");
      }
      // If a session was returned, AuthGate transitions automatically.
      return;
    }

    const result = await signInWithPassword(email, password);
    setBusy(false);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.message });
    }
    // On success, AuthGate's onAuthStateChange swaps in the app.
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <span className="brand-mark login-mark" aria-hidden="true">
          LQ
        </span>
        <h1 className="login-title">LifeQuest OS</h1>
        <p className="login-subtitle">
          {mode === "signin" ? "Sign in to continue your quest." : "Create your account."}
        </p>

        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          className="login-input"
          placeholder="Email"
          aria-label="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          className="login-input"
          placeholder="Password"
          aria-label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <button type="submit" className="login-submit" disabled={busy}>
          <span>
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </span>
        </button>

        <button
          type="button"
          className="login-alt"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMessage(null);
          }}
          disabled={busy}
        >
          {mode === "signin" ? "Need an account? Create one" : "Have an account? Sign in"}
        </button>

        {message ? (
          <p
            className={message.tone === "error" ? "login-message form-error" : "login-message"}
            role={message.tone === "error" ? "alert" : "status"}
          >
            {message.text}
          </p>
        ) : null}
      </form>
    </main>
  );
}
