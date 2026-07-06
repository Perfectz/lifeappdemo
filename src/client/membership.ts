/**
 * Member approval / access control.
 *
 * New accounts land as "pending" and can't use the app until the creator
 * approves them. The creator (the admin email below) is always approved. Real
 * enforcement is Supabase RLS (see supabase/app-member-approval.sql); this
 * module is the client surface for checking status, requesting access, and —
 * for the admin — approving/denying others.
 */

import { getSupabaseClient } from "@/lib/supabase/client";
import { APP_CREATOR_EMAIL, isAppCreator } from "@/lib/supabase/config";
import type { CloudUser } from "@/client/cloudSync";

// Shared with the server-side guard (src/server/auth/requireUser.ts);
// re-exported so existing imports keep working.
export { APP_CREATOR_EMAIL, isAppCreator };

export type MembershipStatus = "approved" | "pending" | "denied" | "none";

export type MemberRecord = {
  userId: string;
  email: string | null;
  status: Exclude<MembershipStatus, "none">;
  requestedAt: string | null;
  decidedAt: string | null;
};

function rowToRecord(row: Record<string, unknown>): MemberRecord {
  const status = row.status === "approved" || row.status === "denied" ? row.status : "pending";
  return {
    userId: String(row.user_id ?? ""),
    email: typeof row.email === "string" ? row.email : null,
    status,
    requestedAt: typeof row.requested_at === "string" ? row.requested_at : null,
    decidedAt: typeof row.decided_at === "string" ? row.decided_at : null
  };
}

/**
 * Resolve the signed-in user's access. The creator is always approved. Anyone
 * else: read their membership row; if none exists yet, create a pending
 * request. Returns "approved" only when truly approved.
 */
export async function resolveMembershipStatus(user: CloudUser): Promise<MembershipStatus> {
  if (isAppCreator(user.email)) return "approved";

  const sb = getSupabaseClient();
  if (!sb) return "approved"; // local-only mode: no cloud, no gate

  try {
    const { data, error } = await sb
      .from("app_members")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return "pending"; // fail closed
    if (data?.status === "approved") return "approved";
    if (data?.status === "denied") return "denied";
    if (data?.status === "pending") return "pending";

    // No row yet — file a pending request (RLS forces status='pending').
    await sb
      .from("app_members")
      .insert({ user_id: user.id, email: user.email, status: "pending" });
    return "pending";
  } catch {
    return "pending"; // fail closed
  }
}

/* ----------------------------------------------------------------- admin -- */

export async function listMembers(): Promise<MemberRecord[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("app_members")
    .select("user_id, email, status, requested_at, decided_at")
    .order("requested_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => rowToRecord(row as Record<string, unknown>));
}

async function setStatus(userId: string, status: "approved" | "denied"): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;
  const { data: auth } = await sb.auth.getUser();
  const { error } = await sb
    .from("app_members")
    .update({ status, decided_at: new Date().toISOString(), decided_by: auth.user?.id ?? null })
    .eq("user_id", userId);
  return !error;
}

export function approveMember(userId: string): Promise<boolean> {
  return setStatus(userId, "approved");
}

export function denyMember(userId: string): Promise<boolean> {
  return setStatus(userId, "denied");
}
