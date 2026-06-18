import { getCurrentCloudUser } from "@/client/cloudSync";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Client side of web-push: subscribe the device, store the subscription in
 * Supabase (so the cron job can reach it), and unsubscribe. Dormant unless the
 * push feature flag + VAPID key are present.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type PushStatus = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
};

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) {
    return { supported: false, permission: "unsupported", subscribed: false };
  }
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  return { supported: true, permission: Notification.permission, subscribed: Boolean(subscription) };
}

export async function subscribeToPush(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPushSupported()) return { ok: false, message: "Push isn't supported on this device." };
  if (!VAPID_PUBLIC_KEY) return { ok: false, message: "Push isn't configured yet (missing VAPID key)." };

  const sb = getSupabaseClient();
  if (!sb) return { ok: false, message: "Cloud sync must be configured for push." };
  const user = await getCurrentCloudUser();
  if (!user) return { ok: false, message: "Sign in to enable reminders." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, message: "Notification permission was denied." };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
  });

  const { error } = await sb.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      subscription: subscription.toJSON(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      updated_at: new Date().toISOString()
    },
    { onConflict: "endpoint" }
  );
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!subscription) return;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  const sb = getSupabaseClient();
  if (sb) await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
