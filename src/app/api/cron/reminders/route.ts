import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

import { pushNotificationsEnabled } from "@/config/features";
import { metricStorageKey } from "@/data/metricRepository";
import { workoutStorageKey } from "@/data/workoutRepository";
import { isMetricEntry } from "@/domain/metrics";
import { isWorkout } from "@/domain/workouts";
import { getDueReminders } from "@/domain/pushReminders";

export const runtime = "nodejs";
export const maxDuration = 60;

type SubscriptionRow = {
  user_id: string;
  endpoint: string;
  subscription: webpush.PushSubscription;
  timezone: string | null;
};

function localNow(timeZone: string): { today: string; nowMinutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    today: `${get("year")}-${get("month")}-${get("day")}`,
    nowMinutes: Number(get("hour")) * 60 + Number(get("minute"))
  };
}

export async function GET(request: Request) {
  if (!pushNotificationsEnabled) {
    return NextResponse.json({ skipped: "push feature disabled" });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!url || !serviceRole || !vapidPublic || !vapidPrivate) {
    return NextResponse.json({ skipped: "push not fully configured" });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:reminders@lifequest.app",
    vapidPublic,
    vapidPrivate
  );

  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, subscription, timezone");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  let sent = 0;
  for (const row of (subs ?? []) as SubscriptionRow[]) {
    try {
      const { data: dataRow } = await admin
        .from("user_data")
        .select("data")
        .eq("user_id", row.user_id)
        .maybeSingle();
      const snapshot = (dataRow as { data?: { data?: Record<string, unknown> } } | null)?.data?.data;
      if (!snapshot) continue;

      const metrics = Array.isArray(snapshot[metricStorageKey])
        ? (snapshot[metricStorageKey] as unknown[]).filter(isMetricEntry)
        : [];
      const workouts = Array.isArray(snapshot[workoutStorageKey])
        ? (snapshot[workoutStorageKey] as unknown[]).filter(isWorkout)
        : [];

      const { today, nowMinutes } = localNow(row.timezone || "America/New_York");
      const due = getDueReminders({ today, nowMinutes, metrics, workouts });

      for (const reminder of due) {
        await webpush.sendNotification(
          row.subscription,
          JSON.stringify({ title: reminder.title, body: reminder.body, url: reminder.url, tag: reminder.id })
        );
        sent += 1;
      }
    } catch (sendError) {
      // Expired/invalid subscription — drop it so we stop retrying.
      const statusCode = (sendError as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
