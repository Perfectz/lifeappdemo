/**
 * Best-effort sync of Timeline Mirror data to the dedicated Supabase tables
 * (timeline_checkins, timeline_identity_docs, timeline_reference_images).
 *
 * Local storage stays the source of truth for instant reads; this layer simply
 * mirrors metadata + scores + markdown to the cloud when the user is signed in,
 * so history and trends survive across devices. The intimate image *bytes*
 * never leave the device (hybrid privacy model) — only the on-device key
 * (image_local_id) is recorded. Every call is wrapped so a sync failure never
 * breaks the local-first flow.
 */

import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  TimelineCheckin,
  TimelineIdentityDoc,
  TimelineReferenceImage
} from "@/domain/timelineMirror";

async function currentUserId(): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Push a completed check-in to timeline_checkins. No-ops when signed out. */
export async function pushCheckinToCloud(checkin: TimelineCheckin): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  const userId = await currentUserId();
  if (!userId) return;

  const r = checkin.result;
  try {
    await sb.from("timeline_checkins").upsert(
      {
        id: checkin.id,
        user_id: userId,
        check_date: checkin.date,
        image_local_id: null,
        detected_pose_type: checkin.detectedPoseType,
        timeline_score: r.timelineScore,
        ideal_percent: r.idealPercent,
        warning_percent: r.warningPercent,
        direction: r.direction,
        backslide_detected: r.backslideDetected,
        confidence: r.confidence,
        visual_summary: r.visualSummary,
        data_summary: r.dataSummary,
        overall_read: r.overallRead,
        positive_signal: r.positiveSignal,
        warning_signal: r.warningSignal,
        next_quest_json: r.nextQuest,
        jrpg_message: r.jrpgMessage,
        coach_note: r.coachNote,
        raw_ai_response_json: r,
        created_at: checkin.createdAt
      },
      { onConflict: "id" }
    );
  } catch {
    // Best-effort: ignore cloud failures, local copy already saved.
  }
}

/** Upsert one identity doc (one ideal + one warning per user). */
export async function pushIdentityDocToCloud(doc: TimelineIdentityDoc): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  const userId = await currentUserId();
  if (!userId) return;

  try {
    await sb.from("timeline_identity_docs").upsert(
      {
        user_id: userId,
        doc_type: doc.docType,
        title: doc.title,
        markdown_content: doc.markdownContent,
        updated_at: doc.updatedAt
      },
      { onConflict: "user_id,doc_type" }
    );
  } catch {
    // Best-effort.
  }
}

/** Record reference-image metadata (bytes stay on-device via image_local_id). */
export async function pushReferenceToCloud(ref: TimelineReferenceImage): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  const userId = await currentUserId();
  if (!userId) return;

  try {
    await sb.from("timeline_reference_images").upsert(
      {
        id: ref.id,
        user_id: userId,
        role: ref.role,
        pose_type: ref.poseType,
        image_local_id: ref.imageLocalId,
        notes: ref.notes ?? null,
        created_at: ref.createdAt
      },
      { onConflict: "id" }
    );
  } catch {
    // Best-effort.
  }
}

export async function deleteReferenceFromCloud(id: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  const userId = await currentUserId();
  if (!userId) return;
  try {
    await sb.from("timeline_reference_images").delete().eq("id", id).eq("user_id", userId);
  } catch {
    // Best-effort.
  }
}

export async function deleteCheckinFromCloud(id: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  const userId = await currentUserId();
  if (!userId) return;
  try {
    await sb.from("timeline_checkins").delete().eq("id", id).eq("user_id", userId);
  } catch {
    // Best-effort.
  }
}
