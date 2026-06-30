"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  getCurrentCloudUser,
  isCloudSyncConfigured,
  subscribeAuthState,
  type CloudUser
} from "@/client/cloudSync";
import { resolveMembershipStatus } from "@/client/membership";
import { LoginScreen } from "@/components/LoginScreen";
import { PendingApprovalScreen } from "@/components/PendingApprovalScreen";

type GateState =
  | { phase: "loading" }
  | { phase: "in"; user: CloudUser }
  | { phase: "blocked"; status: "pending" | "denied"; user: CloudUser }
  | { phase: "out" };

/**
 * Gates the app behind (1) a signed-in session and (2) creator approval. When
 * Supabase isn't configured we fall through to local-only mode so a missing key
 * can't lock the user out. Real enforcement of approval is Supabase RLS; this
 * is the UX boundary.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  // e2e bypass: only active when the test webserver sets NEXT_PUBLIC_E2E=1.
  const e2eBypass = process.env.NEXT_PUBLIC_E2E === "1";
  const configured = isCloudSyncConfigured() && !e2eBypass;
  const [state, setState] = useState<GateState>(
    configured ? { phase: "loading" } : { phase: "in", user: { id: "local", email: null } }
  );

  useEffect(() => {
    if (!configured) return;
    let active = true;

    async function resolve(user: CloudUser | null) {
      if (!user) {
        if (active) setState({ phase: "out" });
        return;
      }
      const status = await resolveMembershipStatus(user);
      if (!active) return;
      if (status === "approved") {
        setState({ phase: "in", user });
      } else {
        setState({ phase: "blocked", status: status === "denied" ? "denied" : "pending", user });
      }
    }

    void getCurrentCloudUser().then(resolve);
    const unsubscribe = subscribeAuthState((user) => void resolve(user));

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

  if (state.phase === "blocked") {
    return <PendingApprovalScreen status={state.status} email={state.user.email} />;
  }

  return <>{children}</>;
}
