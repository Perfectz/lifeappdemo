"use client";

import { useState } from "react";

import { signOutCloud } from "@/client/cloudSync";
import { APP_CREATOR_EMAIL } from "@/client/membership";

type PendingApprovalScreenProps = {
  status: "pending" | "denied";
  email: string | null;
};

/**
 * Shown to a signed-in user who hasn't been approved by the app creator yet.
 * They're authenticated but gated out of the app until approval.
 */
export function PendingApprovalScreen({ status, email }: PendingApprovalScreenProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await signOutCloud();
    } finally {
      setSigningOut(false);
    }
  }

  const denied = status === "denied";

  return (
    <div className="auth-splash approval-screen" role="status" aria-live="polite">
      <span className="brand-mark" aria-hidden="true">
        LQ
      </span>
      <h1 className="approval-title">{denied ? "Access not granted" : "Waiting for approval"}</h1>
      <p className="approval-body">
        {denied ? (
          <>This account doesn&apos;t have access to LifeQuest. If you think that&apos;s a mistake,
          reach out to the app creator.</>
        ) : (
          <>You&apos;re signed in{email ? ` as ${email}` : ""}, but LifeQuest is invite-only. The app
          creator needs to approve your account before you can come in. You&apos;ll get access the
          moment they do — just sign back in.</>
        )}
      </p>
      <p className="approval-contact">Approvals are handled by {APP_CREATOR_EMAIL}.</p>
      <button type="button" className="login-submit" onClick={() => void signOut()} disabled={signingOut}>
        <span>{signingOut ? "Signing out…" : "Sign out"}</span>
      </button>
    </div>
  );
}
