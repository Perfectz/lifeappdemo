"use client";

import { useCallback, useEffect, useState } from "react";

import { getCurrentCloudUser } from "@/client/cloudSync";
import {
  approveMember,
  denyMember,
  isAppCreator,
  listMembers,
  type MemberRecord
} from "@/client/membership";

/**
 * Creator-only panel to approve / deny members. Renders nothing for everyone
 * else (and never shows in local-only mode), so it's safe to drop into Settings
 * unconditionally.
 */
export function MemberApprovalPanel() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    void listMembers().then(setMembers);
  }, []);

  useEffect(() => {
    let active = true;
    void getCurrentCloudUser().then((user) => {
      if (!active) return;
      const admin = isAppCreator(user?.email);
      setIsAdmin(admin);
      if (admin) reload();
    });
    return () => {
      active = false;
    };
  }, [reload]);

  async function decide(userId: string, approve: boolean) {
    setBusyId(userId);
    try {
      const ok = approve ? await approveMember(userId) : await denyMember(userId);
      if (ok) reload();
    } finally {
      setBusyId(null);
    }
  }

  if (!isAdmin) return null;

  const pending = members.filter((m) => m.status === "pending");
  const others = members.filter((m) => m.status !== "pending");

  return (
    <section className="dashboard-section member-approval">
      <h2>Member Access</h2>
      <p className="reminders-help">
        LifeQuest is invite-only. New sign-ups wait here until you approve them.
      </p>

      <h3 className="member-group-title">Pending {pending.length > 0 ? `(${pending.length})` : ""}</h3>
      {pending.length === 0 ? (
        <p className="reminders-help">No one waiting right now.</p>
      ) : (
        <ul className="member-list">
          {pending.map((m) => (
            <li key={m.userId} className="member-item">
              <span className="member-email">{m.email ?? m.userId}</span>
              <span className="member-actions">
                <button
                  type="button"
                  className="command-button command-button-primary"
                  disabled={busyId === m.userId}
                  onClick={() => void decide(m.userId, true)}
                >
                  <span>Approve</span>
                </button>
                <button
                  type="button"
                  className="command-button"
                  disabled={busyId === m.userId}
                  onClick={() => void decide(m.userId, false)}
                >
                  <span>Deny</span>
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {others.length > 0 ? (
        <>
          <h3 className="member-group-title">Members</h3>
          <ul className="member-list">
            {others.map((m) => (
              <li key={m.userId} className="member-item">
                <span className="member-email">{m.email ?? m.userId}</span>
                <span className={`member-status member-status-${m.status}`}>{m.status}</span>
                {m.status === "approved" ? (
                  <button
                    type="button"
                    className="command-button"
                    disabled={busyId === m.userId}
                    onClick={() => void decide(m.userId, false)}
                  >
                    <span>Revoke</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="command-button command-button-primary"
                    disabled={busyId === m.userId}
                    onClick={() => void decide(m.userId, true)}
                  >
                    <span>Approve</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
