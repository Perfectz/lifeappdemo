"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  getCurrentCloudUser,
  isCloudSyncConfigured,
  subscribeAuthState,
  type CloudUser
} from "@/client/cloudSync";
import { LoginScreen } from "@/components/LoginScreen";

type GateState =
  | { phase: "loading" }
  | { phase: "in"; user: CloudUser }
  | { phase: "out" };

/**
 * Requires a signed-in session before rendering the app. When Supabase isn't
 * configured we fall through to the app (local-only) so a missing key can't
 * lock the user out entirely.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  // e2e bypass: only active when the test webserver sets NEXT_PUBLIC_E2E=1.
  // The gate is a UX boundary (real protection is Supabase RLS on cloud data),
  // so skipping it for browser tests is safe and never enabled in production.
  const e2eBypass = process.env.NEXT_PUBLIC_E2E === "1";
  const configured = isCloudSyncConfigured() && !e2eBypass;
  const [state, setState] = useState<GateState>(
    configured ? { phase: "loading" } : { phase: "in", user: { id: "local", email: null } }
  );

  useEffect(() => {
    if (!configured) return;
    let active = true;

    void getCurrentCloudUser().then((user) => {
      if (active) setState(user ? { phase: "in", user } : { phase: "out" });
    });

    const unsubscribe = subscribeAuthState((user) => {
      setState(user ? { phase: "in", user } : { phase: "out" });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [configured]);

  if (state.phase === "loading") {
    return (
      <div className="auth-splash" role="status" aria-live="polite">
        <span className="brand-mark" aria-hidden="true">
          LQ
        </span>
        <span className="auth-splash-text">Loading…</span>
      </div>
    );
  }

  if (state.phase === "out") {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
