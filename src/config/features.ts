/**
 * Feature flags. Off by default — flip via environment variables.
 *
 * Push notifications are built but dormant: enabling them requires VAPID keys,
 * a Supabase push_subscriptions table, Vercel Cron schedules, and (for the four
 * daily reminder times) the Vercel Pro plan. See PUSH_SETUP.md.
 */
export const pushNotificationsEnabled = process.env.NEXT_PUBLIC_PUSH_ENABLED === "true";
